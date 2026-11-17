import { defineSecret } from "firebase-functions/params";

export const REGION = "us-central1";

export const APP_ACTION_PATH = "/auth/action";

const PROD_CONTINUE_ORIGINS = new Set([
  "https://lecoursville.com",
  "https://lecoursville.firebaseapp.com",
]);

// The dev project's own hosting origins. Added only when the code runs in the
// dev project, so the prod deployment never accepts a dev continue URL.
const DEV_CONTINUE_ORIGINS = new Set([
  "https://lecoursville-dev.web.app",
  "https://lecoursville-dev.firebaseapp.com",
]);

const DEV_PROJECT_ID = "lecoursville-dev";

// Localhost origins are emulator-only unless explicitly opted in, so a prod
// build cannot accept a local continue URL.
const LOCAL_CONTINUE_ORIGINS = ["http://localhost:5000", "http://127.0.0.1:5000"];

function currentProjectId(): string {
  if (process.env.GCLOUD_PROJECT) {
    return process.env.GCLOUD_PROJECT;
  }
  if (process.env.GCP_PROJECT) {
    return process.env.GCP_PROJECT;
  }
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG ?? "{}").projectId ?? "";
  } catch {
    return "";
  }
}

export function getAllowedContinueOrigins(): Set<string> {
  const allowLocal =
    process.env.FUNCTIONS_EMULATOR === "true" ||
    process.env.ALLOW_LOCAL_CONTINUE_ORIGINS === "1";
  const origins = new Set(PROD_CONTINUE_ORIGINS);
  if (currentProjectId() === DEV_PROJECT_ID) {
    for (const origin of DEV_CONTINUE_ORIGINS) {
      origins.add(origin);
    }
  }
  if (allowLocal) {
    for (const origin of LOCAL_CONTINUE_ORIGINS) {
      origins.add(origin);
    }
  }
  return origins;
}

export const FROM_ADDRESS = "LeCoursville <no-reply@auth.lecoursville.com>";
export const ALERTS_FROM = "LeCoursville Alerts <no-reply@auth.lecoursville.com>";
export const REPLY_TO = "eric@lecoursville.com";

// Owner inbox for detective-control notifications (new accounts, recovery).
export const OWNER_ALERT_ADDRESS = "eric@lecoursville.com";

export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
