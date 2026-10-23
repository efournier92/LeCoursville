import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

import { updateAlertRecipients } from "./update-alert-recipients";
import { fakeDb, resetFakeState } from "./test-support";

const adminAuth = {
  uid: "admin-1",
  token: { email: "admin@example.com" },
  rawToken: "token",
};

function invoke(emails: unknown, auth: unknown = adminAuth) {
  return updateAlertRecipients.run({
    data: { emails },
    auth,
    rawRequest: {},
  } as never);
}

async function seedRoles(uid: string, roles: Record<string, boolean>) {
  await fakeDb.ref(`users/${uid}/roles`).set({ user: true, ...roles });
}

function auditEntries(): Array<Record<string, unknown>> {
  const raw = (fakeDb.store["recoveryAudit"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  return Object.values(raw);
}

const twentyFive = Array.from(
  { length: 25 },
  (_, index) => `person-${index}@example.com`
);

describe("updateAlertRecipients", () => {
  beforeEach(async () => {
    resetFakeState();
    await seedRoles("admin-1", { admin: true });
  });

  it("rejects a caller with no auth", async () => {
    await expect(invoke(["admin@example.com"], null)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("denies a plain user", async () => {
    await seedRoles("user-1", {});

    await expect(
      invoke(["admin@example.com"], { uid: "user-1", token: {} })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("denies a super without the admin role", async () => {
    await seedRoles("super-1", { super: true });

    await expect(
      invoke(["admin@example.com"], { uid: "super-1", token: {} })
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(fakeDb.read("config/adminAlertRecipients")).toBe(null);
    expect(auditEntries()).toHaveLength(0);
  });

  it("rejects a non-array emails value", async () => {
    await expect(invoke("admin@example.com")).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects the twenty-sixth recipient and stores nothing", async () => {
    await expect(
      invoke([...twentyFive, "person-25@example.com"])
    ).rejects.toMatchObject({ code: "invalid-argument" });

    expect(fakeDb.read("config/adminAlertRecipients")).toBe(null);
    expect(auditEntries()).toHaveLength(0);
  });

  it("accepts twenty-five recipients", async () => {
    await expect(invoke(twentyFive)).resolves.toEqual({ ok: true });

    expect(fakeDb.read("config/adminAlertRecipients")).toEqual(twentyFive);
    expect(auditEntries()).toHaveLength(1);
  });

  it("rejects entries that are not valid emails after trimming", async () => {
    await expect(
      invoke(["  not-an-email  ", "person@example.com"])
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      invoke(["no-at-sign", "person@example.com"])
    ).rejects.toMatchObject({ code: "invalid-argument" });

    expect(fakeDb.read("config/adminAlertRecipients")).toBe(null);
    expect(auditEntries()).toHaveLength(0);
  });

  it("clears the stored list when no recipients are supplied", async () => {
    await fakeDb.ref("config/adminAlertRecipients").set(["old@example.com"]);

    await expect(invoke([])).resolves.toEqual({ ok: true });

    expect(fakeDb.read("config/adminAlertRecipients")).toBe(null);
    expect(auditEntries()).toMatchObject([
      { action: "update_recipients", actorUid: "admin-1" },
    ]);
  });

  it("stores trimmed lowercase emails and audits the actor", async () => {
    await expect(
      invoke(["  Admin@Example.COM ", "Second@Example.com"])
    ).resolves.toEqual({ ok: true });

    expect(fakeDb.read("config/adminAlertRecipients")).toEqual([
      "admin@example.com",
      "second@example.com",
    ]);
    const audits = auditEntries();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "update_recipients",
      actorUid: "admin-1",
      actorEmail: "admin@example.com",
    });
  });
});
