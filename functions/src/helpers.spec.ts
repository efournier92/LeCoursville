import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import {
  actorHashFromRequest,
  checkRateLimit,
  compareAndSet,
  escapeHtml,
  hashKey,
  isAllowedContinueUrl,
  isValidEmail,
  rateLimit,
  sendEmail,
} from "./helpers";
import { fakeDb, resetFakeState } from "./test-support";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb: db } = await import("./test-support");
  return { getDatabase: () => db };
});

describe("isValidEmail", () => {
  it("accepts normal addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("first.last+tag@sub.example.co.uk")).toBe(true);
  });

  it("rejects empty, missing @, missing dotted domain, and whitespace", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("user.example.com")).toBe(false);
    expect(isValidEmail("user@example")).toBe(false);
    expect(isValidEmail("user @example.com")).toBe(false);
    expect(isValidEmail("user@ example.com")).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("neutralizes markup-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"
    );
  });

  it("returns an empty string for null and undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("isAllowedContinueUrl", () => {
  afterEach(() => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.ALLOW_LOCAL_CONTINUE_ORIGINS;
  });

  it("accepts each allowed production origin at the action path", () => {
    expect(isAllowedContinueUrl("https://lecoursville.com/auth/action")).toBe(true);
    expect(
      isAllowedContinueUrl("https://lecoursville.firebaseapp.com/auth/action")
    ).toBe(true);
  });

  it("accepts localhost origins under the emulator or explicit opt-in", () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    expect(isAllowedContinueUrl("http://localhost:5000/auth/action")).toBe(true);
    expect(isAllowedContinueUrl("http://127.0.0.1:5000/auth/action")).toBe(true);

    delete process.env.FUNCTIONS_EMULATOR;
    process.env.ALLOW_LOCAL_CONTINUE_ORIGINS = "1";
    expect(isAllowedContinueUrl("http://localhost:5000/auth/action")).toBe(true);
  });

  it("rejects localhost origins when neither env var is set", () => {
    resetFakeState();
    expect(isAllowedContinueUrl("http://localhost:5000/auth/action")).toBe(false);
    expect(isAllowedContinueUrl("http://127.0.0.1:5000/auth/action")).toBe(false);
  });

  it("rejects a different origin", () => {
    expect(isAllowedContinueUrl("https://evil.example.com/auth/action")).toBe(false);
  });

  it("rejects a non-action path", () => {
    expect(isAllowedContinueUrl("https://lecoursville.com/")).toBe(false);
    expect(isAllowedContinueUrl("https://lecoursville.com/auth/other")).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(isAllowedContinueUrl("not a url")).toBe(false);
  });
});

describe("actorHashFromRequest", () => {
  it("uses the last x-forwarded-for hop, the one GCP appends", () => {
    expect(
      actorHashFromRequest({ headers: { "x-forwarded-for": "spoof, 203.0.113.9" } })
    ).toBe(hashKey("203.0.113.9"));
  });

  it("uses a single hop as-is", () => {
    expect(
      actorHashFromRequest({ headers: { "x-forwarded-for": "198.51.100.4" } })
    ).toBe(hashKey("198.51.100.4"));
  });

  it("uses the forwarded hop even when a socket address exists", () => {
    expect(
      actorHashFromRequest({
        ip: "192.0.2.10",
        headers: { "x-forwarded-for": "spoof, 203.0.113.9" },
      })
    ).toBe(hashKey("203.0.113.9"));
  });

  it("falls back to the socket address when no forwarded hop exists", () => {
    expect(actorHashFromRequest({ ip: "192.0.2.10" })).toBe(hashKey("192.0.2.10"));
    expect(
      actorHashFromRequest({ ip: "192.0.2.10", headers: { "x-forwarded-for": "" } })
    ).toBe(hashKey("192.0.2.10"));
  });

  it("returns null when no actor is derivable", () => {
    expect(actorHashFromRequest(undefined)).toBeNull();
    expect(actorHashFromRequest({})).toBeNull();
    expect(actorHashFromRequest({ headers: {} })).toBeNull();
    expect(actorHashFromRequest({ headers: { "x-forwarded-for": "" } })).toBeNull();
  });

  it("hashes repeated spoofed first hops to one actor", () => {
    const first = actorHashFromRequest({
      headers: { "x-forwarded-for": "10.0.0.1, 203.0.113.9" },
    });
    const second = actorHashFromRequest({
      headers: { "x-forwarded-for": "10.0.0.2, 203.0.113.9" },
    });
    expect(first).toBe(second);
  });

  it("handles an array header value", () => {
    expect(
      actorHashFromRequest({ headers: { "x-forwarded-for": ["spoof, 203.0.113.9"] } })
    ).toBe(hashKey("203.0.113.9"));
  });
});

describe("compareAndSet", () => {
  beforeEach(() => {
    resetFakeState();
  });

  afterEach(() => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  });

  it("commits through the transaction path outside the emulator", async () => {
    await fakeDb.ref("cas/node").set({ status: "open" });

    const result = await compareAndSet<{ status?: string }>(
      fakeDb.ref("cas/node"),
      (current) => (current ? { ...current, status: "closed" } : undefined)
    );

    expect(result.committed).toBe(true);
    expect((fakeDb.read("cas/node") as { status: string }).status).toBe("closed");
  });

  it("aborts without writing when the mutator returns undefined", async () => {
    await fakeDb.ref("cas/node").set({ status: "open" });

    const result = await compareAndSet<{ status?: string }>(
      fakeDb.ref("cas/node"),
      () => undefined
    );

    expect(result.committed).toBe(false);
    expect((fakeDb.read("cas/node") as { status: string }).status).toBe("open");
  });

  // Models the installed Admin SDK: runTransaction calls the mutator against
  // the local sync tree first, so a path no listener has delivered yet
  // surfaces to the mutator as null and the write aborts before any server
  // round-trip. A prior get() does not populate that cache.
  function coldCacheRef(path: string) {
    const base = fakeDb.ref(path);
    const state = { primed: false, detaches: 0 };
    return {
      state,
      get: () => base.get(),
      set: (value: unknown) => base.set(value),
      on: (
        _event: "value",
        callback: (snapshot: { val(): unknown }) => void
      ): unknown => {
        const wrapped = (snapshot: { val(): unknown }) => {
          state.primed = true;
          callback(snapshot);
        };
        return base.on("value", wrapped);
      },
      off: (_event: "value", _callback: (snapshot: { val(): unknown }) => void): void => {
        state.detaches += 1;
      },
      transaction: async (
        mutate: (current: unknown) => unknown
      ): Promise<{ committed: boolean; snapshot: { val(): unknown } }> => {
        const current = state.primed
          ? ((await base.get()).val() ?? null)
          : null;
        const next = mutate(current);
        if (next === undefined) {
          return { committed: false, snapshot: { val: () => current } };
        }
        await base.set(next);
        return { committed: true, snapshot: { val: () => next } };
      },
    };
  }

  it("commits on a cold cache by priming the path before the transaction", async () => {
    await fakeDb.ref("cas/cold").set({ status: "ticketed" });
    const ref = coldCacheRef("cas/cold");
    let seen: unknown;

    const result = await compareAndSet<{ status?: string }>(ref, (current) => {
      seen = current;
      return current ? { ...current, status: "finalizing" } : undefined;
    });

    expect(seen).toEqual({ status: "ticketed" });
    expect(result.committed).toBe(true);
    expect((fakeDb.read("cas/cold") as { status: string }).status).toBe("finalizing");
  });

  it("aborts a genuinely missing node without writing", async () => {
    const ref = coldCacheRef("cas/missing");

    const result = await compareAndSet<{ status?: string }>(ref, (current) =>
      current ? { status: "written" } : undefined
    );

    expect(result.committed).toBe(false);
    expect(result.value).toBeNull();
    expect(fakeDb.read("cas/missing")).toBeNull();
  });

  it("detaches the priming listener on commit, abort, and mutator throw", async () => {
    await fakeDb.ref("cas/detach").set({ status: "open" });

    const committing = coldCacheRef("cas/detach");
    await compareAndSet<{ status?: string }>(committing, (current) => current ?? undefined);
    expect(committing.state.detaches).toBe(1);

    const aborting = coldCacheRef("cas/detach");
    await compareAndSet<{ status?: string }>(aborting, () => undefined);
    expect(aborting.state.detaches).toBe(1);

    const throwing = coldCacheRef("cas/detach");
    await expect(
      compareAndSet<{ status?: string }>(throwing, () => {
        throw new Error("mutator exploded");
      })
    ).rejects.toThrow("mutator exploded");
    expect(throwing.state.detaches).toBe(1);
  });

  it.each([
    ["FUNCTIONS_EMULATOR", "true"],
    ["FIREBASE_DATABASE_EMULATOR_HOST", "127.0.0.1:9000"],
  ])(
    "commits under %s even when ref.transaction always aborts",
    async (name, value) => {
      process.env[name] = value;
      await fakeDb.ref("cas/node").set({ status: "open" });
      // Mimics the RTDB emulator: the transaction callback never commits.
      const brokenRef = {
        get: () => fakeDb.ref("cas/node").get(),
        set: (next: unknown) => fakeDb.ref("cas/node").set(next),
        transaction: async () => ({
          committed: false,
          snapshot: { val: () => null },
        }),
        on: () => undefined,
        off: () => undefined,
      };

      const result = await compareAndSet<{ status?: string }>(
        brokenRef,
        (current) => (current ? { ...current, status: "pending" } : undefined)
      );

      expect(result.committed).toBe(true);
      expect((fakeDb.read("cas/node") as { status: string }).status).toBe("pending");
    }
  );
});

describe("rateLimit", () => {
  beforeEach(() => {
    resetFakeState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("slides instead of hard-resetting at the window boundary", async () => {
    vi.setSystemTime(0);
    expect(await rateLimit("sliding", "hash", 2, 1000)).toBe(true);
    expect(await rateLimit("sliding", "hash", 2, 1000)).toBe(true);

    // One window later the previous counts still carry weight: no reset.
    vi.setSystemTime(1000);
    expect(await rateLimit("sliding", "hash", 2, 1000)).toBe(false);

    // Two windows later the previous window has aged out and traffic flows.
    vi.setSystemTime(2000);
    expect(await rateLimit("sliding", "hash", 2, 1000)).toBe(true);
  });

  it("keeps fixed-window callers working from their seeded state", async () => {
    await fakeDb
      .ref("rateLimits/legacy/hash")
      .set({ windowStart: Date.now(), count: 5 });

    expect(await rateLimit("legacy", "hash", 5, 60000)).toBe(false);
  });

  it("does not extend the window for denied attempts", async () => {
    vi.setSystemTime(0);
    expect(await rateLimit("denied", "hash", 3, 1000)).toBe(true);
    expect(await rateLimit("denied", "hash", 3, 1000)).toBe(true);
    expect(await rateLimit("denied", "hash", 3, 1000)).toBe(true);

    // Sustained denied traffic must not push the counter past the cap.
    vi.setSystemTime(500);
    expect(await rateLimit("denied", "hash", 3, 1000)).toBe(false);
    expect(await rateLimit("denied", "hash", 3, 1000)).toBe(false);
    expect((fakeDb.read("rateLimits/denied/hash") as { count: number }).count).toBe(3);
  });

  it("admits again once the blocked window ages out", async () => {
    vi.setSystemTime(0);
    expect(await rateLimit("resume", "hash", 2, 1000)).toBe(true);
    expect(await rateLimit("resume", "hash", 2, 1000)).toBe(true);
    vi.setSystemTime(1000);
    expect(await rateLimit("resume", "hash", 2, 1000)).toBe(false);

    // Denied writes are aborted, so the original window still ages to zero.
    vi.setSystemTime(2000);
    expect(await rateLimit("resume", "hash", 2, 1000)).toBe(true);
  });

  it("lets a max-one throttle fire again in a later window", async () => {
    vi.setSystemTime(0);
    expect(await rateLimit("alert", "global", 1, 1000)).toBe(true);
    expect(await rateLimit("alert", "global", 1, 1000)).toBe(false);

    vi.setSystemTime(2001);
    expect(await rateLimit("alert", "global", 1, 1000)).toBe(true);
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetFakeState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("denies without writing when the cap is already reached", async () => {
    vi.setSystemTime(0);
    await fakeDb.ref("rateLimits/probe/hash").set({ windowStart: 0, count: 3 });

    expect(await checkRateLimit("probe", "hash", 3, 1000)).toBe(false);
    expect((fakeDb.read("rateLimits/probe/hash") as { count: number }).count).toBe(3);
  });

  it("allows without writing when under the cap", async () => {
    vi.setSystemTime(0);
    expect(await checkRateLimit("fresh", "hash", 3, 1000)).toBe(true);
    expect(fakeDb.read("rateLimits/fresh/hash")).toBeNull();
  });
});

describe("sendEmail", () => {
  beforeEach(() => {
    resetFakeState();
    // These tests exercise the real-send path, not the emulator stub.
    delete process.env.EMAIL_DRY_RUN;
    sendMock.mockReset();
  });

  const args = {
    to: "a@example.com",
    from: "LeCoursville <no-reply@auth.lecoursville.com>",
    subject: "Subject",
    text: "text",
    html: "<p>text</p>",
    kind: "test",
  };

  it("returns the Resend id on success", async () => {
    sendMock.mockResolvedValue({ data: { id: "mail-1" }, error: null });
    await expect(sendEmail(args)).resolves.toEqual({ stubbed: false, id: "mail-1" });
  });

  it("throws when Resend reports an in-band error instead of delivery", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "bad from address" },
    });
    await expect(sendEmail(args)).rejects.toThrow(/validation_error: bad from address/);
  });

  it("stubs to outboundEmails under dry-run without calling Resend", async () => {
    process.env.EMAIL_DRY_RUN = "1";
    const result = await sendEmail(args);
    expect(result.stubbed).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
    expect(fakeDb.read("outboundEmails")).not.toBeNull();
  });
});
