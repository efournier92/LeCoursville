import { Injectable } from "@angular/core";
import { httpsCallable } from "firebase/functions";
import { FirebaseService } from "src/app/services/firebase.service";

@Injectable({
  providedIn: "root",
})
export class CloudFunctionsService {
  constructor(private firebase: FirebaseService) {}

  /** The in-app action handler's URL; callables validate it against an
   *  allowlist, and it is not configurable because src/environments is untracked. */
  appActionUrl(): string {
    return window.location.origin + "/auth/action";
  }

  requestPasswordReset(email: string): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "requestPasswordReset")({
      email,
      continueUrl: this.appActionUrl(),
    });
  }

  submitRecoveryRequest(input: {
    email: string;
    name: string;
    alternateContact?: string;
    message?: string;
  }): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "submitRecoveryRequest")(input);
  }

  adminGenerateResetLink(input: {
    requestId: string;
    email: string;
    reason: string;
  }): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "adminGenerateResetLink")({
      ...input,
      continueUrl: this.appActionUrl(),
    });
  }

  updateAlertRecipients(emails: string[]): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "updateAlertRecipients")({ emails });
  }

  closeRecoveryRequest(input: { requestId: string; reason?: string }): Promise<unknown> {
    return httpsCallable(this.firebase.functions, "closeRecoveryRequest")(input);
  }
}
