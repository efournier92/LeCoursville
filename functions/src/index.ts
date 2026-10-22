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
export { claimMemberRole } from "./claim-member-role";
export { changeUserRole } from "./change-user-role";
export { emulatorMediaSink } from "./emulator-media-sink";
export { createMediaUpload } from "./create-media-upload";
export { resumeMediaUpload } from "./resume-media-upload";
export { finalizeMediaUpload } from "./finalize-media-upload";
export { updateMediaMetadata } from "./update-media-metadata";
export { deleteMedia } from "./delete-media";
export { sweepMediaUploads } from "./sweep-media-uploads";
