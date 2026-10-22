import { initializeApp } from "firebase-admin/app";

initializeApp();

export { REGION } from "./config";
export { requestPasswordReset } from "./request-password-reset";
export { submitRecoveryRequest } from "./submit-recovery-request";
export { adminGenerateResetLink } from "./admin-generate-reset-link";
export { closeRecoveryRequest } from "./close-recovery-request";
export { updateAlertRecipients } from "./update-alert-recipients";
export { createUserUpload } from "./create-user-upload";
export { onAdminAlertCreated } from "./admin-alert-created";
export { onAccountCreated } from "./account-created";
