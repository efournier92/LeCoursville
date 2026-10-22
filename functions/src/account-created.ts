import { getDatabase } from "firebase-admin/database";
import { onValueCreated } from "firebase-functions/v2/database";
import { ALERTS_FROM, OWNER_ALERT_ADDRESS, REGION, RESEND_API_KEY } from "./config";
import { checkRateLimit, escapeHtml, rateLimit, sendEmail, writeAudit } from "./helpers";

// Control characters would forge line breaks in the subject and body.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const NOTIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

interface UserRecord {
  email?: string;
  name?: string;
  roles?: Record<string, unknown>;
}

function trueRoles(roles: Record<string, unknown> | undefined): string {
  if (!roles) {
    return "none";
  }
  const active = Object.keys(roles).filter((key) => roles[key] === true);
  return active.length > 0 ? active.join(", ") : "none";
}

/**
 * Detective control for the accepted Google self-provisioning risk (C-40):
 * every first-time `users/{uid}` creation notifies the owner in real time.
 * Not preventive, so a stranger still holds read access until a human reacts.
 *
 * Also the watchdog for server-side membership: if signup's claimMemberRole
 * call never lands, this stamps `roles/user` before anything can read it.
 */
export const onAccountCreated = onValueCreated(
  {
    region: REGION,
    ref: "/users/{uid}",
    secrets: [RESEND_API_KEY],
    retry: true,
  },
  async (event) => {
    const uid = event.params.uid;
    const user = event.data.val() as UserRecord | null;
    if (!user) {
      return;
    }

    if (user.roles?.user !== true) {
      await getDatabase().ref(`users/${uid}/roles/user`).set(true);
      user.roles = { ...(user.roles ?? {}), user: true };
    }

    const email = String(user.email ?? "").trim();
    const name = String(user.name ?? "").trim().slice(0, 200);
    if (CONTROL_CHARS.test(email) || CONTROL_CHARS.test(name)) {
      return;
    }
    // One notification per account per day bounds repeated trigger fires. The
    // window is only consumed after a successful send, so a failed delivery can
    // still be retried by Eventarc within the window.
    if (!(await checkRateLimit("accountCreatedNotify", uid, 1, NOTIFY_WINDOW_MS))) {
      return;
    }
    const roles = trueRoles(user.roles);
    const label = (email || name || uid).slice(0, 200);

    const text = [
      "A new LeCoursville account was created.",
      "",
      `Email: ${email || "(none)"}`,
      `Name: ${name || "(none)"}`,
      `Roles: ${roles}`,
      `UID: ${uid}`,
    ].join("\n");
    const html =
      `<p>A new LeCoursville account was created.</p>` +
      `<p>Email: ${escapeHtml(email || "(none)")}</p>` +
      `<p>Name: ${escapeHtml(name || "(none)")}</p>` +
      `<p>Roles: ${escapeHtml(roles)}</p>` +
      `<p>UID: ${escapeHtml(uid)}</p>`;

    try {
      await sendEmail({
        to: OWNER_ALERT_ADDRESS,
        from: ALERTS_FROM,
        subject: `[LeCoursville] New account created: ${label}`,
        text,
        html,
        kind: "account_created",
      });
    } catch (err) {
      // Dead-letter the failure so the C-40 detective control never fails
      // silently, then rethrow so Eventarc retries.
      await writeAudit({
        action: "account_created_notify_failed",
        uid,
        email,
        error: (err as Error).message,
      });
      throw err;
    }

    await rateLimit("accountCreatedNotify", uid, 1, NOTIFY_WINDOW_MS);
    // Durable record for signup-trend visibility (the email itself is ephemeral).
    await writeAudit({ action: "account_created_notified", uid, email });
  }
);
