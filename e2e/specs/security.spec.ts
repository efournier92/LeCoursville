import { test, expect } from '../helpers/fixture';
import { createHash } from 'crypto';
import { login, logout, E2E_USERS } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';
import { deleteDb, findOutboundEmails, readDb, writeDb } from '../helpers/admin-db';

// Matches environment.e2e.ts; the emulator accepts it directly.
const E2E_API_KEY = 'AIzaSyDBhEg8J_knZVdhEWCIbtcKJak3glu_TKA';

/** Signs in over the emulator REST API and returns the ID token for callable auth. */
async function idToken(email: string, password: string): Promise<string> {
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  return body.idToken as string;
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Security pass, emulator scope. Findings that are out of scope (console
// rules, password-reset email delivery) are listed in the morning report, not
// tested here.

test.afterEach(async ({ collector }) => collector.assertClean());

test.describe('security', () => {
  test('guard bypass: tampering localStorage roles must NOT open /admin', async ({ page }) => {
    await login(page, 'user');
    await expect(page).toHaveURL(/\/calendar/);
    // Attacker edits their own localStorage user record to claim admin.
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.roles = { user: true, admin: true, super: true };
      localStorage.setItem('user', JSON.stringify(user));
    });
    await page.goto('/admin');
    // Secure behavior: the guard verifies against the real auth/RTDB record and
    // redirects. Vulnerable behavior: it trusts localStorage and renders admin.
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test('XSS: chat message bodies must not execute injected HTML', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'New Message' }).first().click();
    await page.getByPlaceholder('Title').fill('XSS probe');
    await page.getByTestId('chat-message-input').fill('<img src=x onerror="window.__xss=1">');
    await page.getByTestId('chat-send').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    // View as another user (the payload executes for ANY viewer).
    await page.getByRole('button', { name: 'Account' }).click();
    await logout(page);
    await login(page, 'other');
    await page.goto('/chat');
    await expect(page.getByText('XSS probe')).toBeVisible();
    await page.waitForTimeout(1000);
    const xss = await page.evaluate(() => (window as any).__xss ?? 0);
    expect(xss).toBe(0);
  });

  test('XSS: expression bodies must not execute injected HTML', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/expressions');
    await page.getByRole('button', { name: 'Create Expression' }).click();
    await page.getByLabel('Expression').fill('XSS expression');
    await page.getByLabel('Description').fill('<img src=x onerror="window.__xss=2">');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('XSS expression')).toBeVisible();
    await page.waitForTimeout(1000);
    const xss = await page.evaluate(() => (window as any).__xss ?? 0);
    expect(xss).toBe(0);
  });

  test('upload validation: non-image file types are accepted (finding probe)', async ({ page }) => {
    await page.goto('/upload');
    await page.getByTestId('upload-file-input').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    await expect(page.getByText('1 File Selected')).toBeVisible();
    await page.getByRole('button', { name: 'Upload All' }).click();
    // Accepted -> proves there is NO file-type validation on the public upload.
    await expect(page.getByText('Thanks For Sharing!')).toBeVisible({ timeout: 30000 });
  });

  test('outbound requests: a feature walk must not hit external hosts', async ({ page }) => {
    const external: string[] = [];
    await page.route('**/*', (route) => {
      const u = route.request().url();
      const local =
        u.startsWith('http://localhost:5000') ||
        u.startsWith('http://localhost:9099') ||
        u.startsWith('http://localhost:9000') ||
        u.startsWith('http://localhost:9199') ||
        u.startsWith('http://127.0.0.1:9199') ||
        u.startsWith('ws://localhost:9000') ||
        u.startsWith('ws://127.0.0.1');
      if (local) {
        return route.continue();
      }
      external.push(u);
      return route.abort().catch(() => {});
    });

    await login(page, 'admin');
    const walks = ['/contacts', '/calendar', '/expressions', '/photos', '/people', '/media/explorer', '/upload'];
    for (const route of walks) {
      await page.goto(route);
      await page.waitForTimeout(600);
    }
    // Only the seeded Drive video iframe and its Google API loader are known
    // external URLs (aborted, not loaded). The Drive player iframe itself
    // requests apis.google.com/js/api.js from inside the iframe.
    const unexpected = external.filter(
      (u) => !u.includes('drive.google.com') && !u.includes('apis.google.com'),
    );
    expect(unexpected).toEqual([]);
  });

  test('no enumeration: reset banner is identical for known and unknown emails', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-email').fill('user@e2e.local');
    await page.getByTestId('auth-forgot').click();
    const knownBanner = page.getByTestId('auth-reset-info');
    await expect(knownBanner).toBeVisible();
    const knownText = ((await knownBanner.textContent()) ?? '').trim();
    await expect(page.getByTestId('auth-error')).toHaveCount(0);

    await page.goto('/');
    await page.getByTestId('auth-email').fill('nobody-security-e2e@e2e.local');
    await page.getByTestId('auth-forgot').click();
    const unknownBanner = page.getByTestId('auth-reset-info');
    await expect(unknownBanner).toBeVisible();
    const unknownText = ((await unknownBanner.textContent()) ?? '').trim();
    await expect(page.getByTestId('auth-error')).toHaveCount(0);

    expect(unknownText).toBe(knownText);

    for (const email of ['user@e2e.local', 'nobody-security-e2e@e2e.local']) {
      for (const mail of await findOutboundEmails('password_reset', { to: email })) {
        await deleteDb(`outboundEmails/${mail.key}`);
      }
    }
  });

  test('server-only nodes reject unauthenticated RTDB reads', async () => {
    for (const node of ['recoveryRequests', 'adminAlerts']) {
      const res = await fetch(`http://localhost:9000/${node}.json?ns=lecoursville-dev-default-rtdb`);
      expect(res.status).not.toBe(200);
    }
  });

  test('rules: an authenticated user cannot rewrite their own roles/user', async () => {
    const token = await idToken(E2E_USERS.user.email, E2E_USERS.user.password);
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const uid = Object.entries(users).find(
      ([, value]) => value?.email === E2E_USERS.user.email,
    )?.[0];
    expect(uid).toBeTruthy();

    const res = await fetch(
      `http://localhost:9000/users/${uid}/roles/user.json?ns=lecoursville-dev-default-rtdb&auth=${token}`,
      { method: 'PUT', body: 'false' },
    );
    expect(res.status).not.toBe(200);
    expect(await readDb<boolean>(`users/${uid}/roles/user`)).toBe(true);
  });

  test('rules: an authenticated user can still update their own profile fields', async () => {
    const token = await idToken(E2E_USERS.user.email, E2E_USERS.user.password);
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const uid = Object.entries(users).find(
      ([, value]) => value?.email === E2E_USERS.user.email,
    )?.[0];
    const original = await readDb<string>(`users/${uid}/name`);

    try {
      const res = await fetch(
        `http://localhost:9000/users/${uid}/name.json?ns=lecoursville-dev-default-rtdb&auth=${token}`,
        { method: 'PUT', body: JSON.stringify('E2E Renamed') },
      );
      expect(res.ok).toBe(true);
      expect(await readDb<string>(`users/${uid}/name`)).toBe('E2E Renamed');
    } finally {
      await writeDb(`users/${uid}/name`, original);
    }
  });

  test('non-admin cannot open /admin/recovery', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/admin/recovery');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByTestId('admin-recovery-list')).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendar/);
  });

  test('non-super admin cannot reach any admin route by URL', async ({ page }) => {
    await login(page, 'staff');
    const routes = [
      '/admin',
      '/admin/users',
      '/admin/features',
      '/admin/recovery',
      '/admin/families',
      '/admin/people',
      '/admin/calendars',
      '/admin/media',
      '/admin/photo-albums',
      '/admin/uploads',
    ];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/admin/);
      await expect(page.locator('app-admin')).toHaveCount(0);
      await expect(page.getByTestId('admin-nav')).toHaveCount(0);
    }
  });

  test('tampered callable input is rejected', async () => {
    const res = await fetch(
      'http://127.0.0.1:5001/lecoursville-dev/us-central1/requestPasswordReset',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { email: 'not-an-email', continueUrl: 'http://localhost:5000/auth/action' },
        }),
      },
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const body = await res.json().catch(() => null);
    expect(body?.error).toBeTruthy();
  });

  test('non-admin callable invocation of adminGenerateResetLink is rejected', async () => {
    const token = await idToken(E2E_USERS.user.email, E2E_USERS.user.password);
    const res = await fetch(
      'http://127.0.0.1:5001/lecoursville-dev/us-central1/adminGenerateResetLink',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          data: {
            requestId: 'non-admin-probe',
            email: E2E_USERS.user.email,
            reason: 'probe',
            continueUrl: 'http://localhost:5000/auth/action',
          },
        }),
      },
    );
    expect(res.status).toBe(403);
    const body = await res.json().catch(() => null);
    expect(body?.error?.status).toBe('PERMISSION_DENIED');
  });

  test('recovery request rate limit caps writes but keeps the generic response', async () => {
    const email = 'rate-limit-security-e2e@e2e.local';
    const hash = createHash('sha256').update(email).digest('hex').slice(0, 32);
    try {
      for (let i = 0; i < 4; i++) {
        const res = await fetch(
          'http://127.0.0.1:5001/lecoursville-dev/us-central1/submitRecoveryRequest',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { email, name: `Rate Limit ${i}` } }),
          },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body?.result?.ok).toBe(true);
      }

      const all = (await readDb<Record<string, any>>('recoveryRequests')) ?? {};
      const mine = Object.entries(all).filter(([, value]) => value?.email === email);
      expect(mine.length).toBe(3);

      // Let the alert trigger finish writing before restoring state.
      await expect
        .poll(async () => {
          const alerts = (await readDb<Record<string, any>>('adminAlerts')) ?? {};
          return Object.values(alerts).filter((value) => value?.data?.email === email).length;
        }, { timeout: 15000 })
        .toBe(3);

      for (const [key] of mine) {
        await deleteDb(`recoveryRequests/${key}`);
      }
      const alerts = (await readDb<Record<string, any>>('adminAlerts')) ?? {};
      for (const [key, value] of Object.entries(alerts)) {
        if (value?.data?.email === email) {
          await deleteDb(`adminAlerts/${key}`);
        }
      }
      for (const mail of await findOutboundEmails('admin_alert')) {
        if ((mail.text ?? '').includes(email)) {
          await deleteDb(`outboundEmails/${mail.key}`);
        }
      }
    } finally {
      await deleteDb(`rateLimits/recoveryRequests/${hash}`);
    }
  });
});
