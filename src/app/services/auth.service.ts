import { Injectable } from "@angular/core";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from "firebase/auth";
import { MatDialogRef } from "@angular/material/dialog";
import { BehaviorSubject, Observable } from "rxjs";
import { User } from "src/app/models/user";
import { RoutingService } from "src/app/services/routing.service";
import { PromptModalComponent } from "src/app/components/prompt-modal/prompt-modal.component";
import { PromptModalService } from "src/app/services/prompt-modal.service";
import { FirebaseService } from "src/app/services/firebase.service";
import { RtdbService } from "src/app/services/rtdb.service";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  user: User;
  userObservable: Observable<{}>;
  hasAlreadyUpdatedUser: boolean;

  private userSource: BehaviorSubject<{}>;

  constructor(
    private rtdb: RtdbService,
    private firebase: FirebaseService,
    private routingService: RoutingService,
    private promptModal: PromptModalService,
  ) {
    this.userSource = new BehaviorSubject({});
    this.userObservable = this.userSource.asObservable();
    this.hasAlreadyUpdatedUser = false;
    this.subscribeToAuthState();
  }

  // PUBLIC METHODS

  /** Native email/password sign-in (replaces the FirebaseUI widget). */
  async signIn(email: string, password: string): Promise<FirebaseUser> {
    const cred = await signInWithEmailAndPassword(this.firebase.auth, email, password);
    return cred.user;
  }

  /** Native password reset email (replaces FirebaseUI's reset link). */
  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.firebase.auth, email);
  }

  getUser(authData: any): void {
    if (!authData || !authData.uid) {
      return;
    }

    this.rtdb.object<User>(`users/${authData.uid}`).valueChanges().subscribe((user: User) => {
      if (!user) {
        return;
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
    onAuthStateChanged(this.firebase.auth, (authData) =>
      this.getUser(authData),
    );
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
