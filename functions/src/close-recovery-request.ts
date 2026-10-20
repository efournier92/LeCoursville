import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import {
  RECOVERY_LOCK_TTL_MS,
  compareAndSet,
  isAdmin,
  rateLimit,
  writeAudit,
} from "./helpers";

interface RecoveryRequestRecord {
  status?: string;
  updatedAt?: number;
  closedBy?: string | null;
  closedAt?: number | null;
}

export const closeRecoveryRequest = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    if (!(await isAdmin(uid))) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    // minimalist: rate limit only, no breach audit/alert like the admin mint
    // path; add those if close-rate abuse is observed.
    if (!(await rateLimit("closeRecoveryRequests", uid, 60, 3600000))) {
      throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
    }

    const requestId = String(request.data?.requestId ?? "").trim();
    const reason = String(request.data?.reason ?? "").trim();
    if (requestId.length === 0) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }

    const ref = getDatabase().ref(`recoveryRequests/${requestId}`);
    const result = await compareAndSet<RecoveryRequestRecord>(ref, (current) => {
      if (!current) {
        return undefined;
      }
      // A stale "pending" lock (abandoned mint) is closable, so a stuck request
      // is never bricked outside the admin's reach.
      const stale =
        current.status === "pending" &&
        Date.now() - (current.updatedAt ?? 0) > RECOVERY_LOCK_TTL_MS;
      if (current.status !== "open" && !stale) {
        return undefined;
      }
      return {
        ...current,
        status: "closed",
        closedBy: uid,
        closedAt: Date.now(),
        updatedAt: Date.now(),
      };
    });
    if (!result.committed) {
      throw new HttpsError("failed-precondition", "already-handled");
    }

    try {
      await writeAudit({
        action: "close_request",
        actorUid: uid,
        actorEmail: request.auth?.token?.email || null,
        requestId,
        reason: reason || null,
      });
    } catch (err) {
      // Never leave a request closed with no audit entry: roll the flip back
      // and surface the failure so the admin can retry.
      await compareAndSet<RecoveryRequestRecord>(ref, (current) => {
        if (!current || current.status !== "closed" || current.closedBy !== uid) {
          return undefined;
        }
        return {
          ...current,
          status: "open",
          closedBy: null,
          closedAt: null,
          updatedAt: Date.now(),
        };
      });
      throw err;
    }

    return { ok: true };
  }
);
