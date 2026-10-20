import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import {
  actorHashFromRequest,
  checkRateLimit,
  emailHash,
  hashKey,
  isValidEmail,
  rateLimit,
  sendAdminAlert,
  throttledAuditRateLimitBreach,
  writeAudit,
} from "./helpers";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const PER_EMAIL_MAX = 3;
// Same NAT trade-off as requestPasswordReset: shared egress IPs need headroom.
const PER_ACTOR_MAX = 20;
const GLOBAL_MAX = 60;
// Widest bound on admin alert mail: rotating emails or IPs cannot mail beyond
// this many recovery notices per window.
const ALERT_MAX = 25;
// Control characters would forge line breaks in the alert subject and body.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
// Bounds on the "turned away by the global cap" log so the record cannot itself
// be flooded: at most 2 attempts per email and 50 overall per window.
const DENIED_LOG_PER_EMAIL = 2;
const DENIED_LOG_GLOBAL = 50;

export const submitRecoveryRequest = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const email = String(request.data?.email ?? "").trim().toLowerCase();
    const name = String(request.data?.name ?? "").trim();
    const alternateContact = String(request.data?.alternateContact ?? "").trim();
    const message = String(request.data?.message ?? "").trim();

    if (
      !isValidEmail(email) ||
      name.length === 0 ||
      name.length > 100 ||
      CONTROL_CHARS.test(name) ||
      alternateContact.length > 320 ||
      (alternateContact.includes("@") && !isValidEmail(alternateContact)) ||
      message.length > 500
    ) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }

    const emailKey = emailHash(email);
    const actor = actorHashFromRequest(request.rawRequest);

    // Idempotency first: an identical request that is still active is a no-op
    // and must not burn the rate-limit budget. A request already at a terminal
    // state is not a duplicate, so the caller may ask again under a fresh id.
    const db = getDatabase();
    const payloadKey = hashKey([email, name, alternateContact, message].join("|"));
    const existing = (await db.ref(`recoveryRequests/${payloadKey}`).get()).val() as
      | { status?: string }
      | null;
    if (existing && existing.status !== "closed" && existing.status !== "resolved") {
      return { ok: true };
    }
    const id = existing
      ? (db.ref("recoveryRequests").push().key as string)
      : payloadKey;

    const perEmailOk = await checkRateLimit(
      "recoveryRequests",
      emailKey,
      PER_EMAIL_MAX,
      WINDOW_MS
    );
    const perActorOk = actor
      ? await checkRateLimit("recoveryRequestsIp", actor, PER_ACTOR_MAX, WINDOW_MS)
      : true;
    const globalOk = await checkRateLimit(
      "recoveryRequestsGlobal",
      "global",
      GLOBAL_MAX,
      WINDOW_MS
    );
    if (!perEmailOk || !perActorOk || !globalOk) {
      if (!perActorOk) {
        await throttledAuditRateLimitBreach({
          functionName: "submitRecoveryRequest",
          layer: "ip",
          emailHash: emailKey,
          actorHash: actor,
          windowMs: WINDOW_MS,
        });
      }
      if (!globalOk) {
        await throttledAuditRateLimitBreach({
          functionName: "submitRecoveryRequest",
          layer: "global",
          emailHash: emailKey,
          actorHash: actor,
          windowMs: WINDOW_MS,
        });
        if (await rateLimit("recoveryBreachAlertThrottle", "global", 1, WINDOW_MS)) {
          await sendAdminAlert({
            type: "rate_limit_breach",
            title: "Recovery request global cap reached",
            body: "The global recovery request rate limit was reached; legitimate requests may be denied until the window clears. Check the recovery audit trail for the people who were turned away.",
            data: {
              function: "submitRecoveryRequest",
              layer: "global",
              emailHash: emailKey,
              actorHash: actor,
            },
          });
        }
        // Keep the non-enumerating success response, but record who was turned
        // away so the owner can follow up with a legitimate user the cap
        // blocked. Raw identity here (admin-only, bounded) unlike the hashed
        // per-actor breach audit.
        const perEmailAllowed = await rateLimit(
          "recoveryDeniedLog",
          emailKey,
          DENIED_LOG_PER_EMAIL,
          WINDOW_MS
        );
        const globalAllowed = await rateLimit(
          "recoveryDeniedLogGlobal",
          "global",
          DENIED_LOG_GLOBAL,
          WINDOW_MS
        );
        if (perEmailAllowed && globalAllowed) {
          await writeAudit({
            action: "recovery_attempt_denied",
            function: "submitRecoveryRequest",
            layer: "global",
            // targetEmail is what the admin UI renders, so the locked-out
            // person is identifiable at a glance.
            targetEmail: email,
            email,
            name,
            alternateContact: alternateContact || null,
            actorUid: request.auth?.uid ?? null,
            actorHash: actor,
          });
        } else if (perEmailAllowed && !globalAllowed) {
          // Capture is full for this window: some turn-aways will not be
          // recorded individually. Tell the owner once per window so the
          // truncation is never silent.
          if (await rateLimit("recoveryDeniedCapped", "global", 1, WINDOW_MS)) {
            await writeAudit({
              action: "recovery_denied_log_capped",
              function: "submitRecoveryRequest",
              layer: "global",
              cap: DENIED_LOG_GLOBAL,
            });
            await sendAdminAlert({
              type: "rate_limit_breach",
              title: "Recovery turn-away log is full",
              body: `More than ${DENIED_LOG_GLOBAL} recovery attempts were turned away by the global cap this window; later attempts were not recorded individually. Review the audit trail and consider raising the cap.`,
              data: {
                function: "submitRecoveryRequest",
                layer: "global",
                cap: DENIED_LOG_GLOBAL,
              },
            });
          }
        }
      }
      return { ok: true };
    }

    // Commit every layer only once all of them would allow, so a call denied by
    // a later layer does not burn the earlier counters. Treat a lost race (an
    // aborted commit) as a denial rather than proceeding to write.
    const emailCommitted = await rateLimit(
      "recoveryRequests",
      emailKey,
      PER_EMAIL_MAX,
      WINDOW_MS
    );
    const actorCommitted = actor
      ? await rateLimit("recoveryRequestsIp", actor, PER_ACTOR_MAX, WINDOW_MS)
      : true;
    const globalCommitted = await rateLimit(
      "recoveryRequestsGlobal",
      "global",
      GLOBAL_MAX,
      WINDOW_MS
    );
    if (!emailCommitted || !actorCommitted || !globalCommitted) {
      return { ok: true };
    }

    const now = Date.now();
    // Record whether the alert fan-out was suppressed by the cap, so a burned
    // budget is visible instead of silently dropping the notification (C-43).
    const alertAllowed = await rateLimit("recoveryAlerts", "global", ALERT_MAX, WINDOW_MS);
    const updates: Record<string, unknown> = {
      [`recoveryRequests/${id}`]: {
        id,
        email,
        name,
        alternateContact: alternateContact || null,
        message: message || null,
        status: "open",
        createdAt: now,
        updatedAt: now,
        alertSuppressed: !alertAllowed,
      },
    };

    if (alertAllowed) {
      // Deterministic alert key derived from the request id, so concurrent
      // identical submits converge on one alert instead of duplicating it.
      updates[`adminAlerts/recovery-${id}`] = {
        type: "recovery_request",
        title: "New account recovery request",
        body: `${name} (${email}) requested account recovery.`,
        data: {
          requestId: id,
          email,
          name,
          alternateContact: alternateContact || null,
          message: message || null,
        },
        createdAt: now,
        createdBy: "system",
        emailStatus: "pending",
        emailError: null,
        recipientCount: 0,
      };
    }

    await db.ref().update(updates);

    return { ok: true };
  }
);
