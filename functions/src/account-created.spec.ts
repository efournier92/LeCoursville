import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

vi.mock("./helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./helpers")>();
  return { ...actual, sendEmail: vi.fn(actual.sendEmail) };
});

import { onAccountCreated } from "./account-created";
import { sendEmail } from "./helpers";
import { fakeDb, resetFakeState } from "./test-support";

function eventFor(uid: string, value: unknown) {
  return { data: { val: () => value }, params: { uid } } as never;
}

function outboundEmails(): Array<Record<string, unknown>> {
  const raw = (fakeDb.store["outboundEmails"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  return Object.values(raw);
}

describe("onAccountCreated", () => {
  beforeEach(() => {
    resetFakeState();
    vi.mocked(sendEmail).mockClear();
  });

  it("notifies the owner about a new account under dry-run", async () => {
    await onAccountCreated.run(
      eventFor("u1", { email: "new@example.com", name: "New User", roles: { user: true } })
    );

    const emails = outboundEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      kind: "account_created",
      to: "eric@lecoursville.com",
    });
    expect(String(emails[0].subject)).toContain("new@example.com");

    const audits = Object.values(
      (fakeDb.store["recoveryAudit"] ?? {}) as Record<string, Record<string, unknown>>
    );
    expect(audits[0]).toMatchObject({ action: "account_created_notified", uid: "u1" });
  });

  it("does not grant roles/user to a new signup", async () => {
    await onAccountCreated.run(
      eventFor("u1", { email: "new@example.com", name: "New User" })
    );

    expect(fakeDb.read("users/u1/roles/user")).toBeNull();
    const emails = outboundEmails();
    expect(emails[0]).toMatchObject({ to: "eric@lecoursville.com" });
    expect(String(emails[0].text)).toContain("Status: pending approval");
  });

  it("does nothing for an empty record", async () => {
    await onAccountCreated.run(eventFor("u1", null));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rethrows on send failure, dead-letters it, and keeps the window open", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend down"));

    await expect(
      onAccountCreated.run(eventFor("u1", { email: "new@example.com" }))
    ).rejects.toThrow("resend down");

    expect(fakeDb.read("rateLimits/accountCreatedNotify/u1")).toBeNull();
    const audits = Object.values(
      (fakeDb.store["recoveryAudit"] ?? {}) as Record<string, Record<string, unknown>>
    );
    expect(audits[0]).toMatchObject({ action: "account_created_notify_failed" });
  });

  it("skips a record whose name carries control characters", async () => {
    await onAccountCreated.run(
      eventFor("u1", { email: "new@example.com", name: "Bad\r\nName" })
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("notifies at most once per account per day", async () => {
    const record = { email: "new@example.com", name: "New User" };
    await onAccountCreated.run(eventFor("u1", record));
    await onAccountCreated.run(eventFor("u1", record));

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
