import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

vi.mock("./helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./helpers")>();
  return { ...actual, writeAudit: vi.fn(actual.writeAudit) };
});

import { closeRecoveryRequest } from "./close-recovery-request";
import { writeAudit } from "./helpers";
import { fakeDb, resetFakeState } from "./test-support";

const adminAuth = {
  uid: "admin-1",
  token: { email: "admin@example.com" },
  rawToken: "token",
};

function invoke(data: Record<string, unknown>, auth: unknown = adminAuth) {
  return closeRecoveryRequest.run({ data, auth, rawRequest: {} } as never);
}

async function seedAdmin(uid = "admin-1") {
  await fakeDb.ref(`users/${uid}/roles/admin`).set(true);
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

describe("closeRecoveryRequest", () => {
  beforeEach(() => {
    resetFakeState();
  });

  it("rejects an unauthenticated caller", async () => {
    await expect(invoke({ requestId: "req-1" }, null)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects a non-admin caller", async () => {
    await expect(invoke({ requestId: "req-1" })).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("closes an open request and audits the close", async () => {
    await seedAdmin();
    await seedRequest("req-1", {});

    await expect(invoke({ requestId: "req-1", reason: "done" })).resolves.toEqual({
      ok: true,
    });

    const request = fakeDb.read("recoveryRequests/req-1") as Record<string, unknown>;
    expect(request).toMatchObject({ status: "closed", closedBy: "admin-1" });
    const audit = Object.values(
      (fakeDb.store["recoveryAudit"] ?? {}) as Record<string, unknown>
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "close_request", requestId: "req-1" });
  });

  it("rejects an already-handled request without auditing", async () => {
    await seedAdmin();
    await seedRequest("req-1", { status: "resolved" });

    await expect(invoke({ requestId: "req-1" })).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(fakeDb.store["recoveryAudit"]).toBeUndefined();
  });

  it("closes a stale pending request left by an abandoned mint", async () => {
    await seedAdmin();
    await seedRequest("req-1", {
      status: "pending",
      resolvedBy: "admin-2",
      updatedAt: Date.now() - 11 * 60 * 1000,
    });

    await expect(invoke({ requestId: "req-1" })).resolves.toEqual({ ok: true });
    const request = fakeDb.read("recoveryRequests/req-1") as Record<string, unknown>;
    expect(request.status).toBe("closed");
  });

  it("refuses a fresh pending lock so a live mint is not interrupted", async () => {
    await seedAdmin();
    await seedRequest("req-1", {
      status: "pending",
      resolvedBy: "admin-2",
      updatedAt: Date.now(),
    });

    await expect(invoke({ requestId: "req-1" })).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("throws resource-exhausted when the actor close cap is reached", async () => {
    await seedAdmin();
    await fakeDb
      .ref("rateLimits/closeRecoveryRequests/admin-1")
      .set({ windowStart: Date.now(), count: 60 });

    await expect(invoke({ requestId: "req-1" })).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });

  it("reopens the request when the close audit write fails", async () => {
    await seedAdmin();
    await seedRequest("req-1", {});
    vi.mocked(writeAudit).mockRejectedValueOnce(new Error("audit down"));

    await expect(invoke({ requestId: "req-1" })).rejects.toThrow("audit down");

    const request = fakeDb.read("recoveryRequests/req-1") as Record<string, unknown>;
    expect(request.status).toBe("open");
  });
});
