import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import { isAdmin, isValidEmail, writeAudit } from "./helpers";

// Bound the stored list so a single call cannot grow the node without limit.
const MAX_ALERT_RECIPIENTS = 25;

export const updateAlertRecipients = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    if (!(await isAdmin(uid))) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const raw = request.data?.emails;
    if (!Array.isArray(raw)) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }
    if (raw.length > MAX_ALERT_RECIPIENTS) {
      throw new HttpsError("invalid-argument", "Too many recipients.");
    }
    const emails = raw.map((entry) => String(entry).trim().toLowerCase());
    if (emails.some((entry) => !isValidEmail(entry))) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }

    await getDatabase()
      .ref("config/adminAlertRecipients")
      .set(emails.length > 0 ? emails : null);

    await writeAudit({
      action: "update_recipients",
      actorUid: uid,
      actorEmail: request.auth?.token?.email || null,
    });

    return { ok: true };
  }
);
