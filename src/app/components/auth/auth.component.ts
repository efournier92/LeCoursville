import { Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { AuthService } from "src/app/services/auth.service";
import { User } from "src/app/models/user";
import { RoutingService } from "src/app/services/routing.service";
import { AnalyticsService } from "src/app/services/analytics.service";
import { ThemeService } from "src/app/services/theme.service";
import { RecoveryRequestComponent } from "src/app/components/recovery-request/recovery-request.component";
import { filter, take } from "rxjs/operators";

@Component({
    selector: "app-auth",
    templateUrl: "./auth.component.html",
    styleUrls: ["./auth.component.scss"],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AuthComponent implements OnInit {
  user: User;
  isEditMode: boolean;
  email = "";
  password = "";
  loading = false;
  sendingReset = false;
  error = "";
  info = "";
  // True while a cached session is being restored: the page holds a neutral
  // interstitial so a returning user at "/" never flashes the login form
  // (or the account card) before the promoted-route redirect lands.
  awaitingSession = false;

  constructor(
    private authService: AuthService,
    private routingService: RoutingService,
    private analyticsService: AnalyticsService,
    private themeService: ThemeService,
    private dialog: MatDialog
  ) {}

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    // Remove any extraneous URL information
    this.routingService.NavigateToSignIn();
    this.isEditMode = false;
    this.awaitingSession = !!this.authService.getCachedUser()?.id;
    this.authService.authResolved$.subscribe((resolved: boolean) => {
      // Firebase says there is no session: show the real login form.
      if (resolved && this.authService.isSignedOut()) {
        this.awaitingSession = false;
      }
    });
    this.subscribeToUserObservable();
    // A Google redirect returns on a fresh load, so its failure is only
    // knowable here — surface it through the popup path's mapping.
    this.authService.redirectError$.pipe(
      filter((code: string | null) => !!code),
      take(1),
    ).subscribe((code: string) => {
      this.error = this.mapAuthError(code);
    });
    this.analyticsService.logEvent("component_load_auth", {});
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.pipe(
      filter((user: any) => !!user?.id),
    ).subscribe((user: User) => {
      this.user = user;
      // Real record landed; the redirect is in flight. If it is slow, the
      // account card is the honest state, not the interstitial.
      this.awaitingSession = false;
    });
  }

  // PUBLIC METHODS

  async onSignIn(): Promise<void> {
    if (!this.email.trim() || !this.password) {
      this.error = "Enter your email and password.";
      return;
    }
    this.loading = true;
    this.error = "";
    this.info = "";
    try {
      const fbUser = await this.authService.signIn(this.email.trim(), this.password);
      this.analyticsService.logEvent("auth_sign_in", { userId: fbUser.uid });
      this.authService.onSignIn({ authResult: { user: fbUser } });
      this.password = "";
    } catch (e: any) {
      this.error = this.mapAuthError(e?.code || "");
    } finally {
      this.loading = false;
    }
  }

  async onGoogleSignIn(): Promise<void> {
    this.loading = true;
    this.error = "";
    this.info = "";
    try {
      const fbUser = await this.authService.signInWithGoogle();
      this.analyticsService.logEvent("auth_sign_in_google", { userId: fbUser.uid });
      this.authService.onSignIn({ authResult: { user: fbUser } });
    } catch (e: any) {
      this.error = this.mapAuthError(e?.code || "");
    } finally {
      this.loading = false;
    }
  }

  async onForgotPassword(): Promise<void> {
    if (!this.email.trim()) {
      this.error = "Enter your email first.";
      return;
    }
    if (this.sendingReset) {
      return;
    }
    this.sendingReset = true;
    this.error = "";
    this.info = "";
    this.analyticsService.logEvent("auth_forgot_clicked", {});
    try {
      await this.authService.sendPasswordReset(this.email.trim());
      this.info =
        "If an account exists for that email, we sent a reset link. It can take a few minutes — check your spam or junk folder.";
      this.analyticsService.logEvent("auth_reset_sent", {});
    } catch (e: any) {
      this.error = this.mapAuthError(e?.code || "");
      this.analyticsService.logEvent("auth_reset_failed", {
        reason: e?.code || "unknown",
      });
    } finally {
      this.sendingReset = false;
    }
  }

  onRecoveryOpen(): void {
    this.analyticsService.logEvent("recovery_opened", { source: "sign_in" });
    this.dialog.open(RecoveryRequestComponent, {
      width: "480px",
      maxWidth: "95vw",
      data: { email: this.email.trim(), name: this.user?.name ?? "" },
    });
  }

  onSignOutButtonClick(): void {
    this.analyticsService.logEvent("auth_sign_out", { userId: this.user?.id });
    const dialogRef = this.authService.openSignOutDialog();
    this.authService.onSignOutDialogClose(dialogRef);
  }

  onEdit(): void {
    this.isEditMode = true;
  }

  get alwaysDark(): boolean {
    return this.user?.prefs?.theme === 'dark';
  }

  onAlwaysDarkChange(checked: boolean): void {
    this.themeService.setAccountTheme(checked ? 'dark' : 'light');
    this.themeService.clearSessionOverride();
  }

  onCancelEdit(): void {
    this.isEditMode = false;
  }

  // HELPERS

  private mapAuthError(code: string): string {
    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Incorrect email or password.";
      case "auth/invalid-email":
        return "That email address looks invalid.";
      case "auth/too-many-requests":
        return "Too many attempts — try again in a minute.";
      case "auth/network-request-failed":
        return "Network error — check your connection.";
      case "auth/invalid-action-code":
        return "That reset link is invalid. Request a new one.";
      case "auth/expired-action-code":
        return "That reset link has expired. Request a new one.";
      case "auth/account-exists-with-different-credential":
        return "An account already exists for this email. Sign in with your email and password.";
      case "auth/popup-blocked":
        return "Your browser blocked the Google sign-in popup. Allow popups and try again.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled.";
      case "auth/operation-not-allowed":
        return "Google sign-in is not available right now.";
      default:
        return "Sign-in failed. Try again.";
    }
  }
}
