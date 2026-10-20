import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FROM_ADDRESS, RESEND_API_KEY, REGION } from "./config";
import {
  actorHashFromRequest,
  checkRateLimit,
  emailHash,
  isAllowedContinueUrl,
  isValidEmail,
  rateLimit,
  sendAdminAlert,
  sendEmail,
  throttledAuditRateLimitBreach,
  writeAudit,
} from "./helpers";

const SUBJECT = "Reset your LeCoursville password";
const WINDOW_MS = 60 * 60 * 1000;
const PER_EMAIL_MAX = 5;
// Shared egress IPs (home NAT, offices) would otherwise let one abuser lock
// out every occupant, so the per-actor cap sits well above one person's use.
const PER_ACTOR_MAX = 20;
const GLOBAL_MAX = 200;
// Constant floor on the response so a known address cannot be told apart from
// an unknown one by how long the callable took to answer.
const MIN_RESPONSE_MS = 300;

// Locked-out users must not learn whether an address has an account, so every
// branch resolves the same shape.
export const requestPasswordReset = onCall(
  { region: REGION, cors: true, secrets: [RESEND_API_KEY] },
  async (request) => {
    const startedAt = Date.now();
    const email = String(request.data?.email ?? "").trim().toLowerCase();
    const continueUrl = String(request.data?.continueUrl ?? "");

    if (!isValidEmail(email) || !isAllowedContinueUrl(continueUrl)) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }

    const floor = async (): Promise<void> => {
      const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    };

    const emailKey = emailHash(email);
    const actor = actorHashFromRequest(request.rawRequest);

    const perEmailOk = await checkRateLimit(
      "resetRequests",
      emailKey,
      PER_EMAIL_MAX,
      WINDOW_MS
    );
    const perActorOk = actor
      ? await checkRateLimit("resetRequestsIp", actor, PER_ACTOR_MAX, WINDOW_MS)
      : true;
    const globalOk = await checkRateLimit(
      "resetRequestsGlobal",
      "global",
      GLOBAL_MAX,
      WINDOW_MS
    );

    if (!perEmailOk || !perActorOk || !globalOk) {
      if (!perActorOk) {
        await throttledAuditRateLimitBreach({
          functionName: "requestPasswordReset",
          layer: "ip",
          emailHash: emailKey,
          actorHash: actor,
          windowMs: WINDOW_MS,
        });
      }
      if (!globalOk) {
        await throttledAuditRateLimitBreach({
          functionName: "requestPasswordReset",
          layer: "global",
          emailHash: emailKey,
          actorHash: actor,
          windowMs: WINDOW_MS,
        });
        if (await rateLimit("resetAlertThrottle", "global", 1, WINDOW_MS)) {
          await sendAdminAlert({
            type: "rate_limit_breach",
            title: "Password reset global cap reached",
            body: "The global password reset rate limit was reached; legitimate resets may be denied until the window clears.",
            data: {
              function: "requestPasswordReset",
              layer: "global",
              emailHash: emailKey,
              actorHash: actor,
            },
          });
        }
      }
      await floor();
      return { ok: true };
    }

    // Commit only once every layer would allow: a call denied by a later layer
    // must not burn the earlier counters. Gate on the commit results too, so a
    // concurrent burst that wins the race cannot mint past the cap.
    const emailCommitted = await rateLimit(
      "resetRequests",
      emailKey,
      PER_EMAIL_MAX,
      WINDOW_MS
    );
    const actorCommitted = actor
      ? await rateLimit("resetRequestsIp", actor, PER_ACTOR_MAX, WINDOW_MS)
      : true;
    const globalCommitted = await rateLimit(
      "resetRequestsGlobal",
      "global",
      GLOBAL_MAX,
      WINDOW_MS
    );
    if (!emailCommitted || !actorCommitted || !globalCommitted) {
      await floor();
      return { ok: true };
    }

    let link: string;
    try {
      link = await getAuth().generatePasswordResetLink(email, {
        url: continueUrl,
        handleCodeInApp: true,
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code?.startsWith("auth/") && code.endsWith("not-found")) {
        await floor();
        return { ok: true };
      }
      throw err;
    }

    const text = [
      "Someone requested a password reset for your LeCoursville account.",
      "",
      "Open this link to choose a new password:",
      link,
      "",
      "This link expires in one hour. If you did not request it, ignore this email.",
    ].join("\n");
    const html =
      `<p>Someone requested a password reset for your LeCoursville account.</p>` +
      `<p><a href="${link}">Choose a new password</a></p>` +
      `<p>This link expires in one hour. If you did not request it, ignore this email.</p>`;

    // Await the send so a Resend rejection is recorded rather than dropped by
    // post-response reaping. Email enumeration is handled by the constant
    // response floor and the prod enumeration-protection sign-off (C-42).
    let emailStatus: "sent" | "failed" = "sent";
    let emailError: string | null = null;
    try {
      await sendEmail({
        to: email,
        from: FROM_ADDRESS,
        subject: SUBJECT,
        text,
        html,
        kind: "password_reset",
        link,
      });
    } catch (err) {
      emailStatus = "failed";
      emailError = (err as Error).message;
    }

    try {
      await writeAudit({
        action: "password_reset_email",
        function: "requestPasswordReset",
        emailHash: emailKey,
        emailStatus,
        emailError,
      });
    } catch {
      // An audit outage must never surface as a reset failure.
    }

    await floor();
    return { ok: true };
  }
);
