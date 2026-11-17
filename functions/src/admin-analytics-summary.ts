import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";

export interface AnalyticsTableRow {
  label: string;
  value: number;
}

export interface AnalyticsDailyPoint {
  date: string;
  users: number;
  sessions: number;
}

export interface AnalyticsSummary {
  source: "fixture" | "ga";
  range: { days: number; start: string; end: string };
  totals: {
    users: number;
    sessions: number;
    pageViews: number;
    bounceRate: number;
    avgSessionSeconds: number;
    newUsers: number;
  };
  daily: AnalyticsDailyPoint[];
  topPages: AnalyticsTableRow[];
  topEvents: AnalyticsTableRow[];
  devices: AnalyticsTableRow[];
}

const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DAY_MS = 86400000;
const RANGE_DAYS = 30;

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// GA's `date` dimension is YYYYMMDD in the property timezone; the payload is ISO.
function normalizeGaDate(raw: string): string {
  return /^\d{8}$/.test(raw)
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : raw;
}

// GA omits days with no traffic, so the axis is rebuilt across the returned span
// to keep one point per calendar day.
function zeroFillDaily(
  rows: AnalyticsDailyPoint[],
  endDate: string,
): AnalyticsDailyPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  const startMs = rows.length
    ? Date.parse(`${rows[0].date}T00:00:00Z`)
    : endMs - (RANGE_DAYS - 1) * DAY_MS;
  const stopMs = rows.length
    ? Date.parse(`${rows[rows.length - 1].date}T00:00:00Z`)
    : endMs;
  const out: AnalyticsDailyPoint[] = [];
  for (let ms = startMs; ms <= stopMs; ms += DAY_MS) {
    const date = isoDate(ms);
    out.push(byDate.get(date) ?? { date, users: 0, sessions: 0 });
  }
  return out;
}

// Largest-remainder allocation: integer shares of `total` that always add back
// up to it. Keeps the fixture's daily sums exact regardless of the weights.
function allocate(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / weightSum);
  const out = raw.map(Math.floor);
  const remainder = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let k = 0; k < remainder; k++) {
    out[order[k % order.length].index] += 1;
  }
  return out;
}

// Gentle weekday rhythm (weekends dip) with one visible peak on day 21.
function dailyWeights(now: number): number[] {
  return Array.from({ length: RANGE_DAYS }, (_, i) => {
    const weekday = new Date(now - (RANGE_DAYS - 1 - i) * DAY_MS).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.6 : 1;
    const peak = i === 20 ? 2.2 : 1;
    return weekend * peak * (1 + (i % 5) * 0.05);
  });
}

function buildFixture(now: number): AnalyticsSummary {
  const weights = dailyWeights(now);
  const users = allocate(1204, weights);
  const sessions = allocate(3567, weights);
  return {
    source: "fixture",
    range: {
      days: RANGE_DAYS,
      start: isoDate(now - (RANGE_DAYS - 1) * DAY_MS),
      end: isoDate(now),
    },
    totals: {
      users: 1204,
      sessions: 3567,
      pageViews: 12040,
      bounceRate: 0.416,
      avgSessionSeconds: 96,
      newUsers: 812,
    },
    // Deterministic fixture so e2e (and any deployment without GA credentials)
    // gets stable numbers instead of a call to Google.
    daily: users.map((value, i) => ({
      date: isoDate(now - (RANGE_DAYS - 1 - i) * DAY_MS),
      users: value,
      sessions: sessions[i],
    })),
    topPages: [
      { label: "/", value: 2400 },
      { label: "/calendar", value: 1873 },
      { label: "/photos", value: 1512 },
      { label: "/people", value: 986 },
      { label: "/music", value: 745 },
      { label: "/videos", value: 622 },
      { label: "/expressions", value: 431 },
      { label: "/login", value: 320 },
      { label: "/family-explorer", value: 214 },
    ],
    topEvents: [
      { label: "page_view", value: 12040 },
      { label: "session_start", value: 3567 },
      { label: "user_engagement", value: 2980 },
      { label: "first_visit", value: 812 },
      { label: "photo_album_open", value: 415 },
      { label: "contact_view", value: 388 },
      { label: "calendar_navigate", value: 342 },
      { label: "media_upload", value: 190 },
      { label: "expression_created", value: 96 },
      { label: "search", value: 61 },
    ],
    devices: [
      { label: "desktop", value: 2100 },
      { label: "mobile", value: 1200 },
      { label: "tablet", value: 267 },
    ],
  };
}

const FIXTURE: AnalyticsSummary = buildFixture(Date.now());

interface GaRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

interface GaReport {
  rows?: GaRow[];
}

async function runReport(
  propertyId: string,
  token: string,
  body: Record<string, unknown>,
): Promise<GaRow[]> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new HttpsError(
      "internal",
      `Analytics API HTTP ${res.status}.`,
    );
  }
  const report = (await res.json()) as GaReport;
  return report.rows ?? [];
}

function toRows(rows: GaRow[]): AnalyticsTableRow[] {
  return rows.map((row) => ({
    label: row.dimensionValues?.[0]?.value ?? "—",
    value: Number(row.metricValues?.[0]?.value ?? 0),
  }));
}

function metricNumber(row: GaRow | undefined, index: number): number {
  return Number(row?.metricValues?.[index]?.value ?? 0);
}

export const adminAnalyticsSummary = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    // The admin area is super-only; the guard mirrors the other admin callables.
    const superRole = await getDatabase().ref(`users/${uid}/roles/super`).get();
    if (superRole.val() !== true) {
      throw new HttpsError("permission-denied", "Super admin access required.");
    }

    const propertyId = process.env.GA_PROPERTY_ID;
    const saJson = process.env.GA_SA_JSON;
    // minimalist: fixture whenever GA is not configured (emulator always),
    // so the page works end-to-end without operator secrets.
    if (
      process.env.FUNCTIONS_EMULATOR === "true" ||
      !propertyId ||
      !saJson
    ) {
      return FIXTURE;
    }

    // Resolved from firebase-admin's transitive deps; no explicit dependency added.
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: JSON.parse(saJson),
      scopes: [GA_SCOPE],
    });
    const token = (await auth.getAccessToken()) as string;

    // 30 complete days: exclude today's partial day by ending yesterday.
    const yesterday = Date.now() - DAY_MS;
    const dateRange = {
      startDate: isoDate(yesterday - (RANGE_DAYS - 1) * DAY_MS),
      endDate: isoDate(yesterday),
    };

    const [totalsRows, pageRows, eventRows, dailyRows, deviceRows] =
      await Promise.all([
        runReport(propertyId, token, {
          dateRanges: [dateRange],
          metrics: [
            { name: "totalUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
            { name: "newUsers" },
          ],
        }),
        runReport(propertyId, token, {
          dateRanges: [dateRange],
          metrics: [{ name: "screenPageViews" }],
          dimensions: [{ name: "pagePath" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 10,
        }),
        runReport(propertyId, token, {
          dateRanges: [dateRange],
          metrics: [{ name: "eventCount" }],
          dimensions: [{ name: "eventName" }],
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          limit: 10,
        }),
        runReport(propertyId, token, {
          dateRanges: [dateRange],
          metrics: [
            { name: "totalUsers" },
            { name: "sessions" },
          ],
          dimensions: [{ name: "date" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: RANGE_DAYS,
        }),
        runReport(propertyId, token, {
          dateRanges: [dateRange],
          metrics: [{ name: "sessions" }],
          dimensions: [{ name: "deviceCategory" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 5,
        }),
      ]);

    const daily = zeroFillDaily(
      dailyRows.map((row) => ({
        date: normalizeGaDate(row.dimensionValues?.[0]?.value ?? ""),
        users: metricNumber(row, 0),
        sessions: metricNumber(row, 1),
      })),
      dateRange.endDate,
    );

    const totalsRow = totalsRows[0];
    return {
      source: "ga",
      range: {
        days: RANGE_DAYS,
        start: daily[0].date,
        end: daily[daily.length - 1].date,
      },
      totals: {
        users: metricNumber(totalsRow, 0),
        sessions: metricNumber(totalsRow, 1),
        pageViews: metricNumber(totalsRow, 2),
        // GA already reports bounceRate as a 0..1 fraction; never scale it.
        bounceRate: metricNumber(totalsRow, 3),
        avgSessionSeconds: Math.round(metricNumber(totalsRow, 4)),
        newUsers: metricNumber(totalsRow, 5),
      },
      daily,
      topPages: toRows(pageRows),
      topEvents: toRows(eventRows),
      devices: toRows(deviceRows),
    } satisfies AnalyticsSummary;
  },
);
