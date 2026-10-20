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
  return { ...actual, sendEmail: vi.fn(actual.sendEmail) };
});

import { actorHashFromRequest, emailHash, sendEmail } from "./helpers";
import { requestPasswordReset } from "./request-password-reset";
import { authMock, fakeDb, resetFakeState } from "./test-support";

const continueUrl = "https://lecoursville.com/auth/action";

function invoke(
  data: Record<string, unknown>,
  rawRequest: Record<string, unknown> = {}
) {
  return requestPasswordReset.run({ data, rawRequest } as never);
}

function outboundEmails(): Array<Record<string, unknown>> {
  const raw = (fakeDb.store["outboundEmails"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  return Object.values(raw);
}

function nodeEntries(node: string): Array<Record<string, unknown>> {
  const raw = (fakeDb.store[node] ?? {}) as Record<string, Record<string, unknown>>;
  return Object.values(raw);
}

function notFound(): Error & { code?: string } {
  const err = new Error("no user record") as Error & { code?: string };
  err.code = "auth/user-not-found";
  return err;
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    resetFakeState();
  });

  it("sends for a known account and stubs the email in dry-run", async () => {
    const result = await invoke({ email: "known@example.com", continueUrl });

    expect(result).toEqual({ ok: true });
    const emails = outboundEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: "known@example.com",
      kind: "password_reset",
    });
    expect(String(emails[0].link)).toContain("/auth/action");
  });

  it("returns generic success and sends nothing for an unknown account", async () => {
    authMock.linkError = notFound();

    const result = await invoke({ email: "unknown@example.com", continueUrl });

    expect(result).toEqual({ ok: true });
    expect(outboundEmails()).toHaveLength(0);
  });

  it("rejects malformed input with invalid-argument", async () => {
    await expect(invoke({ email: "not-an-email", continueUrl })).rejects.toMatchObject(
      { code: "invalid-argument" }
    );
    await expect(
      invoke({ email: "user@example.com", continueUrl: "https://evil.example.com/auth/action" })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("blocks the sixth per-email request in the window with generic success", async () => {
    await fakeDb
      .ref(`rateLimits/resetRequests/${emailHash("user@example.com")}`)
      .set({ windowStart: Date.now(), count: 5 });

    const result = await invoke({ email: "user@example.com", continueUrl });

    expect(result).toEqual({ ok: true });
    expect(outboundEmails()).toHaveLength(0);
  });

  it("blocks once the global window cap is reached with generic success", async () => {
    await fakeDb
      .ref("rateLimits/resetRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 200 });

    const result = await invoke({ email: "user@example.com", continueUrl });

    expect(result).toEqual({ ok: true });
    expect(outboundEmails()).toHaveLength(0);
  });

  it("allows up to the per-actor cap and blocks the next request", async () => {
    const rawRequest = { headers: { "x-forwarded-for": "203.0.113.7" } };
    const actor = actorHashFromRequest(rawRequest);
    expect(actor).toBeTruthy();

    await fakeDb
      .ref(`rateLimits/resetRequestsIp/${actor}`)
      .set({ windowStart: Date.now(), count: 19 });
    const allowed = await invoke(
      { email: "actor-allowed@example.com", continueUrl },
      rawRequest
    );
    expect(allowed).toEqual({ ok: true });
    expect(outboundEmails()).toHaveLength(1);

    await fakeDb
      .ref(`rateLimits/resetRequestsIp/${actor}`)
      .set({ windowStart: Date.now(), count: 20 });
    const blocked = await invoke(
      { email: "actor-blocked@example.com", continueUrl },
      rawRequest
    );
    expect(blocked).toEqual({ ok: true });
    expect(outboundEmails()).toHaveLength(1);
  });

  it("writes one audit and raises exactly one throttled alert per global window", async () => {
    await fakeDb
      .ref("rateLimits/resetRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 200 });

    const first = await invoke({ email: "global-one@example.com", continueUrl });

    expect(first).toEqual({ ok: true });
    expect(outboundEmails()).toHaveLength(0);
    expect(nodeEntries("recoveryAudit")).toHaveLength(1);
    expect(nodeEntries("recoveryAudit")[0]).toMatchObject({
      action: "rate_limit_breach",
      layer: "global",
    });
    expect(nodeEntries("adminAlerts")).toHaveLength(1);
    expect(nodeEntries("adminAlerts")[0]).toMatchObject({
      data: { layer: "global" },
    });
    expect(JSON.stringify(fakeDb.store["recoveryAudit"])).not.toContain(
      "global-one@example.com"
    );

    // A second trip in the same window must not re-alert or re-audit.
    const second = await invoke({ email: "global-two@example.com", continueUrl });
    expect(second).toEqual({ ok: true });
    expect(nodeEntries("adminAlerts")).toHaveLength(1);
    expect(nodeEntries("recoveryAudit")).toHaveLength(1);
  });

  it("writes one audit per window under sustained global blocking", async () => {
    await fakeDb
      .ref("rateLimits/resetRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 200 });

    for (let i = 0; i < 4; i++) {
      expect(await invoke({ email: `flood-${i}@example.com`, continueUrl })).toEqual({
        ok: true,
      });
    }

    expect(nodeEntries("recoveryAudit")).toHaveLength(1);
    expect(nodeEntries("adminAlerts")).toHaveLength(1);
  });

  it("skips the per-actor layer when no actor is derivable but keeps enforcing email and global", async () => {
    const email = "secret-actor-probe@example.com";
    await fakeDb
      .ref(`rateLimits/resetRequests/${emailHash(email)}`)
      .set({ windowStart: Date.now(), count: 5 });

    const result = await invoke({ email, continueUrl });

    expect(result).toEqual({ ok: true });
    expect(outboundEmails()).toHaveLength(0);
    expect(fakeDb.read("rateLimits/resetRequestsIp")).toBeNull();
    // The victim-email cap stays silent so it cannot be weaponized into an
    // audit-flood against the recoveryAudit node.
    expect(fakeDb.store["recoveryAudit"]).toBeUndefined();

    await fakeDb
      .ref("rateLimits/resetRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 200 });
    const global = await invoke({ email, continueUrl });

    expect(global).toEqual({ ok: true });
    expect(nodeEntries("recoveryAudit")).toHaveLength(1);
    expect(nodeEntries("recoveryAudit")[0]).toMatchObject({
      layer: "global",
      actorHash: null,
    });
    expect(JSON.stringify(fakeDb.store["recoveryAudit"])).not.toContain(email);
    expect(nodeEntries("adminAlerts")).toHaveLength(1);
    expect(JSON.stringify(fakeDb.store["adminAlerts"])).not.toContain(email);
  });

  it("records a successful send in the audit without storing the raw address", async () => {
    await invoke({ email: "known@example.com", continueUrl });

    const audits = nodeEntries("recoveryAudit");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "password_reset_email",
      emailStatus: "sent",
      emailError: null,
    });
    expect(JSON.stringify(fakeDb.store["recoveryAudit"])).not.toContain(
      "known@example.com"
    );
  });

  it("records a failed send in the audit and still returns generic success", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend down"));

    const result = await invoke({ email: "known@example.com", continueUrl });

    expect(result).toEqual({ ok: true });
    const audits = nodeEntries("recoveryAudit");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "password_reset_email",
      emailStatus: "failed",
      emailError: "resend down",
    });
  });

  it("audits the per-actor breach when the ip layer denies", async () => {
    const rawRequest = { headers: { "x-forwarded-for": "203.0.113.7" } };
    const actor = actorHashFromRequest(rawRequest);
    await fakeDb
      .ref(`rateLimits/resetRequestsIp/${actor}`)
      .set({ windowStart: Date.now(), count: 20 });

    const result = await invoke({ email: "victim@example.com", continueUrl }, rawRequest);

    expect(result).toEqual({ ok: true });
    const audits = nodeEntries("recoveryAudit");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "rate_limit_breach",
      function: "requestPasswordReset",
      layer: "ip",
      actorHash: actor,
    });
    expect(JSON.stringify(fakeDb.store["recoveryAudit"])).not.toContain(
      "victim@example.com"
    );
  });

  it("does not commit earlier layers when the global layer denies the call", async () => {
    await fakeDb
      .ref("rateLimits/resetRequestsGlobal/global")
      .set({ windowStart: Date.now(), count: 200 });
    const rawRequest = { headers: { "x-forwarded-for": "203.0.113.7" } };
    const actor = actorHashFromRequest(rawRequest);

    await invoke({ email: "known@example.com", continueUrl }, rawRequest);

    expect(
      fakeDb.read(`rateLimits/resetRequests/${emailHash("known@example.com")}`)
    ).toBeNull();
    expect(fakeDb.read(`rateLimits/resetRequestsIp/${actor}`)).toBeNull();
  });
});
