import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";

// Membership is granted only by an admin (files/change-user-role.ts); signup
// no longer self-approves. Kept as a callable so existing clients keep working.
export const claimMemberRole = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    return { ok: true, uid };
  }
);
