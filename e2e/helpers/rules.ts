import { E2E_USERS } from './auth';
import { readDb } from './admin-db';

// Matches environment.e2e.ts; the emulator accepts it directly.
const E2E_API_KEY = 'AIzaSyDBhEg8J_knZVdhEWCIbtcKJak3glu_TKA';
const DB_ORIGIN = 'http://localhost:9000';

export const DB_NS = 'ns=lecoursville-dev-default-rtdb';

/** Seeded role records; rules probes assert these stay untouched. */
export const ROLES = {
  admin: { user: true, admin: true, super: true },
  user: { user: true },
  staff: { user: true, admin: true, super: false },
} as const;

export type E2EUser = keyof typeof E2E_USERS;

/** Signs in over the emulator REST API and returns the ID token for rules auth. */
export async function idToken(email: string, password: string): Promise<string> {
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!body.idToken) {
    throw new Error(`sign-in failed for ${email}: ${JSON.stringify(body)}`);
  }
  return body.idToken as string;
}

export function signIn(who: E2EUser): Promise<string> {
  return idToken(E2E_USERS[who].email, E2E_USERS[who].password);
}

export async function uidForEmail(email: string): Promise<string> {
  const users = (await readDb<Record<string, any>>('users')) ?? {};
  const entry = Object.entries(users).find(([, user]) => user?.email === email);
  if (!entry) {
    throw new Error(`no user record for ${email}`);
  }
  return entry[0];
}

function dbUrl(path: string, token?: string): string {
  return `${DB_ORIGIN}/${path}.json?${DB_NS}${token ? `&auth=${token}` : ''}`;
}

export function get(path: string, token?: string): Promise<Response> {
  return fetch(dbUrl(path, token));
}

export function put(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(dbUrl(path, token), { method: 'PUT', body: JSON.stringify(body) });
}

export function patch(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(dbUrl(path, token), { method: 'PATCH', body: JSON.stringify(body) });
}

export function del(path: string, token?: string): Promise<Response> {
  return fetch(dbUrl(path, token), { method: 'DELETE' });
}
