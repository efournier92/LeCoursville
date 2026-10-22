import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

vi.mock("firebase-admin/auth", async () => {
  const { authMock } = await import("./test-support");
  return { getAuth: () => authMock };
});

vi.mock("./helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./helpers")>();
  return {
    ...actual,
    sendEmail: vi.fn(actual.sendEmail),
    writeAudit: vi.fn(actual.writeAudit),
    compareAndSet: vi.fn(actual.compareAndSet),
  };
});

import { adminGenerateResetLink } from "./admin-generate-reset-link";
import { compareAndSet, sendEmail, writeAudit } from "./helpers";
import { authMock, fakeDb, resetFakeState } from "./test-support";

const adminAuth = {
  uid: "admin-1",
  token: { email: "admin@example.com" },
  rawToken: "token",
};

function invoke(data: Record<string, unknown>, auth: unknown = adminAuth) {
  return adminGenerateResetLink.run({ data, auth, rawRequest: {} } as never);
}

async function seedSuper(uid = "admin-1") {
  await fakeDb.ref(`users/${uid}/roles/super`).set(true);
}

async function seedRequest(id: string, value: Record<string, unknown>) {
  await fakeDb.ref(`recoveryRequests/${id}`).set({
    id,
    status: "open",
    createdAt: 1,
    updatedAt: 1,
    ...value,
  });
}

function auditEntries(): Array<Record<string, unknown>> {
  const raw = (fakeDb.store["recoveryAudit"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  return Object.values(raw);
}

const validData = {
  requestId: "req-1",
  email: "user@example.com",
  reason: "user locked out",
  continueUrl: "https://lecoursville.com/auth/action",
};

describe("adminGenerateResetLink", () => {
  beforeEach(() => {
    resetFakeState();
  });

  it("rejects an unauthenticated caller", async () => {
    await expect(invoke(validData, null)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects a caller without the super role", async () => {
    await expect(invoke(validData)).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects a request-less mint", async () => {
    await seedSuper();
    await expect(invoke({ ...validData, requestId: "" })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects a missing request record", async () => {
    await seedSuper();
    await expect(invoke(validData)).rejects.toMatchObject({ code: "not-found" });
  });

  it("rejects when the payload email differs from the request email", async () => {
    await seedSuper();
    await seedRequest("req-1", { email: "other@example.com" });
    await expect(invoke(validData)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects an already-handled request", async () => {
    await seedSuper();
    await seedRequest("req-1", { email: "user@example.com", status: "closed" });
    await expect(invoke(validData)).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("rejects a malformed alternate contact before minting", async () => {
    await seedSuper();
    await seedRequest("req-1", {
      email: "user@example.com",
      alternateContact: "not-an-email@bad",
    });
    await expect(invoke(validData)).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(auditEntries()).toHaveLength(0);
  });

  it("reports a missing auth user, audits the failure, and reopens the request", async () => {
    await seedSuper();
    await seedRequest("req-1", { email: "user@example.com" });

    await expect(invoke(validData)).rejects.toMatchObject({ code: "not-found" });

    const request = fakeDb.read("recoveryRequests/req-1") as Record<string, unknown>;
    expect(request.status).toBe("open");
    expect(auditEntries().map((entry) => entry.action)).toContain(
      "generate_reset_link_failed"
    );
    expect(fakeDb.read("outboundEmails")).toBeNull();
  });

  it("mints for an admin, resolves the request, and audits the send", async () => {
    await seedSuper();
    await seedRequest("req-1", {
      email: "user@example.com",
      alternateContact: "alt@example.com",
    });
    authMock.users.set("user@example.com", { uid: "user-1" });

    const result = await invoke({ ...validData, emailAlternateContact: true });

    expect(result).toMatchObject({ ok: true, emailed: true });
    const request = fakeDb.read("recoveryRequests/req-1") as Record<string, unknown>;
    expect(request.status).toBe("resolved");
    const audit = auditEntries().find((entry) => entry.action === "generate_reset_link");
    expect(audit).toMatchObject({ emailStatus: "sent", targetUid: "user-1", emailed: true });
    expect(fakeDb.read("outboundEmails")).not.toBeNull();
  });

  it("returns the link without emailing the requester-supplied alternate contact", async () => {
    await seedSuper();
    await seedRequest("req-1", {
      email: "user@example.com",
      alternateContact: "attacker@example.com",
    });
    authMock.users.set("user@example.com", { uid: "user-1" });

    const result = await invoke(validData);

    expect(result).toMatchObject({ ok: true, emailed: false });
    expect(String((result as { link: string }).link)).toContain("oobCode");
    expect(fakeDb.read("outboundEmails")).toBeNull();
    const audit = auditEntries().find((entry) => entry.action === "generate_reset_link");
    expect(audit).toMatchObject({ emailStatus: "skipped", emailed: false });
  });

  it("keeps the audit trail when the alternate-address email fails", async () => {
    await seedSuper();
    await seedRequest("req-1", {
      email: "user@example.com",
      alternateContact: "alt@example.com",
    });
    authMock.users.set("user@example.com", { uid: "user-1" });
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend down"));

    const result = await invoke({ ...validData, emailAlternateContact: true });

    expect(result).toMatchObject({ ok: true, emailed: false });
    const request = fakeDb.read("recoveryRequests/req-1") as Record<string, unknown>;
    expect(request.status).toBe("resolved");
    const audit = auditEntries().find((entry) => entry.action === "generate_reset_link");
    expect(audit).toMatchObject({
      emailStatus: "failed",
      emailed: false,
      emailError: "resend down",
    });
  });

  it("throws resource-exhausted and audits when the actor cap is reached", async () => {
    await seedSuper();
    await fakeDb
      .ref("rateLimits/adminResetLinks/admin-1")
      .set({ windowStart: Date.now(), count: 20 });

    await expect(invoke(validData)).rejects.toMatchObject({
      code: "resource-exhausted",
    });
    expect(auditEntries().map((entry) => entry.action)).toContain(
      "rate_limit_breach"
    );
  });

  it("writes one breach audit under sustained admin blocking", async () => {
    await seedSuper();
    await fakeDb
      .ref("rateLimits/adminResetLinks/admin-1")
      .set({ windowStart: Date.now(), count: 20 });

    for (let i = 0; i < 3; i++) {
      await expect(invoke(validData)).rejects.toMatchObject({
        code: "resource-exhausted",
      });
    }

    expect(
      auditEntries().filter((entry) => entry.action === "rate_limit_breach")
    ).toHaveLength(1);
  });

  it("rejects a plain admin caller", async () => {
    await fakeDb.ref("users/admin-1/roles/admin").set(true);
    await expect(invoke(validData)).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("re-locks a stale pending request abandoned by a crashed mint", async () => {
    await seedSuper();
    await seedRequest("req-1", {
      email: "user@example.com",
      status: "pending",
      resolvedBy: "admin-2",
      updatedAt: Date.now() - 11 * 60 * 1000,
    });
    authMock.users.set("user@example.com", { uid: "user-1" });

    const result = await invoke(validData);

    expect(result).toMatchObject({ ok: true });
    const request = fakeDb.read("recoveryRequests/req-1") as Record<string, unknown>;
    expect(request.status).toBe("resolved");
  });

  it("refuses to steal a fresh pending lock", async () => {
    await seedSuper();
    await seedRequest("req-1", {
      email: "user@example.com",
      status: "pending",
      resolvedBy: "admin-2",
      updatedAt: Date.now(),
    });
    authMock.users.set("user@example.com", { uid: "user-1" });

    await expect(invoke(validData)).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("still returns the minted link when the audit write fails", async () => {
    await seedSuper();
    await seedRequest("req-1", {
      email: "user@example.com",
      alternateContact: "alt@example.com",
    });
    authMock.users.set("user@example.com", { uid: "user-1" });
    vi.mocked(writeAudit).mockRejectedValueOnce(new Error("audit down"));

    const result = await invoke({ ...validData, emailAlternateContact: true });

    expect(result).toMatchObject({ ok: true, emailed: true });
    expect(String((result as { link: string }).link)).toContain("oobCode");
    const request = fakeDb.read("recoveryRequests/req-1") as Record<string, unknown>;
    expect(request.status).toBe("resolved");
    expect(request.auditFailed).toBe(true);
    const alerts = Object.values(
      (fakeDb.store["adminAlerts"] ?? {}) as Record<string, Record<string, unknown>>
    );
    expect(alerts.some((alert) => alert.type === "audit_failure")).toBe(true);
  });

  it("records a resolve race but still returns the minted link", async () => {
    await seedSuper();
    await seedRequest("req-1", {
      email: "user@example.com",
      alternateContact: "alt@example.com",
    });
    authMock.users.set("user@example.com", { uid: "user-1" });
    const actual = await vi.importActual<typeof import("./helpers")>("./helpers");
    const cas = vi.mocked(compareAndSet);
    // First call (lock) commits for real; second (resolve) reports the race.
    cas.mockImplementationOnce(actual.compareAndSet);
    cas.mockImplementationOnce(async () => ({ committed: false, value: null }));

    const result = await invoke(validData);

    expect(result).toMatchObject({ ok: true });
    expect(String((result as { link: string }).link)).toContain("oobCode");
    expect(auditEntries().map((entry) => entry.action)).toContain(
      "generate_reset_link_resolve_raced"
    );
  });
});
