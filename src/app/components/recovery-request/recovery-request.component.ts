import { Component, ChangeDetectionStrategy, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { AnalyticsService } from "src/app/services/analytics.service";
import { CloudFunctionsService } from "src/app/services/cloud-functions.service";

export interface RecoveryDialogData {
  email?: string;
  name?: string;
}

@Component({
    selector: "app-recovery-request",
    templateUrl: "./recovery-request.component.html",
    styleUrls: ["./recovery-request.component.scss"],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class RecoveryRequestComponent {
  email = "";
  name = "";
  alternateContact = "";
  message = "";
  loading = false;
  submitted = false;
  error = "";

  constructor(
    public dialogRef: MatDialogRef<RecoveryRequestComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RecoveryDialogData,
    private cloudFunctions: CloudFunctionsService,
    private analytics: AnalyticsService,
  ) {
    // Prefill what the sign-in page already captured, so a locked-out user does
    // not retype (and cannot accidentally mistype) the account address.
    this.email = data?.email ?? "";
    this.name = data?.name ?? "";
  }

  // PUBLIC METHODS

  async onSubmit(): Promise<void> {
    const email = this.email.trim();
    const name = this.name.trim();
    if (!this.isValidEmail(email) || !name) {
      this.error = "Enter your name and a valid email address.";
      this.analytics.logEvent("recovery_validation_error", {});
      return;
    }
    this.loading = true;
    this.error = "";
    this.analytics.logEvent("recovery_submitted", {
      hasAlternateContact: !!this.alternateContact.trim(),
    });
    try {
      await this.cloudFunctions.submitRecoveryRequest({
        email,
        name: name.slice(0, 100),
        alternateContact: this.alternateContact.trim().slice(0, 320) || undefined,
        message: this.message.trim().slice(0, 500) || undefined,
      });
      this.submitted = true;
    } catch {
      this.error = "We couldn't submit your request. Try again.";
      this.analytics.logEvent("recovery_submit_failed", {});
    } finally {
      this.loading = false;
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  // HELPERS

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
