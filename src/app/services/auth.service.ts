import { Injectable } from "@angular/core";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  GoogleAuthProvider,
  verifyPasswordResetCode,
  confirmPasswordReset,
  User as FirebaseUser,
} from "firebase/auth";
import { MatDialogRef } from "@angular/material/dialog";
import { BehaviorSubject, Observable } from "rxjs";
import { User } from "src/app/models/user";
import { RoutingService } from "src/app/services/routing.service";
import { PromptModalComponent } from "src/app/components/prompt-modal/prompt-modal.component";
import { PromptModalService } from "src/app/services/prompt-modal.service";
import { FirebaseService } from "src/app/services/firebase.service";
import { CloudFunctionsService } from "src/app/services/cloud-functions.service";
import { RtdbService } from "src/app/services/rtdb.service";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  user: User;
  userObservable: Observable<{}>;
  /** False until Firebase reports the first auth state, so callers can tell
   *  "auth unresolved" apart from "signed out". */
  authResolved$: Observable<boolean>;
  /** Redirect sign-in errors land here after the full reload; the sign-in UI
   *  maps them exactly as it maps popup errors. Null until one occurs. */
  redirectError$: Observable<string | null>;
  hasAlreadyUpdatedUser: boolean;
  private signedOut = false;

  private userSource: BehaviorSubject<{}>;
  private authResolvedSource: BehaviorSubject<boolean>;
  private redirectErrorSource: BehaviorSubject<string | null>;

  constructor(
    private rtdb: RtdbService,
    private firebase: FirebaseService,
    private cloudFunctions: CloudFunctionsService,
    private routingService: RoutingService,
    private promptModal: PromptModalService,
  ) {
    this.userSource = new BehaviorSubject({});
    this.userObservable = this.userSource.asObservable();
    this.authResolvedSource = new BehaviorSubject(false);
    this.authResolved$ = this.authResolvedSource.asObservable();
    this.redirectErrorSource = new BehaviorSubject<string | null>(null);
    this.redirectError$ = this.redirectErrorSource.asObservable();
    this.hasAlreadyUpdatedUser = false;
    // Warm the RTDB websocket at boot, in parallel with the auth restore.
    // Without this the first listener (the user record, post-auth) pays the
    // full TLS + WS handshake serially; every page's first snapshot waits
    // on that connection. .info/connected is a free server-side value.
    this.rtdb.object(".info/connected").valueChanges().subscribe();
    this.subscribeToAuthState();
    this.resolveRedirectResult();
  }

  // PUBLIC METHODS

  /** Native email/password sign-in (replaces the FirebaseUI widget). */
  async signIn(email: string, password: string): Promise<FirebaseUser> {
    const cred = await signInWithEmailAndPassword(this.firebase.auth, email, password);
    return cred.user;
  }

  /** Native password reset email (replaces FirebaseUI's reset link). Prefers
   *  the requestPasswordReset callable; if it is unavailable (cold deploy,
   *  network, callable missing) falls back to the direct Firebase send. */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await this.cloudFunctions.requestPasswordReset(email);
    } catch (error) {
      // Only a transport failure may retry through Firebase directly. Any
      // other callable error kept propagating, so a differing response cannot
      // become an account-existence oracle.
      if (!this.isTransportFailure(error)) {
        throw error;
      }
      try {
        await sendPasswordResetEmail(this.firebase.auth, email, {
          url: this.cloudFunctions.appActionUrl(),
          handleCodeInApp: true,
        });
      } catch (fallbackError) {
        // The caller shows the same generic info banner either way.
        if ((fallbackError as { code?: string })?.code === "auth/user-not-found") {
          return;
        }
        throw fallbackError;
      }
    }
  }

  async verifyResetCode(code: string): Promise<string> {
    return verifyPasswordResetCode(this.firebase.auth, code);
  }

  async confirmReset(code: string, newPassword: string): Promise<void> {
    await confirmPasswordReset(this.firebase.auth, code, newPassword);
  }

  async signInWithGoogle(): Promise<FirebaseUser> {
    const provider = new GoogleAuthProvider();
    if (this.isMobileInAppBrowser()) {
      return this.redirectToGoogle(provider);
    }
    try {
      const cred = await signInWithPopup(this.firebase.auth, provider);
      return cred.user;
    } catch (error) {
      if ((error as { code?: string })?.code !== "auth/popup-blocked") {
        throw error;
      }
      return this.redirectToGoogle(provider);
    }
  }

  async linkGoogle(): Promise<FirebaseUser> {
    if (!this.firebase.auth.currentUser) {
      throw new Error("Cannot link Google: no user is signed in.");
    }
    const cred = await linkWithPopup(this.firebase.auth.currentUser, new GoogleAuthProvider());
    return cred.user;
  }

  getUser(authData: any): void {
    if (!authData || !authData.uid) {
      return;
    }

    this.rtdb.object<User>(`users/${authData.uid}`).valueChanges().subscribe((user: User) => {
      if (!user) {
        return;
      }
      if (!this.authResolvedSource.getValue()) {
        this.authResolvedSource.next(true);
      }
      this.userSource.next(user);
      this.user = user;
      this.setUser(authData, user);
    });
  }

  getUserNameById(userId: string): string {
    let user: User;
    this.rtdb.object<User>(`users/${userId}`).valueChanges().subscribe((updatedUser: User) => {
      user = updatedUser;
    });

    return user?.name;
  }

  updateUser(user: User): void {
    if (!user) {
      return;
    }
    this.userSource.next(user);
    this.rtdb.object<User>(`users/${user.id}`).update(user);
    this.setUserInLocalStorage(user);
  }

  setUser(authData: any, existingUser: User): void {
    if (this.hasAlreadyUpdatedUser || !authData || !existingUser) {
      return;
    }

    // Guard FIRST: Firebase dispatches the local-cache write event
    // synchronously inside update(), so the re-entrant listener callback runs
    // before the line below would execute. Setting the flag before the write
    // is the only way to stop the update→emit→update loop.
    this.hasAlreadyUpdatedUser = true;

    existingUser.dateLastActive = new Date();

    if (!existingUser) {
      this.createUser(authData, existingUser);
    } else {
      this.updateUser(existingUser);
    }
  }

  onSignIn(authData: any): void {
    const authUser = authData?.authResult?.user;

    if (!authUser?.uid) {
      return;
    }
    // Guard: updateUser() writes back to the very path this listener watches,
    // and Firebase dispatches the local-cache event synchronously inside
    // update(). The flag must be set BEFORE the write — otherwise the
    // re-entrant callback beats it (Maximum call stack size exceeded).
    let handled = false;
    this.rtdb.object<User>(`users/${authUser?.uid}`).valueChanges().subscribe((existingUser: User) => {
      if (handled) {
        return;
      }
      handled = true;

      if (!existingUser) {
        this.createUser(authData, existingUser);
        return;
      }

      this.updateUser(existingUser);

      this.routingService.NavigateToPromotedRoute();
    });
  }

  createUser(authData: any, existingUser: User): void {
    const user: User = new User(authData, existingUser);
    this.updateUser(user);
    this.setUserInLocalStorage(user);
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.firebase.auth);
    this.removeUserFromLocalStorage();
    this.routingService.RefreshCurrentRoute();
  }

  openSignOutDialog(): MatDialogRef<PromptModalComponent, any> {
    return this.promptModal.openDialog(
      "Are You Sure?",
      "Do you want to sign out of LeCoursville?",
    );
  }

  onSignOutDialogClose(
    dialogRef: MatDialogRef<PromptModalComponent, any>,
  ): void {
    dialogRef.afterClosed().subscribe((signOutConfirmed: boolean) => {
      if (signOutConfirmed) {
        this.signOut();
      }
    });
  }

  /** Last session's user from localStorage, for cosmetic instant render.
   *  NOT an auth check: guards must verify against the RTDB record. */
  getCachedUser(): User | null {
    return this.getUserFromLocalStorage() || null;
  }

  /** True once firebase auth has resolved to "no session". Lets the sign-in
   *  page drop its cached-session interstitial and show the real form. */
  isSignedOut(): boolean {
    return this.signedOut;
  }

  isUserSignedIn(): boolean {
    const user = this.getUserFromLocalStorage();
    return !!user?.id;
  }

  isUserAdmin(): boolean {
    const user = this.getUserFromLocalStorage();
    return !!user?.roles?.admin;
  }

  // HELPERS

  private subscribeToAuthState(): void {
    onAuthStateChanged(this.firebase.auth, (authData) => {
      if (!authData) {
        // Signed out: the outcome is known now, nothing else to wait for.
        this.signedOut = true;
        this.authResolvedSource.next(true);
        return;
      }
      this.signedOut = false;
      // Signed in: stay unresolved until the RTDB user record lands, so the
      // nav keeps its skeleton instead of flashing a wrong Sign In link.
      // Safety valve: if the record never arrives (missing users/{uid} node,
      // dead stream), resolve after 5s rather than skeleton forever. The
      // admin GUARD stays RTDB-backed either way; authResolved only drives
      // the nav's cosmetic three-way.
      if (!this.authResolvedSource.getValue()) {
        setTimeout(() => {
          if (!this.authResolvedSource.getValue()) {
            this.authResolvedSource.next(true);
          }
        }, 5000);
      }
      this.getUser(authData);
    });
  }

  /** signInWithRedirect returns to the app in a fresh load; the credential
   *  only arrives here, so route it through the same onSignIn path as a popup. */
  private async resolveRedirectResult(): Promise<void> {
    try {
      const cred = await getRedirectResult(this.firebase.auth);
      if (cred?.user) {
        this.onSignIn({ authResult: { user: cred.user } });
      }
    } catch (error) {
      // The sign-in UI maps any error; boot must not be blocked by it.
      this.redirectErrorSource.next((error as { code?: string })?.code || "auth/unknown");
    }
  }

  /** Navigates away; the returned promise stays pending until the reload. */
  private redirectToGoogle(provider: GoogleAuthProvider): Promise<FirebaseUser> {
    return signInWithRedirect(this.firebase.auth, provider).then(
      () => new Promise<FirebaseUser>(() => {}),
    );
  }

  private isMobileInAppBrowser(): boolean {
    return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|; wv\)|WhatsApp/i.test(
      navigator.userAgent,
    );
  }

  private isTransportFailure(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    return code === "functions/unavailable" || code === "functions/deadline-exceeded";
  }

  private getUserFromLocalStorage() {
    return JSON.parse(localStorage.getItem("user"));
  }

  private setUserInLocalStorage(user: User) {
    localStorage.setItem("user", JSON.stringify(user));
  }

  private removeUserFromLocalStorage() {
    localStorage.removeItem("user");
  }
}
