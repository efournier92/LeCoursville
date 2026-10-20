import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

import { actorHashFromRequest, emailHash } from "./helpers";
import { submitRecoveryRequest } from "./submit-recovery-request";
import { fakeDb, resetFakeState } from "./test-support";

function invoke(
  data: Record<string, unknown>,
  rawRequest: Record<string, unknown> = {},
  auth: Record<string, unknown> | null = null
) {
  return submitRecoveryRequest.run({ data, rawRequest, auth } as never);
}

function records(node: string): Array<Record<string, unknown>> {
  const raw = (fakeDb.store[node] ?? {}) as Record<string, Record<string, unknown>>;
  return Object.values(raw);
}

const validData = {
  email: "locked@example.com",
  name: "Locked User",
  message: "I cannot sign in.",
};

describe("submitRecoveryRequest", () => {
  beforeEach(() => {
    resetFakeState();
  });

  it("accepts a request without an alternate contact and writes both nodes", async () => {
    const result = await invoke(validData);

    expect(result).toEqual({ ok: true });
    expect(records("recoveryRequests")).toHaveLength(1);
    expect(records("recoveryRequests")[0]).toMatchObject({
      email: "locked@example.com",
      alternateContact: null,
      status: "open",
    });
    expect(records("adminAlerts")).toHaveLength(1);
  });

  it("accepts a valid email alternate contact", async () => {
    const result = await invoke({ ...validData, alternateContact: "alt@example.com" });
    expect(result).toMatchObject({ ok: true });
    expect(records("recoveryRequests")[0].alternateContact).toBe("alt@example.com");
  });

  it("accepts a phone alternate contact", async () => {
    const result = await invoke({ ...validData, alternateContact: "+1 555 0100" });
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects a malformed email alternate contact and writes nothing", async () => {
    await expect(
      invoke({ ...validData, alternateContact: "not-an-email@bad" })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(records("recoveryRequests")).toHaveLength(0);
    expect(records("adminAlerts")).toHaveLength(0);
  });

  it("rejects missing required fields", async () => {
    await expect(invoke({ email: "locked@example.com", name: "" })).rejects.toMatchObject(
      { code: "invalid-argument" }
    );
  });

  it("rejects a name carrying control characters and writes nothing", async () => {
    await expect(
      invoke({ ...validData, name: "Locked\r\nBcc: victim@example.com" })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(invoke({ ...validData, name: "Locked\u0007User" })).rejects.toMatchObject(
      { code: "invalid-argument" }
    );
    expect(records("recoveryRequests")).toHaveLength(0);
    expect(records("adminAlerts")).toHaveLength(0);
  });

  it("returns generic success and writes nothing past the rate cap", async () => {
    await fakeDb
      .ref(`rateLimits/recoveryRequests/${emailHash("locked@example.com")}`)
      .set({ windowStart: Date.now(), count: 3 });

    const result = await invoke(validData);

    expect(result).toEqual({ ok: true });
    expect(records("recoveryRequests")).toHaveLength(0);
    expect(records("adminAlerts")).toHaveLength(0);
  });

  it("returns the same shape as an accept past the global cap", async () => {
    await fakeDb
      .ref("rateLimits/recoveryRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 60 });

    const capped = await invoke(validData);

    expect(capped).toEqual({ ok: true });
    expect(records("recoveryRequests")).toHaveLength(0);
  });

  it("throttles the recovery_request alert per window without blocking the write", async () => {
    await fakeDb
      .ref("rateLimits/recoveryAlerts/global")
      .set({ windowStart: Date.now(), count: 25 });

    const result = await invoke(validData);

    expect(result).toEqual({ ok: true });
    expect(records("recoveryRequests")).toHaveLength(1);
    expect(records("adminAlerts")).toHaveLength(0);
  });

  it("writes one audit per window under sustained per-actor blocking", async () => {
    const rawRequest = { headers: { "x-forwarded-for": "198.51.100.9" } };
    const actor = actorHashFromRequest(rawRequest);
    await fakeDb
      .ref(`rateLimits/recoveryRequestsIp/${actor}`)
      .set({ windowStart: Date.now(), count: 20 });

    for (let i = 0; i < 4; i++) {
      expect(await invoke(validData, rawRequest)).toEqual({ ok: true });
    }

    expect(records("recoveryAudit")).toHaveLength(1);
  });

  it("blocks the per-actor cap and audits with hashed keys only", async () => {
    const rawRequest = { headers: { "x-forwarded-for": "198.51.100.9" } };
    const actor = actorHashFromRequest(rawRequest);
    await fakeDb
      .ref(`rateLimits/recoveryRequestsIp/${actor}`)
      .set({ windowStart: Date.now(), count: 20 });

    const result = await invoke(validData, rawRequest);

    expect(result).toEqual({ ok: true });
    expect(records("recoveryRequests")).toHaveLength(0);
    expect(records("adminAlerts")).toHaveLength(0);
    expect(records("recoveryAudit")).toHaveLength(1);
    expect(records("recoveryAudit")[0]).toMatchObject({
      action: "rate_limit_breach",
      function: "submitRecoveryRequest",
      layer: "ip",
      actorHash: actor,
    });
    expect(JSON.stringify(fakeDb.store["recoveryAudit"])).not.toContain(
      "198.51.100.9"
    );
    expect(JSON.stringify(fakeDb.store["recoveryAudit"])).not.toContain(
      validData.email
    );
  });

  it("deduplicates an identical resubmit so no second request or alert is written", async () => {
    await invoke(validData);
    await invoke(validData);

    expect(records("recoveryRequests")).toHaveLength(1);
    expect(records("adminAlerts")).toHaveLength(1);
  });

  it("does not burn the rate-limit budget on a deduped resubmit", async () => {
    await invoke(validData);
    const key = `rateLimits/recoveryRequests/${emailHash(validData.email)}`;
    expect((fakeDb.read(key) as { count: number }).count).toBe(1);

    await invoke(validData);

    expect((fakeDb.read(key) as { count: number }).count).toBe(1);
  });

  it("accepts a fresh request once the prior one reached a terminal state", async () => {
    await invoke(validData);
    const [first] = records("recoveryRequests");
    await fakeDb
      .ref(`recoveryRequests/${first.id}`)
      .set({ ...first, status: "closed" });

    await invoke(validData);

    expect(records("recoveryRequests")).toHaveLength(2);
  });

  it("marks the request when the alert cap suppresses the notification", async () => {
    await fakeDb
      .ref("rateLimits/recoveryAlerts/global")
      .set({ windowStart: Date.now(), count: 25 });

    await invoke(validData);

    expect(records("recoveryRequests")[0]).toMatchObject({ alertSuppressed: true });
    expect(records("adminAlerts")).toHaveLength(0);
  });

  it("records alertSuppressed false when the alert is sent", async () => {
    await invoke(validData);

    expect(records("recoveryRequests")[0]).toMatchObject({ alertSuppressed: false });
  });

  it("does not burn the per-email or per-actor counters when the global layer denies", async () => {
    await fakeDb
      .ref("rateLimits/recoveryRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 60 });
    const rawRequest = { headers: { "x-forwarded-for": "198.51.100.9" } };
    const actor = actorHashFromRequest(rawRequest);

    await invoke(validData, rawRequest);

    expect(
      fakeDb.read(`rateLimits/recoveryRequests/${emailHash(validData.email)}`)
    ).toBeNull();
    expect(fakeDb.read(`rateLimits/recoveryRequestsIp/${actor}`)).toBeNull();
  });

  it("records who was turned away when the global cap denies the call", async () => {
    await fakeDb
      .ref("rateLimits/recoveryRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 60 });

    await invoke(validData);

    const denied = records("recoveryAudit").filter(
      (entry) => entry.action === "recovery_attempt_denied"
    );
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({
      function: "submitRecoveryRequest",
      layer: "global",
      targetEmail: validData.email,
      email: validData.email,
      name: validData.name,
      actorUid: null,
    });
  });

  it("captures the alternate contact and signed-in uid on a global-cap turn-away", async () => {
    await fakeDb
      .ref("rateLimits/recoveryRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 60 });

    await invoke({ ...validData, alternateContact: "backup@example.com" }, {}, { uid: "u-9" });

    const denied = records("recoveryAudit").find(
      (entry) => entry.action === "recovery_attempt_denied"
    );
    expect(denied).toMatchObject({
      targetEmail: validData.email,
      email: validData.email,
      name: validData.name,
      alternateContact: "backup@example.com",
      actorUid: "u-9",
    });
  });

  it("bounds the turned-away log per email", async () => {
    await fakeDb
      .ref("rateLimits/recoveryRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 60 });

    for (let i = 0; i < 4; i++) {
      await invoke(validData);
    }

    const denied = records("recoveryAudit").filter(
      (entry) => entry.action === "recovery_attempt_denied"
    );
    expect(denied).toHaveLength(2);
  });

  it("signals the owner once when the turn-away log is full", async () => {
    await fakeDb
      .ref("rateLimits/recoveryRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 60 });
    await fakeDb
      .ref("rateLimits/recoveryDeniedLogGlobal/global")
      .set({ windowStart: Date.now(), count: 50 });

    await invoke(validData);
    await invoke(validData);

    const capped = records("recoveryAudit").filter(
      (entry) => entry.action === "recovery_denied_log_capped"
    );
    expect(capped).toHaveLength(1);
    const alerts = records("adminAlerts").filter(
      (alert) => alert.title === "Recovery turn-away log is full"
    );
    expect(alerts).toHaveLength(1);
  });
});
