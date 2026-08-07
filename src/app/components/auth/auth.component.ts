import { Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { AuthService } from "src/app/services/auth.service";
import { User } from "src/app/models/user";
import { RoutingService } from "src/app/services/routing.service";
import { AnalyticsService } from "src/app/services/analytics.service";

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
  error = "";
  info = "";

  constructor(
    private authService: AuthService,
    private routingService: RoutingService,
    private analyticsService: AnalyticsService
  ) {}

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    // Remove any extraneous URL information
    this.routingService.NavigateToSignIn();
    this.isEditMode = false;
    this.subscribeToUserObservable();
    this.analyticsService.logEvent("component_load_auth", {});
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => (this.user = user)
    );
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

  async onForgotPassword(): Promise<void> {
    if (!this.email.trim()) {
      this.error = "Enter your email first, then click the reset link.";
      return;
    }
    this.error = "";
    this.info = "";
    try {
      await this.authService.sendPasswordReset(this.email.trim());
      this.info = "Password reset email sent — check your inbox.";
    } catch (e: any) {
      this.error = this.mapAuthError(e?.code || "");
    }
  }

  onSignOutButtonClick(): void {
    this.analyticsService.logEvent("auth_sign_out", { userId: this.user?.id });
    const dialogRef = this.authService.openSignOutDialog();
    this.authService.onSignOutDialogClose(dialogRef);
  }

  onEdit(): void {
    this.isEditMode = true;
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
      default:
        return "Sign-in failed. Try again.";
    }
  }
}
