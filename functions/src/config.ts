import { defineSecret } from "firebase-functions/params";

export const REGION = "us-central1";

export const APP_ACTION_PATH = "/auth/action";

const PROD_CONTINUE_ORIGINS = new Set([
  "https://lecoursville.com",
  "https://lecoursville.firebaseapp.com",
]);

// Localhost origins are emulator-only unless explicitly opted in, so a prod
// build cannot accept a local continue URL.
const LOCAL_CONTINUE_ORIGINS = ["http://localhost:5000", "http://127.0.0.1:5000"];

export function getAllowedContinueOrigins(): Set<string> {
  const allowLocal =
    process.env.FUNCTIONS_EMULATOR === "true" ||
    process.env.ALLOW_LOCAL_CONTINUE_ORIGINS === "1";
  return allowLocal
    ? new Set([...PROD_CONTINUE_ORIGINS, ...LOCAL_CONTINUE_ORIGINS])
    : PROD_CONTINUE_ORIGINS;
}

export const FROM_ADDRESS = "LeCoursville <no-reply@auth.lecoursville.com>";
export const ALERTS_FROM = "LeCoursville Alerts <no-reply@auth.lecoursville.com>";
export const REPLY_TO = "eric@lecoursville.com";

// Owner inbox for detective-control notifications (new accounts, recovery).
export const OWNER_ALERT_ADDRESS = "eric@lecoursville.com";

export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
