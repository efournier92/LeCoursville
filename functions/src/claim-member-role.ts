import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";

/**
 * Stamps the caller's membership flag from the server. The client may not
 * write `roles`, so signup calls this once after creating its profile record.
 * The `/users/{uid}` creation trigger is the watchdog when this call is lost.
 */
export const claimMemberRole = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const ref = getDatabase().ref(`users/${uid}/roles/user`);
    if ((await ref.get()).val() !== true) {
      await ref.set(true);
    }

    return { ok: true, uid };
  }
);
