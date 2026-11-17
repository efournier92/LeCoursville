import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getAccessToken() {
      return "test-token";
    }
  },
}));

import { adminAnalyticsSummary } from "./admin-analytics-summary";
import type { AnalyticsSummary } from "./admin-analytics-summary";
import { fakeDb, resetFakeState } from "./test-support";

const auth = { uid: "admin-1", token: {} };

async function seedSuper(uid = "admin-1") {
  await fakeDb.ref(`users/${uid}/roles/super`).set(true);
}

function invoke() {
  return adminAnalyticsSummary.run({ auth, rawRequest: {} } as never);
}

function cannedReport(labels: string[], values: number[]) {
  return {
    rows: values.map((value, i) => ({
      dimensionValues: [{ value: labels[i] }],
      metricValues: [{ value: String(value) }],
    })),
  };
}

beforeEach(async () => {
  resetFakeState();
  await seedSuper();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GA_PROPERTY_ID;
  delete process.env.GA_SA_JSON;
});

describe("adminAnalyticsSummary fixture", () => {
  beforeEach(() => {
    process.env.FUNCTIONS_EMULATOR = "true";
  });

  it("satisfies the analytics contract", async () => {
    const summary = (await invoke()) as AnalyticsSummary;

    expect(summary.source).toBe("fixture");
    expect(summary.range.days).toBe(30);
    expect(summary.daily).toHaveLength(30);

    const dates = summary.daily.map((p) => p.date);
    expect(dates).toHaveLength(30);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect([...dates].sort()).toEqual(dates);
    expect(summary.range.start).toBe(dates[0]);
    expect(summary.range.end).toBe(dates[dates.length - 1]);

    const eventValues = summary.topEvents.map((row) => row.value);
    for (let i = 1; i < eventValues.length; i++) {
      expect(eventValues[i - 1]).toBeGreaterThanOrEqual(eventValues[i]);
    }

    const sum = (key: "users" | "sessions") =>
      summary.daily.reduce((acc, p) => acc + p[key], 0);
    expect(summary.totals.users).toBe(1204);
    expect(summary.totals.sessions).toBe(3567);
    expect(summary.totals.pageViews).toBe(12040);
    expect(sum("users")).toBe(summary.totals.users);
    expect(sum("sessions")).toBe(summary.totals.sessions);

    expect(summary.devices.reduce((acc, d) => acc + d.value, 0)).toBe(3567);

    expect(summary.totals.bounceRate).toBeGreaterThanOrEqual(0);
    expect(summary.totals.bounceRate).toBeLessThanOrEqual(1);
    const numbers = [
      summary.totals.users,
      summary.totals.sessions,
      summary.totals.pageViews,
      summary.totals.avgSessionSeconds,
      summary.totals.newUsers,
      ...summary.daily.flatMap((p) => [p.users, p.sessions]),
      ...summary.devices.map((d) => d.value),
      ...summary.topPages.map((r) => r.value),
      ...summary.topEvents.map((r) => r.value),
    ];
    for (const value of numbers) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    // readable series: a real peak and no zero-filled days
    expect(summary.daily.every((p) => p.users > 0)).toBe(true);
    expect(Math.max(...summary.daily.map((p) => p.users))).toBeGreaterThan(
      Math.min(...summary.daily.map((p) => p.users)),
    );
  });
});

describe("adminAnalyticsSummary GA mapping", () => {
  beforeEach(() => {
    process.env.GA_PROPERTY_ID = "123";
    process.env.GA_SA_JSON = JSON.stringify({ client_email: "sa@test" });
    delete process.env.FUNCTIONS_EMULATOR;
  });

  it("maps the canned GA reports", async () => {
    const bodies = [
      // totals: users, sessions, pageViews, bounceRate, duration, newUsers
      { rows: [{ metricValues: [1204, 3567, 12040, 0.416, 95.6, 812].map(
        (value) => ({ value: String(value) }),
      ) }] },
      cannedReport(["/", "/calendar"], [2400, 1873]),
      cannedReport(["page_view", "session_start"], [12040, 3567]),
      {
        rows: Array.from({ length: 30 }, (_, i) => i + 1)
          .filter((day) => day !== 5 && day !== 17)
          .map((day) => ({
            dimensionValues: [{ value: `202601${String(day).padStart(2, "0")}` }],
            metricValues: [
              { value: String(10 + day) },
              { value: String(20 + day) },
            ],
          })),
      },
      cannedReport(["desktop", "mobile", "tablet"], [2100, 1200, 267]),
    ];
    let call = 0;
    const requestBodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      const body = bodies[call++];
      return { ok: true, json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);

    const summary = (await invoke()) as AnalyticsSummary;

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(summary.source).toBe("ga");
    expect(summary.totals).toEqual({
      users: 1204,
      sessions: 3567,
      pageViews: 12040,
      bounceRate: 0.416,
      avgSessionSeconds: 96,
      newUsers: 812,
    });

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    for (const body of requestBodies) {
      expect((body.dateRanges as { endDate: string }[])[0].endDate).toBe(
        yesterday,
      );
    }

    expect(summary.daily).toHaveLength(30);
    expect(summary.daily.map((p) => p.date)).toEqual(
      Array.from({ length: 30 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`),
    );
    expect(summary.daily[0]).toEqual({
      date: "2026-01-01",
      users: 11,
      sessions: 21,
    });
    expect(summary.daily[4]).toEqual({
      date: "2026-01-05",
      users: 0,
      sessions: 0,
    });
    expect(summary.daily[16]).toEqual({
      date: "2026-01-17",
      users: 0,
      sessions: 0,
    });
    expect(summary.daily[29]).toEqual({
      date: "2026-01-30",
      users: 40,
      sessions: 50,
    });
    expect(summary.range).toEqual({
      days: 30,
      start: summary.daily[0].date,
      end: summary.daily[29].date,
    });

    expect(summary.topPages[0]).toEqual({ label: "/", value: 2400 });
    expect(summary.topEvents[0]).toEqual({ label: "page_view", value: 12040 });
    expect(summary.devices).toEqual([
      { label: "desktop", value: 2100 },
      { label: "mobile", value: 1200 },
      { label: "tablet", value: 267 },
    ]);
  });

  it("zero-fills an empty GA daily report across the full range", async () => {
    const bodies = [
      { rows: [{ metricValues: [0, 0, 0, 0, 0, 0].map(
        (value) => ({ value: String(value) }),
      ) }] },
      cannedReport([], []),
      cannedReport([], []),
      { rows: [] },
      cannedReport([], []),
    ];
    let call = 0;
    const fetchMock = vi.fn(async () => {
      const body = bodies[call++];
      return { ok: true, json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);

    const summary = (await invoke()) as AnalyticsSummary;

    expect(summary.daily).toHaveLength(30);
    expect(summary.daily.every((p) => p.users === 0)).toBe(true);
    expect(summary.range.end).toBe(summary.daily[29].date);
    expect(summary.range.start).toBe(summary.daily[0].date);
  });
});
