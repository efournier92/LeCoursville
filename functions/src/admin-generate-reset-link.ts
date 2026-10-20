import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FROM_ADDRESS, RESEND_API_KEY, REGION } from "./config";
import {
  RECOVERY_LOCK_TTL_MS,
  compareAndSet,
  isAdmin,
  isAllowedContinueUrl,
  isValidEmail,
  rateLimit,
  sendAdminAlert,
  sendEmail,
  writeAudit,
} from "./helpers";

interface RecoveryRequestRecord {
  email?: string;
  alternateContact?: string | null;
  status?: string;
  resolvedBy?: string | null;
  updatedAt?: number;
  resolvedAt?: number;
}

function isMissingUser(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  return !!code?.startsWith("auth/") && code.endsWith("not-found");
}



export const adminGenerateResetLink = onCall(
  { region: REGION, cors: true, secrets: [RESEND_API_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    if (!(await isAdmin(uid))) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    if (!(await rateLimit("adminResetLinks", uid, 20, 3600000))) {
      // One audit and one alert per admin per window, so a retry loop cannot
      // flood recoveryAudit or the alert mailbox.
      if (await rateLimit("adminResetBreachThrottle", uid, 1, 3600000)) {
        await writeAudit({
          action: "rate_limit_breach",
          actorUid: uid,
          actorEmail: request.auth?.token?.email || null,
        });
        await sendAdminAlert({
          type: "rate_limit_breach",
          title: "Reset link rate limit exceeded",
          body: `Admin ${uid} exceeded the reset link rate limit.`,
          data: { actorUid: uid },
        });
      }
      throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
    }

    const requestId = String(request.data?.requestId ?? "").trim();
    const email = String(request.data?.email ?? "").trim().toLowerCase();
    const reason = String(request.data?.reason ?? "").trim();
    const continueUrl = String(request.data?.continueUrl ?? "");

    if (
      requestId.length === 0 ||
      !isValidEmail(email) ||
      reason.length === 0 ||
      reason.length > 500 ||
      !isAllowedContinueUrl(continueUrl)
    ) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }

    // A link is minted only against a request record, and only for its stored
    // email, so an admin cannot target an arbitrary address.
    const ref = getDatabase().ref(`recoveryRequests/${requestId}`);
    const snap = await ref.get();
    const requestRecord = (snap.val() ?? null) as RecoveryRequestRecord | null;
    if (!requestRecord) {
      throw new HttpsError("not-found", "Recovery request not found.");
    }
    const targetEmail = String(requestRecord.email ?? "").trim().toLowerCase();
    if (targetEmail !== email) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }

    const alternateContact = requestRecord.alternateContact;
    if (
      typeof alternateContact === "string" &&
      alternateContact.includes("@") &&
      !isValidEmail(alternateContact.trim().toLowerCase())
    ) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }

    // Lock the request before minting: two admins cannot double-mint, and a
    // transient mint failure releases the lock for retry instead of resolving.
    const lock = await compareAndSet<RecoveryRequestRecord>(ref, (current) => {
      if (!current) {
        return;
      }
      const stale =
        current.status === "pending" &&
        Date.now() - (current.updatedAt ?? 0) > RECOVERY_LOCK_TTL_MS;
      if (current.status !== "open" && !stale) {
        return;
      }
      return { ...current, status: "pending", resolvedBy: uid, updatedAt: Date.now() };
    });
    if (!lock.committed) {
      throw new HttpsError("failed-precondition", "already-handled");
    }

    const unlock = async () => {
      await compareAndSet<RecoveryRequestRecord>(ref, (current) => {
        if (!current || current.status !== "pending" || current.resolvedBy !== uid) {
          return;
        }
        return { ...current, status: "open", resolvedBy: null, updatedAt: Date.now() };
      });
    };

    let targetUid: string;
    try {
      targetUid = (await getAuth().getUserByEmail(targetEmail)).uid;
    } catch (err) {
      await unlock();
      if (isMissingUser(err)) {
        await writeAudit({
          action: "generate_reset_link_failed",
          actorUid: uid,
          actorEmail: request.auth?.token?.email || null,
          targetUid: null,
          targetEmail,
          requestId,
          reason,
        });
        throw new HttpsError("not-found", "Account not found.");
      }
      throw err;
    }

    let link: string;
    try {
      link = await getAuth().generatePasswordResetLink(targetEmail, {
        url: continueUrl,
        handleCodeInApp: true,
      });
    } catch (err) {
      await unlock();
      if (isMissingUser(err)) {
        await writeAudit({
          action: "generate_reset_link_failed",
          actorUid: uid,
          actorEmail: request.auth?.token?.email || null,
          targetUid,
          targetEmail,
          requestId,
          reason,
        });
        throw new HttpsError("not-found", "Account not found.");
      }
      throw err;
    }

    // Mint succeeded: resolve now, never before.
    const resolved = await compareAndSet<RecoveryRequestRecord>(ref, (current) => {
      if (!current || current.status !== "pending" || current.resolvedBy !== uid) {
        return;
      }
      return { ...current, status: "resolved", resolvedAt: Date.now(), updatedAt: Date.now() };
    });

    // Audit before email so a send outage still leaves the mint recorded. The
    // link is already minted and cannot be un-minted, so an audit outage must
    // never cost the admin the link.
    let auditId: string | null = null;
    try {
      auditId = await writeAudit({
        action: "generate_reset_link",
        actorUid: uid,
        actorEmail: request.auth?.token?.email || null,
        targetUid,
        targetEmail,
        requestId,
        reason,
        emailStatus: "pending",
      });
    } catch (err) {
      auditId = null;
      // A live credential must never be untraced: leave a compensating record
      // on the request and raise an admin alert.
      try {
        await ref.update({ auditFailed: true, updatedAt: Date.now() });
        await sendAdminAlert({
          type: "audit_failure",
          title: "Reset link minted without audit",
          body: `Admin ${uid} minted a reset link for ${targetEmail}, but the audit write failed.`,
          data: { requestId, targetEmail, error: (err as Error).message },
        });
      } catch {
        // Best effort: never fail a live mint on the compensating path.
      }
    }

    // A concurrent actor changed the record between lock and resolve; the
    // minted link still returns, but record the race instead of ignoring it.
    if (!resolved.committed) {
      try {
        await writeAudit({
          action: "generate_reset_link_resolve_raced",
          actorUid: uid,
          actorEmail: request.auth?.token?.email || null,
          targetUid,
          targetEmail,
          requestId,
        });
      } catch {
        // Best effort: never fail a live mint on the audit path.
      }
    }

    let emailed = false;
    if (typeof alternateContact === "string" && alternateContact.includes("@")) {
      const text = [
        "An administrator generated a password reset link for your LeCoursville account.",
        "",
        link,
        "",
        "This link expires in one hour.",
      ].join("\n");
      const html =
        `<p>An administrator generated a password reset link for your LeCoursville account.</p>` +
        `<p><a href="${link}">Choose a new password</a></p>` +
        `<p>This link expires in one hour.</p>`;
      try {
        await sendEmail({
          to: alternateContact,
          from: FROM_ADDRESS,
          subject: "Your LeCoursville password reset link",
          text,
          html,
          kind: "recovery_link",
          link,
        });
        emailed = true;
        if (auditId) {
          await getDatabase()
            .ref(`recoveryAudit/${auditId}`)
            .update({ emailStatus: "sent" });
        }
      } catch (err) {
        if (auditId) {
          await getDatabase()
            .ref(`recoveryAudit/${auditId}`)
            .update({ emailStatus: "failed", emailError: (err as Error).message });
        }
      }
    } else if (auditId) {
      await getDatabase()
        .ref(`recoveryAudit/${auditId}`)
        .update({ emailStatus: "skipped" });
    }

    return { ok: true, link, emailed };
  }
);
