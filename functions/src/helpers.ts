import { createHash } from "crypto";
import { getDatabase } from "firebase-admin/database";
import { Resend } from "resend";
import { APP_ACTION_PATH, REPLY_TO, getAllowedContinueOrigins } from "./config";

/** A recovery-request lock older than this is treated as abandoned. */
export const RECOVERY_LOCK_TTL_MS = 10 * 60 * 1000;

export function isDryRun(): boolean {
  return (
    process.env.FUNCTIONS_EMULATOR === "true" ||
    process.env.EMAIL_DRY_RUN === "1"
  );
}

export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function emailHash(email: string): string {
  return hashKey(email);
}

interface RawRequestLike {
  headers?: Record<string, unknown>;
  ip?: string;
}

/**
 * x-forwarded-for is client-controlled at the head; GCP appends the real client
 * IP at the end, so use the platform socket address when present and the last
 * forwarded hop otherwise. Null when neither exists, so callers skip the
 * per-actor layer rather than falling open to global.
 */
export function actorHashFromRequest(
  rawRequest: RawRequestLike | undefined
): string | null {
  const socketIp = rawRequest?.ip;
  let actor = typeof socketIp === "string" ? socketIp.trim() : "";
  if (!actor) {
    const forwarded = rawRequest?.headers?.["x-forwarded-for"];
    const header = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
    if (typeof header === "string") {
      const hops = header.split(",");
      actor = (hops[hops.length - 1] ?? "").trim();
    }
  }
  return actor ? hashKey(actor) : null;
}

export function isValidEmail(email: string): boolean {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Normalizes `config/adminAlertRecipients` to addresses. RTDB can hand back an
 * array, an object of index to address, or a legacy object of address to bool.
 */
export function normalizeRecipients(value: unknown): string[] {
  const entries: Array<[string | null, unknown]> = Array.isArray(value)
    ? value.map((entry) => [null, entry])
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>)
      : [];
  const addresses = entries.map(([key, entry]) =>
    typeof entry === "string" ? entry : entry === true && key ? key : ""
  );
  return [...new Set(addresses.map((entry) => entry.trim()).filter(Boolean))];
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isAllowedContinueUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const schemeOk = url.protocol === "https:" || (isLocal && url.protocol === "http:");
  return (
    schemeOk &&
    getAllowedContinueOrigins().has(url.origin) &&
    url.pathname === APP_ACTION_PATH
  );
}

export async function isAdmin(uid: string): Promise<boolean> {
  const snap = await getDatabase().ref(`users/${uid}/roles/admin`).get();
  return snap.val() === true;
}

export interface CompareAndSetResult<T> {
  committed: boolean;
  value: T | null;
}

type DataRef<T> = {
  get(): Promise<{ val(): unknown }>;
  set(value: T): Promise<unknown>;
  transaction(
    mutate: (current: T | null) => T | undefined
  ): Promise<{ committed: boolean; snapshot: { val(): unknown } }>;
};

// The RTDB emulator does not implement Admin SDK transactions: the callback
// runs with null and the promise reports committed false. Fall back to
// get-then-set there so callers still mutate; production stays transactional.
function databaseEmulatorActive(): boolean {
  return (
    process.env.FUNCTIONS_EMULATOR === "true" ||
    !!process.env.FIREBASE_DATABASE_EMULATOR_HOST
  );
}

/** Compare-and-set; the mutator returning undefined aborts the write. */
export async function compareAndSet<T>(
  ref: DataRef<T>,
  mutate: (current: T | null) => T | undefined
): Promise<CompareAndSetResult<T>> {
  if (databaseEmulatorActive()) {
    const current = ((await ref.get()).val() ?? null) as T | null;
    const next = mutate(current);
    if (next === undefined) {
      return { committed: false, value: current };
    }
    await ref.set(next);
    return { committed: true, value: next };
  }
  const result = await ref.transaction(mutate);
  return {
    committed: result.committed,
    value: (result.snapshot.val() ?? null) as T | null,
  };
}

interface RateLimitState {
  windowStart: number;
  count: number;
  previous?: number;
}

interface RateLimitDecision {
  allowed: boolean;
  next: RateLimitState;
}

/**
 * Sliding window: the current window plus the immediately previous one, the
 * latter decaying linearly to zero. Costs one extra field and keeps every
 * fixed-window caller's meaning at the first call of a window.
 */
function decideRateLimit(
  current: RateLimitState | null,
  now: number,
  max: number,
  windowMs: number
): RateLimitDecision {
  let windowStart = current?.windowStart;
  let count = current?.count ?? 0;
  let previous = current?.previous ?? 0;
  if (typeof windowStart !== "number") {
    windowStart = now;
    count = 0;
    previous = 0;
  }
  const elapsed = now - windowStart;
  if (elapsed >= windowMs) {
    const windowsPassed = Math.floor(elapsed / windowMs);
    previous = windowsPassed === 1 ? count : 0;
    count = 0;
    windowStart += windowsPassed * windowMs;
  }
  const previousWeight = Math.max(0, 1 - (now - windowStart) / windowMs);
  const allowed = count + 1 + previous * previousWeight <= max;
  return { allowed, next: { windowStart, count: count + 1, previous } };
}

export async function rateLimit(
  kind: string,
  hash: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const result = await compareAndSet<RateLimitState>(
    getDatabase().ref(`rateLimits/${kind}/${hash}`),
    (current) => {
      const decision = decideRateLimit(current, now, max, windowMs);
      // Decide inside the mutator and abort on deny: persisting the increment
      // for a rejected call would keep the counter saturated indefinitely.
      return decision.allowed ? decision.next : undefined;
    }
  );
  return result.committed;
}

/**
 * Reads a rate-limit decision without writing. Callers that enforce several
 * independent layers can pre-check all of them and only commit (via rateLimit)
 * once every layer would allow, so a call denied by a later layer no longer
 * burns quota on the earlier ones. The check-then-commit gap is acceptable for
 * a best-effort DoS control.
 */
export async function checkRateLimit(
  kind: string,
  hash: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const snap = await getDatabase().ref(`rateLimits/${kind}/${hash}`).get();
  const current = (snap.val() ?? null) as RateLimitState | null;
  return decideRateLimit(current, Date.now(), max, windowMs).allowed;
}

export interface SendEmailArgs {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  kind: string;
  link?: string | null;
}

export interface SendEmailResult {
  stubbed: boolean;
  id: string | null | undefined;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  if (isDryRun()) {
    const ref = getDatabase().ref("outboundEmails").push();
    await ref.set({
      to: args.to,
      from: args.from,
      subject: args.subject,
      text: args.text,
      html: args.html,
      kind: args.kind,
      link: args.link ?? null,
      createdAt: Date.now(),
    });
    return { stubbed: true, id: ref.key };
  }

  const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: args.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    replyTo: REPLY_TO,
  });
  // Resend v4 reports rejections in-band (HTTP 2xx with `error` set), so an
  // unchecked result would record 4xx/5xx sends as delivered.
  if (result.error) {
    throw new Error(
      `Resend rejected the send: ${result.error.name}: ${result.error.message}`
    );
  }
  return { stubbed: false, id: result.data?.id };
}

export interface AdminAlertInput {
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export async function sendAdminAlert(input: AdminAlertInput): Promise<string | null> {
  const ref = getDatabase().ref("adminAlerts").push();
  await ref.set({
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
    createdAt: Date.now(),
    createdBy: "system",
    emailStatus: "pending",
    emailError: null,
    recipientCount: 0,
  });
  return ref.key;
}

export async function writeAudit(
  entry: Record<string, unknown>
): Promise<string | null> {
  const ref = getDatabase().ref("recoveryAudit").push();
  await ref.set({ ...entry, id: ref.key, createdAt: Date.now() });
  return ref.key;
}

/**
 * Records a rate-limit breach with hashed keys only; other audit actions (for
 * example generate_reset_link) store raw emails and UIDs. hashKey is
 * pseudonymous, not anonymous: it is dictionary-reversible for emails and IPv4.
 */
export async function auditRateLimitBreach(input: {
  functionName: string;
  layer: "email" | "ip" | "global";
  emailHash: string | null;
  actorHash: string | null;
}): Promise<void> {
  await writeAudit({
    action: "rate_limit_breach",
    function: input.functionName,
    layer: input.layer,
    emailHash: input.emailHash,
    actorHash: input.actorHash,
  });
}

/** Writes at most one breach audit per function and layer per window. */
export async function throttledAuditRateLimitBreach(input: {
  functionName: string;
  layer: "email" | "ip" | "global";
  emailHash: string | null;
  actorHash: string | null;
  windowMs: number;
}): Promise<boolean> {
  const allowed = await rateLimit(
    "breachAuditThrottle",
    `${input.functionName}:${input.layer}`,
    1,
    input.windowMs
  );
  if (!allowed) {
    return false;
  }
  await auditRateLimitBreach({
    functionName: input.functionName,
    layer: input.layer,
    emailHash: input.emailHash,
    actorHash: input.actorHash,
  });
  return true;
}
