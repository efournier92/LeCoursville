import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";

export interface AnalyticsTableRow {
  label: string;
  value: number;
}

export interface AnalyticsSummary {
  source: "fixture" | "ga";
  totals: { users: number; sessions: number };
  topPages: AnalyticsTableRow[];
  topEvents: AnalyticsTableRow[];
}

// Deterministic fixture so e2e (and any deployment without GA credentials)
// gets stable numbers instead of a call to Google.
const FIXTURE: AnalyticsSummary = {
  source: "fixture",
  totals: { users: 1204, sessions: 3567 },
  topPages: [
    { label: "/", value: 2400 },
    { label: "/calendar", value: 1873 },
    { label: "/photos", value: 1512 },
    { label: "/contacts", value: 1104 },
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
    { label: "first_visit", value: 812 },
    { label: "user_engagement", value: 2980 },
    { label: "photo_album_open", value: 415 },
    { label: "contact_view", value: 388 },
    { label: "calendar_navigate", value: 342 },
    { label: "media_upload", value: 190 },
    { label: "expression_created", value: 96 },
    { label: "search", value: 61 },
  ],
};

const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DAY_MS = 86400000;

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

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

    const today = Date.now();
    const dateRange = {
      startDate: isoDate(today - 29 * DAY_MS),
      endDate: isoDate(today),
    };

    const [totalsRows, pageRows, eventRows] = await Promise.all([
      runReport(propertyId, token, {
        dateRanges: [dateRange],
        metrics: [{ name: "totalUsers" }, { name: "sessions" }],
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
    ]);

    const totals = totalsRows[0]?.metricValues?.map((m) => Number(m.value ?? 0)) ?? [];
    return {
      source: "ga",
      totals: { users: totals[0] ?? 0, sessions: totals[1] ?? 0 },
      topPages: toRows(pageRows),
      topEvents: toRows(eventRows),
    } satisfies AnalyticsSummary;
  },
);
