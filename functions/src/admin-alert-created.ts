import { getDatabase } from "firebase-admin/database";
import { onValueCreated } from "firebase-functions/v2/database";
import { ALERTS_FROM, RESEND_API_KEY, REGION } from "./config";
import { isDryRun, escapeHtml, normalizeRecipients, sendEmail } from "./helpers";

// Collapse control characters and newlines so attacker-supplied values cannot
// forge extra lines in the plain-text alert mail.
function oneLine(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim();
}

interface AlertRecord {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  emailStatus?: string;
  // Per-recipient progress, so a retry after a mid-loop failure resumes
  // instead of re-sending to recipients already notified (C-22/C-56).
  sentTo?: string[];
}

export const onAdminAlertCreated = onValueCreated(
  {
    region: REGION,
    ref: "/adminAlerts/{alertId}",
    secrets: [RESEND_API_KEY],
    // A dropped alert is lost forever unless Eventarc retries the delivery.
    retry: true,
  },
  async (event) => {
    const alert = event.data.val() as AlertRecord | null;
    const alertId = event.params.alertId;
    const db = getDatabase();
    const alertRef = db.ref(`adminAlerts/${alertId}`);

    if (!alert) {
      return;
    }
    // Only terminal states are skipped: a retried delivery leaves "failed"
    // behind, so it must be allowed to run again.
    if (alert.emailStatus === "sent" || alert.emailStatus === "stubbed") {
      return;
    }

    try {
      const recipientsSnap = await db.ref("config/adminAlertRecipients").get();
      let emails = normalizeRecipients(recipientsSnap.val());

      if (emails.length === 0) {
        const usersSnap = await db.ref("users").get();
        const users = (usersSnap.val() ?? {}) as Record<
          string,
          { email?: string; roles?: { admin?: boolean } }
        >;
        emails = normalizeRecipients(
          Object.values(users)
            .filter((record) => record?.roles?.admin === true && !!record?.email)
            .map((record) => String(record.email))
        );
      }

      emails = emails.slice(0, 50);

      const title = alert?.title ?? "LeCoursville alert";
      const body = alert?.body ?? "";
      const data = alert?.data ?? {};
      const subject = `[LeCoursville] ${oneLine(title)}`;
      const details = Object.entries(data)
        .map(([key, value]) => `${key}: ${oneLine(value)}`)
        .join("\n");
      const text = `${oneLine(title)}\n\n${oneLine(body)}${details ? `\n\n${details}` : ""}`;
      const html =
        `<p><strong>${escapeHtml(title)}</strong></p>` +
        `<p>${escapeHtml(body)}</p>` +
        Object.entries(data)
          .map(
            ([key, value]) =>
              `<p>${escapeHtml(key)}: ${escapeHtml(value)}</p>`
          )
          .join("");

      const sentTo = Array.isArray(alert.sentTo) ? [...alert.sentTo] : [];
      for (const to of emails) {
        if (sentTo.includes(to)) {
          continue;
        }
        await sendEmail({
          to,
          from: ALERTS_FROM,
          subject,
          text,
          html,
          kind: "admin_alert",
        });
        // Persist progress after each send so a redelivery resumes here.
        sentTo.push(to);
        await alertRef.update({ sentTo });
      }

      await alertRef.update({
        emailStatus: isDryRun() ? "stubbed" : "sent",
        recipientCount: emails.length,
        emailError: null,
      });
    } catch (err) {
      // Record the durable dead-letter state, then rethrow so Eventarc retries
      // the delivery instead of treating the failure as success.
      await alertRef.update({
        emailStatus: "failed",
        emailError: (err as Error).message,
      });
      throw err;
    }
  }
);
