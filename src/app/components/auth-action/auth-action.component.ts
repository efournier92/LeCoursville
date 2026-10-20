import { Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { AuthService } from "src/app/services/auth.service";

@Component({
    selector: "app-auth-action",
    templateUrl: "./auth-action.component.html",
    styleUrls: ["./auth-action.component.scss"],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AuthActionComponent implements OnInit {
  mode = "";
  oobCode = "";
  email = "";
  newPassword = "";
  confirmPassword = "";
  loading = false;
  submitting = false;
  invalidLink = false;
  neutralNotice = false;
  userDisabled = false;
  verified = false;
  success = false;
  linkError = false;
  error = "";

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {}

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.mode = this.route.snapshot.queryParamMap.get("mode") || "";
    this.oobCode = this.route.snapshot.queryParamMap.get("oobCode") || "";
    if (!this.mode || !this.oobCode) {
      this.invalidLink = true;
      return;
    }
    if (this.mode === "resetPassword") {
      this.verifyCode();
      return;
    }
    if (this.mode === "signIn" || this.mode === "verifyEmail") {
      this.neutralNotice = true;
      return;
    }
    this.invalidLink = true;
  }

  // PUBLIC METHODS

  async onSubmit(): Promise<void> {
    if (!this.newPassword || this.newPassword.length < 6) {
      this.error = "Password must be at least 6 characters.";
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = "Passwords do not match.";
      return;
    }
    this.submitting = true;
    this.error = "";
    try {
      await this.authService.confirmReset(this.oobCode, this.newPassword);
      this.success = true;
    } catch (e: any) {
      this.handleError(e?.code || "");
    } finally {
      this.submitting = false;
    }
  }

  // HELPERS

  private async verifyCode(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.email = await this.authService.verifyResetCode(this.oobCode);
      this.verified = true;
    } catch (e: any) {
      this.handleError(e?.code || "");
    } finally {
      this.loading = false;
    }
  }

  private handleError(code: string): void {
    if (code === "auth/user-disabled") {
      this.userDisabled = true;
      return;
    }
    if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
      this.error = "This reset link is invalid or has expired.";
      this.linkError = true;
      return;
    }
    this.error = "Something went wrong. Request a new link and try again.";
  }
}
