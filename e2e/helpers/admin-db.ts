/**
 * Admin-SDK access to server-only RTDB nodes for e2e assertions.
 *
 * database.rules.json denies client reads of outboundEmails, recoveryRequests,
 * adminAlerts, recoveryAudit, and rateLimits, so specs read and clean those
 * nodes with the Admin SDK, which bypasses rules. Emulator hosts come from the
 * environment `firebase emulators:exec` sets.
 */

// Playwright transpiles TS specs as CommonJS (root package.json has no
// "type": "module"), so require resolves the functions-local Admin SDK by path.
const admin = require('../../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'lecoursville-dev',
    databaseURL: 'https://lecoursville-dev-default-rtdb.firebaseio.com',
  });
}

export function readDb<T = any>(path: string): Promise<T | null> {
  return admin
    .database()
    .ref(path)
    .get()
    .then((snap: any) => (snap.val() as T) ?? null);
}

export function writeDb(path: string, value: unknown): Promise<void> {
  return admin.database().ref(path).set(value ?? null);
}

export function deleteDb(path: string): Promise<void> {
  return admin.database().ref(path).remove();
}

/** Restores a seeded account's password after a reset test mutates it. */
export async function setUserPassword(email: string, password: string): Promise<void> {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(user.uid, { password });
}

export interface OutboundEmailRecord {
  key: string;
  to?: string;
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  kind?: string;
  link?: string | null;
  createdAt?: number;
  [field: string]: unknown;
}

/** outboundEmails records of a kind, newest first, optionally filtered by recipient. */
export async function findOutboundEmails(
  kind?: string,
  filter: { to?: string } = {},
): Promise<OutboundEmailRecord[]> {
  const all = (await readDb<Record<string, any>>('outboundEmails')) ?? {};
  return Object.entries(all)
    .map(([key, value]) => ({ key, ...(value as object) }) as OutboundEmailRecord)
    .filter((mail) => (!kind || mail.kind === kind) && (!filter.to || mail.to === filter.to))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function latestOutboundEmail(
  kind: string,
  filter: { to?: string } = {},
): Promise<OutboundEmailRecord | null> {
  return (await findOutboundEmails(kind, filter))[0] ?? null;
}
