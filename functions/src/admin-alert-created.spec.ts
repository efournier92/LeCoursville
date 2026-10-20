import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

vi.mock("./helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./helpers")>();
  return { ...actual, sendEmail: vi.fn(actual.sendEmail) };
});

import { onAdminAlertCreated } from "./admin-alert-created";
import { sendEmail } from "./helpers";
import { fakeDb, resetFakeState } from "./test-support";

async function seedAlert(id: string, value: Record<string, unknown> = {}) {
  await fakeDb.ref(`adminAlerts/${id}`).set({
    title: "LeCoursville alert",
    body: "body",
    data: {},
    createdAt: 1,
    createdBy: "system",
    emailStatus: "pending",
    emailError: null,
    recipientCount: 0,
    ...value,
  });
}

function eventFor(id: string) {
  return {
    data: {
      val: () => fakeDb.read(`adminAlerts/${id}`),
    },
    params: { alertId: id },
  } as never;
}

describe("onAdminAlertCreated", () => {
  beforeEach(async () => {
    resetFakeState();
    vi.mocked(sendEmail).mockClear();
    await fakeDb.ref("config/adminAlertRecipients").set(["admin@example.com"]);
  });

  it("marks the alert stubbed and counts recipients under dry-run", async () => {
    await seedAlert("a1");

    await onAdminAlertCreated.run(eventFor("a1"));

    expect(fakeDb.read("adminAlerts/a1")).toMatchObject({
      emailStatus: "stubbed",
      recipientCount: 1,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("records failed and rethrows so Eventarc retries the delivery", async () => {
    await seedAlert("a1");
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend down"));

    await expect(onAdminAlertCreated.run(eventFor("a1"))).rejects.toThrow(
      "resend down"
    );

    expect(fakeDb.read("adminAlerts/a1")).toMatchObject({
      emailStatus: "failed",
      emailError: "resend down",
    });
  });

  it("re-processes a previously failed alert on retry", async () => {
    await seedAlert("a1", { emailStatus: "failed", emailError: "prior" });

    await onAdminAlertCreated.run(eventFor("a1"));

    expect(fakeDb.read("adminAlerts/a1")).toMatchObject({ emailStatus: "stubbed" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("skips recipients already recorded as sent and completes the rest", async () => {
    await fakeDb
      .ref("config/adminAlertRecipients")
      .set(["a@example.com", "b@example.com"]);
    await seedAlert("a1", { emailStatus: "failed", sentTo: ["a@example.com"] });

    await onAdminAlertCreated.run(eventFor("a1"));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({
      to: "b@example.com",
    });
    expect(fakeDb.read("adminAlerts/a1")).toMatchObject({
      emailStatus: "stubbed",
      sentTo: ["a@example.com", "b@example.com"],
    });
  });

  it("collapses newlines in alert values so the text cannot be forged", async () => {
    await seedAlert("a1", { data: { note: "ok\nInjected: admin-approved" } });

    await onAdminAlertCreated.run(eventFor("a1"));

    const raw = (fakeDb.store["outboundEmails"] ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const mail = Object.values(raw)[0];
    expect(String(mail.text)).toContain("note: ok Injected: admin-approved");
    expect(String(mail.text)).not.toContain("ok\nInjected");
  });

  it("skips an alert that already reached a terminal state", async () => {
    await seedAlert("a1", { emailStatus: "sent" });

    await onAdminAlertCreated.run(eventFor("a1"));

    expect(fakeDb.read("adminAlerts/a1")).toMatchObject({ emailStatus: "sent" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
