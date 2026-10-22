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

const STORAGE_ORIGIN = 'http://127.0.0.1:9199';
const STORAGE_BUCKET = 'lecoursville-dev.appspot.com';

function storageUrl(path: string): string {
  return `http://localhost:9199/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}

async function putStorageObject(path: string): Promise<void> {
  const res = await fetch(
    `${STORAGE_ORIGIN}/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: TINY_PNG },
  );
  if (!res.ok) {
    throw new Error(`storage seed ${path} -> HTTP ${res.status}`);
  }
}

async function deleteStorageObject(path: string): Promise<void> {
  await fetch(
    `${STORAGE_ORIGIN}/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}`,
    { method: 'DELETE' },
  ).catch(() => undefined);
}

async function storageObjectStatus(path: string): Promise<number> {
  const res = await fetch(
    `${STORAGE_ORIGIN}/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}`,
  );
  return res.status;
}

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

  test('adminGenerateResetLink is super-only, not merely admin', async () => {
    const call = (token: string) =>
      fetch(
        'http://127.0.0.1:5001/lecoursville-dev/us-central1/adminGenerateResetLink',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            data: {
              requestId: 'non-super-probe',
              email: E2E_USERS.user.email,
              reason: 'probe',
              continueUrl: 'http://localhost:5000/auth/action',
            },
          }),
        },
      );

    for (const who of ['user', 'staff'] as const) {
      const token = await idToken(E2E_USERS[who].email, E2E_USERS[who].password);
      const res = await call(token);
      expect(res.status).toBe(403);
      const body = await res.json().catch(() => null);
      expect(body?.error?.status).toBe('PERMISSION_DENIED');
    }
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

  test('rules: staff admin cannot mutate features or promotedRoute', async () => {
    const token = await idToken(E2E_USERS.staff.email, E2E_USERS.staff.password);
    const featureBefore = await readDb('features/chat');
    const routeBefore = await readDb('promotedRoute');

    const featureRes = await fetch(
      `http://localhost:9000/features/chat.json?ns=lecoursville-dev-default-rtdb&auth=${token}`,
      { method: 'PUT', body: JSON.stringify({ enabled: true, updatedAt: Date.now() }) },
    );
    expect(featureRes.status).not.toBe(200);
    expect(await readDb('features/chat')).toEqual(featureBefore);

    const routeRes = await fetch(
      `http://localhost:9000/promotedRoute.json?ns=lecoursville-dev-default-rtdb&auth=${token}`,
      {
        method: 'PUT',
        body: JSON.stringify({ route: '/chat', updatedAt: Date.now() }),
      },
    );
    expect(routeRes.status).not.toBe(200);
    expect(await readDb('promotedRoute')).toEqual(routeBefore);
  });

  test('rules: super-only nodes reject staff reads and allow super reads', async () => {
    const staffToken = await idToken(E2E_USERS.staff.email, E2E_USERS.staff.password);
    const superToken = await idToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const nodes = [
      'recoveryRequests',
      'adminAlerts',
      'recoveryAudit',
      'config/adminAlertRecipients',
    ];

    for (const node of nodes) {
      const staffRes = await fetch(
        `http://localhost:9000/${node}.json?ns=lecoursville-dev-default-rtdb&auth=${staffToken}`,
      );
      expect(staffRes.status).not.toBe(200);

      const superRes = await fetch(
        `http://localhost:9000/${node}.json?ns=lecoursville-dev-default-rtdb&auth=${superToken}`,
      );
      expect(superRes.status).toBe(200);
    }
  });

  test('rules: roleAudit is super-write and super-read only', async () => {
    const staffToken = await idToken(E2E_USERS.staff.email, E2E_USERS.staff.password);
    const superToken = await idToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const id = `security-probe-${Date.now()}`;
    const record = {
      actorId: 'probe-actor',
      targetId: 'probe-target',
      targetEmail: 'probe@e2e.local',
      before: { admin: false, super: false },
      after: { admin: true, super: false },
      at: Date.now(),
    };

    try {
      const staffRes = await fetch(
        `http://localhost:9000/roleAudit/${id}.json?ns=lecoursville-dev-default-rtdb&auth=${staffToken}`,
        { method: 'PUT', body: JSON.stringify(record) },
      );
      expect(staffRes.status).not.toBe(200);
      expect(await readDb(`roleAudit/${id}`)).toBeNull();

      const superWrite = await fetch(
        `http://localhost:9000/roleAudit/${id}.json?ns=lecoursville-dev-default-rtdb&auth=${superToken}`,
        { method: 'PUT', body: JSON.stringify(record) },
      );
      expect(superWrite.ok).toBe(true);
      expect(await readDb(`roleAudit/${id}`)).toEqual(record);

      const superRead = await fetch(
        `http://localhost:9000/roleAudit/${id}.json?ns=lecoursville-dev-default-rtdb&auth=${superToken}`,
      );
      expect(superRead.status).toBe(200);
      expect(await superRead.json()).toEqual(record);
    } finally {
      await deleteDb(`roleAudit/${id}`);
    }
  });

  test('rules: featureFlagAudit is super-create and super-read only', async () => {
    const staffToken = await idToken(E2E_USERS.staff.email, E2E_USERS.staff.password);
    const superToken = await idToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const id = `security-feature-audit-${Date.now()}`;
    const record = {
      flagId: 'chat',
      enabled: false,
      previous: true,
      actorId: 'probe-actor',
      actorEmail: 'probe@e2e.local',
      at: Date.now(),
    };
    const url = `http://localhost:9000/featureFlagAudit/${id}.json?ns=lecoursville-dev-default-rtdb&auth=${superToken}`;

    try {
      const staffRes = await fetch(
        `http://localhost:9000/featureFlagAudit/${id}.json?ns=lecoursville-dev-default-rtdb&auth=${staffToken}`,
        { method: 'PUT', body: JSON.stringify(record) },
      );
      expect(staffRes.status).not.toBe(200);
      expect(await readDb(`featureFlagAudit/${id}`)).toBeNull();

      const superWrite = await fetch(url, { method: 'PUT', body: JSON.stringify(record) });
      expect(superWrite.ok).toBe(true);
      expect(await readDb(`featureFlagAudit/${id}`)).toEqual(record);

      const superRead = await fetch(url);
      expect(superRead.status).toBe(200);
      expect(await superRead.json()).toEqual(record);

      const superUpdate = await fetch(url, {
        method: 'PUT',
        body: JSON.stringify({ ...record, enabled: true }),
      });
      expect(superUpdate.status).not.toBe(200);
      expect(await readDb(`featureFlagAudit/${id}`)).toEqual(record);

      const superDelete = await fetch(url, { method: 'DELETE' });
      expect(superDelete.status).not.toBe(200);
      expect(await readDb(`featureFlagAudit/${id}`)).toEqual(record);
    } finally {
      await deleteDb(`featureFlagAudit/${id}`);
    }
  });

  test('rules: userUploads rejects client writes; the callable owns the record', async () => {
    // RTDB rules cascade: the child id `.write: false` does not revoke the
    // parent admin `.write`, so the id pin is enforced by `.validate` and the
    // public denial by the explicit ancestor condition, not by that child rule.
    const userToken = await idToken(E2E_USERS.user.email, E2E_USERS.user.password);
    const adminToken = await idToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const key = `security-upload-${Date.now()}`;
    const base = 'http://localhost:9000/userUploads';
    const direct = (body: Record<string, unknown>, token?: string) =>
      fetch(
        `${base}/${key}.json?ns=lecoursville-dev-default-rtdb${token ? `&auth=${token}` : ''}`,
        { method: 'PUT', body: JSON.stringify(body) },
      );
    const baseRecord = {
      id: key,
      status: 'pending',
      path: `userUploads/${key}/file.png`,
      fileName: 'file.png',
      fileType: 'image/png',
      url: '',
    };

    try {
      // The public page no longer needs a database identity: client writes are
      // denied outright, authenticated or not.
      expect((await direct(baseRecord)).status).not.toBe(200);
      expect((await direct(baseRecord, userToken)).status).not.toBe(200);
      // Even an admin client must keep the record id equal to its key; record
      // creation belongs to the callable.
      expect((await direct({ ...baseRecord, id: 'another-id' }, adminToken)).status)
        .not.toBe(200);

      const call = await fetch(
        'http://127.0.0.1:5001/lecoursville-dev/us-central1/createUserUpload',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              fileName: '../../attack name.png',
              batchId: '../batch/name',
              eventName: 'Security probe',
              fileType: 'image/png',
              fileSize: 10,
              uploader: { name: 'Probe' },
              id: 'attacker',
              path: 'photos/album-1/photo1.png',
              status: 'approved',
              url: 'https://evil.example/x.png',
            },
          }),
        },
      );
      expect(call.ok).toBe(true);
      const body = await call.json();
      const created = body.result as { id: string; path: string };
      expect(created.id).toBeTruthy();
      expect(created.path).toMatch(new RegExp(`^userUploads/${created.id}/`));
      expect(created.path).not.toContain('..');
      const record = await readDb<Record<string, unknown>>(`userUploads/${created.id}`);
      expect(record).toMatchObject({
        id: created.id,
        path: created.path,
        status: 'pending',
        url: '',
      });
      expect(record?.fileName).toBe('attack_name.png');
    } finally {
      await deleteDb(`userUploads/${key}`);
      const all = (await readDb<Record<string, any>>('userUploads')) ?? {};
      for (const [id, value] of Object.entries(all)) {
        if (value?.uploader?.name === 'Probe' && value?.eventName === 'Security probe') {
          await deleteDb(`userUploads/${id}`);
        }
      }
    }
  });

  test('upload rate limit: a capped call is rejected and writes no record', async () => {
    const call = (eventName: string) =>
      fetch(
        'http://127.0.0.1:5001/lecoursville-dev/us-central1/createUserUpload',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Pin the per-actor key to a forwarded hop; the emulator's socket
            // address is absent, so without this header the actor is null.
            'X-Forwarded-For': '203.0.113.77',
          },
          body: JSON.stringify({
            data: {
              fileName: 'rate-limit.png',
              eventName,
              fileType: 'image/png',
              fileSize: 10,
              uploader: { name: 'Probe' },
            },
          }),
        },
      );
    const eventName = `Security rate limit ${Date.now()}`;
    let createdId = '';

    try {
      await deleteDb('rateLimits/userUploadsIp');
      await deleteDb('rateLimits/userUploadsGlobal');

      const first = await call(eventName);
      expect(first.ok).toBe(true);
      createdId = ((await first.json()).result as { id: string }).id;

      // Saturate every layer this caller participates in. The cap values live
      // in create-user-upload.ts; any count above them denies the next call.
      const ipLimits =
        (await readDb<Record<string, any>>('rateLimits/userUploadsIp')) ?? {};
      for (const actor of Object.keys(ipLimits)) {
        await writeDb(`rateLimits/userUploadsIp/${actor}`, {
          windowStart: Date.now(),
          count: 100000,
        });
      }
      await writeDb('rateLimits/userUploadsGlobal/global', {
        windowStart: Date.now(),
        count: 100000,
      });

      const before = (await readDb<Record<string, any>>('userUploads')) ?? {};
      const blocked = await call(`${eventName} blocked`);
      expect(blocked.ok).toBe(false);
      expect(blocked.status).toBe(429);
      const body = await blocked.json().catch(() => null);
      expect(body?.error?.status).toBe('RESOURCE_EXHAUSTED');

      const after = (await readDb<Record<string, any>>('userUploads')) ?? {};
      expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    } finally {
      if (createdId) {
        await deleteDb(`userUploads/${createdId}`);
      }
      await deleteDb('rateLimits/userUploadsIp');
      await deleteDb('rateLimits/userUploadsGlobal');
    }
  });

  test('global upload cap soft-degrades: guests still upload and one alert is raised', async () => {
    const eventName = `Security global soft ${Date.now()}`;
    const startedAt = Date.now();
    const created: string[] = [];
    const call = (suffix: string) =>
      fetch(
        'http://127.0.0.1:5001/lecoursville-dev/us-central1/createUserUpload',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              fileName: `${suffix}.png`,
              eventName,
              fileType: 'image/png',
              fileSize: 10,
              uploader: { name: 'Probe' },
            },
          }),
        },
      );

    try {
      await deleteDb('rateLimits/userUploadsIp');
      await deleteDb('rateLimits/userUploadsGlobal');
      await deleteDb('rateLimits/userUploadsGlobalAlert');
      await writeDb('rateLimits/userUploadsGlobal/global', {
        windowStart: Date.now(),
        count: 100000,
      });

      // Over the global cap the call still succeeds, twice, so a guest is
      // never hard-denied by an attacker-exhaustible counter.
      for (const suffix of ['global-over-1', 'global-over-2']) {
        const res = await call(suffix);
        expect(res.ok).toBe(true);
        created.push(((await res.json()).result as { id: string }).id);
      }

      const uploads = (await readDb<Record<string, any>>('userUploads')) ?? {};
      for (const id of created) {
        expect(uploads[id]).toBeTruthy();
      }

      await expect
        .poll(async () => {
          const alerts = (await readDb<Record<string, any>>('adminAlerts')) ?? {};
          return Object.values(alerts).filter(
            (alert) => alert?.type === 'upload_global_cap' && alert?.createdAt >= startedAt,
          ).length;
        }, { timeout: 15000 })
        .toBe(1);
    } finally {
      for (const id of created) {
        await deleteDb(`userUploads/${id}`);
      }
      await deleteDb('rateLimits/userUploadsIp');
      await deleteDb('rateLimits/userUploadsGlobal');
      await deleteDb('rateLimits/userUploadsGlobalAlert');
      const alerts = (await readDb<Record<string, any>>('adminAlerts')) ?? {};
      for (const [key, alert] of Object.entries(alerts)) {
        if (alert?.type === 'upload_global_cap' && alert?.createdAt >= startedAt) {
          await deleteDb(`adminAlerts/${key}`);
        }
      }
      for (const mail of await findOutboundEmails('admin_alert')) {
        if ((mail.text ?? '').includes('Upload volume is above the global cap')) {
          await deleteDb(`outboundEmails/${mail.key}`);
        }
      }
    }
  });

  test('upload trust: rejecting an upload touches its path, never an attacker-authored url', async ({ page }) => {
    const key = `security-trust-${Date.now()}`;
    const uploadPath = `userUploads/${key}/attack.png`;
    const victimPath = 'photos/album-1/photo1.png';
    await putStorageObject(uploadPath);
    await writeDb(`userUploads/${key}`, {
      id: key,
      url: storageUrl(victimPath),
      path: uploadPath,
      dateAdded: Date.now(),
      eventName: 'Security probe',
      status: 'pending',
      uploader: { name: 'Probe', email: 'probe@e2e.local' },
      fileName: 'attack.png',
      fileType: 'image/png',
      fileSize: TINY_PNG.length,
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/uploads');
      const row = page.locator('tr', { hasText: 'attack.png' }).first();
      await expect(row).toBeVisible();
      await row.getByRole('button', { name: 'Reject attack.png' }).click();
      await page.getByRole('button', { name: 'Reject upload' }).click();

      await expect.poll(() => storageObjectStatus(uploadPath)).toBe(404);
      expect(await storageObjectStatus(victimPath)).toBe(200);
      await expect.poll(() => readDb(`userUploads/${key}`)).toBeNull();
    } finally {
      if ((await storageObjectStatus(victimPath)) !== 200) {
        await putStorageObject(victimPath);
      }
      await deleteDb(`userUploads/${key}`);
      await deleteStorageObject(uploadPath);
    }
  });

  test('upload trust: rejecting a record whose object is gone still removes it', async ({ page }) => {
    const key = `security-orphan-${Date.now()}`;
    const fileName = `orphan-${Date.now()}.png`;
    await writeDb(`userUploads/${key}`, {
      id: key,
      url: '',
      path: `userUploads/${key}/${fileName}`,
      dateAdded: Date.now(),
      eventName: 'Security orphan probe',
      status: 'pending',
      uploader: { name: 'Probe', email: 'probe@e2e.local' },
      fileName,
      fileType: 'image/png',
      fileSize: TINY_PNG.length,
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/uploads');
      const row = page.locator('tr', { hasText: fileName }).first();
      await expect(row).toBeVisible();
      await row.getByRole('button', { name: `Reject ${fileName}` }).click();
      await page.getByRole('button', { name: 'Reject upload' }).click();
      await expect.poll(() => readDb(`userUploads/${key}`)).toBeNull();
    } finally {
      await deleteDb(`userUploads/${key}`);
    }
  });

  test('upload approval: same file name in one album keeps both objects', async ({ page }) => {
    const stamp = Date.now();
    const fileName = `collision-${stamp}.png`;
    const uploads = [`collision-a-${stamp}`, `collision-b-${stamp}`].map((key) => ({
      key,
      path: `userUploads/${key}/${fileName}`,
    }));
    const createdPhotos: string[] = [];
    const paths: string[] = [];

    for (const upload of uploads) {
      await putStorageObject(upload.path);
      await writeDb(`userUploads/${upload.key}`, {
        id: upload.key,
        url: storageUrl(upload.path),
        path: upload.path,
        dateAdded: Date.now(),
        eventName: 'Security collision probe',
        status: 'pending',
        uploader: { name: 'Probe', email: 'probe@e2e.local' },
        fileName,
        fileType: 'image/png',
        fileSize: TINY_PNG.length,
      });
    }

    try {
      await login(page, 'admin');
      await page.goto('/admin/uploads');
      for (let i = 0; i < uploads.length; i++) {
        const row = page.locator('tr', { hasText: fileName }).first();
        await expect(row).toBeVisible();
        await row.getByRole('button', { name: `Approve ${fileName}` }).click();
        await page.getByRole('radio', { name: 'Use existing album' }).click();
        await expect(page.getByRole('combobox')).toBeVisible();
        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: 'E2E Album One' }).click();
        await page.getByRole('button', { name: 'Approve & Add' }).click();
        await expect(page.getByRole('button', { name: 'Approve & Add' })).toHaveCount(0);
        await expect
          .poll(async () => {
            const records = (await readDb<Record<string, any>>('userUploads')) ?? {};
            return uploads.filter((upload) => records[upload.key]?.status === 'approved')
              .length;
          })
          .toBe(i + 1);
      }

      const allPhotos = (await readDb<Record<string, any>>('photos')) ?? {};
      const mine = Object.entries(allPhotos).filter(
        ([, photo]) =>
          photo?.albumId === 'album-1' && String(photo?.path).endsWith(`_${fileName}`),
      );
      expect(mine).toHaveLength(2);
      for (const [id, photo] of mine) {
        createdPhotos.push(id);
        paths.push(photo.path);
        expect(await storageObjectStatus(photo.path)).toBe(200);
      }
      expect(new Set(paths).size).toBe(2);
      // The suffix keeps the second approval from overwriting the first.
      expect(await storageObjectStatus(`photos/album-1/${fileName}`)).toBe(404);
    } finally {
      for (const id of createdPhotos) {
        await deleteDb(`photos/${id}`);
      }
      for (const path of paths) {
        await deleteStorageObject(path);
      }
      await deleteStorageObject(`photos/album-1/${fileName}`);
      for (const upload of uploads) {
        await deleteDb(`userUploads/${upload.key}`);
        await deleteStorageObject(upload.path);
      }
    }
  });

  test('rules: messages deny forged authors, nested rewrites, and cross-author changes', async () => {
    const userToken = await idToken(E2E_USERS.user.email, E2E_USERS.user.password);
    const adminToken = await idToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const uidFor = (email: string) =>
      Object.entries(users).find(([, value]) => value?.email === email)?.[0] as string;
    const userUid = uidFor(E2E_USERS.user.email);
    const adminUid = uidFor(E2E_USERS.admin.email);
    const stamp = Date.now();
    const ownKey = `security-own-${stamp}`;
    const forgedKey = `security-forged-${stamp}`;
    const replyKey = `security-reply-${stamp}`;
    const adminReplyKey = `security-admin-reply-${stamp}`;
    const seeded = (await readDb<Record<string, any>>('messages/msg-1')) ?? null;
    expect(seeded).toBeTruthy();
    const base = 'http://localhost:9000/messages';
    const query = (token?: string) =>
      `ns=lecoursville-dev-default-rtdb${token ? `&auth=${token}` : ''}`;
    const put = (path: string, body: unknown, token: string = userToken) =>
      fetch(`${base}/${path}.json?${query(token)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    const patch = (path: string, body: unknown, token: string = userToken) =>
      fetch(`${base}/${path}.json?${query(token)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    const message = (id: string, authorId: string, authorName: string, extra = {}) => ({
      id,
      authorId,
      authorName,
      title: 'Security message',
      body: 'Written by its author',
      messageType: 'chat',
      isReply: false,
      replyLevel: 0,
      likes: [],
      replies: [],
      dateSent: Date.now(),
      isSticky: false,
      isEditable: false,
      isSaved: true,
      isDeleted: false,
      attachmentId: '',
      attachmentType: '',
      attachmentUrl: '',
      ...extra,
    });
    const reply = (id: string, authorId: string, authorName: string, extra = {}) =>
      message(id, authorId, authorName, { isReply: true, replyLevel: 1, ...extra });

    try {
      // A member cannot create a message as someone else, and anonymous writes
      // are denied entirely.
      expect((await put(forgedKey, message(forgedKey, adminUid, 'Admin User'))).status).not.toBe(200);
      expect(
        (
          await fetch(`${base}/${forgedKey}.json?${query()}`, {
            method: 'PUT',
            body: JSON.stringify(message(forgedKey, adminUid, 'Admin User')),
          })
        ).status,
      ).not.toBe(200);

      expect((await put(ownKey, message(ownKey, userUid, 'Regular User'))).ok).toBe(true);

      // The create-time storage allowlist must keep holding once the record
      // exists, so a member cannot swap in an arbitrary attachment URL.
      expect(
        (await patch(ownKey, { attachmentUrl: 'https://evil.example/x.png' })).status,
      ).not.toBe(200);
      expect(
        (await readDb<Record<string, any>>(`messages/${ownKey}`))?.attachmentUrl,
      ).toBe('');
      expect(
        (await patch(ownKey, { attachmentUrl: storageUrl('photos/album-1/photo-0-0.png') })).ok,
      ).toBe(true);

      // Writable payload fields stay strings and within bounds on update.
      expect((await patch(ownKey, { body: 42 })).status).not.toBe(200);
      expect((await patch(ownKey, { title: 'x'.repeat(201) })).status).not.toBe(200);
      expect((await patch(ownKey, { attachmentType: 'x'.repeat(101) })).status).not.toBe(200);

      // Another member's body, author, and nested reply tree are all off limits.
      expect(
        (await put('msg-1', { ...seeded, body: 'hijacked' })).status,
      ).not.toBe(200);
      expect(
        (
          await put('msg-1', {
            ...seeded,
            replies: [{ ...reply('forged-nested', adminUid, 'Admin User') }],
          })
        ).status,
      ).not.toBe(200);
      expect((await fetch(`${base}/msg-1.json?${query(userToken)}`, { method: 'DELETE' })).status)
        .not.toBe(200);
      expect((await readDb<Record<string, any>>('messages/msg-1'))?.body).toBe(seeded.body);

      // An author cannot hand their own message to another identity.
      expect((await patch(ownKey, { authorId: adminUid })).status).not.toBe(200);
      expect((await readDb<Record<string, any>>(`messages/${ownKey}`))?.authorId).toBe(userUid);

      // Likes are child writes keyed by the liker, and only the liker.
      await deleteDb(`messages/msg-1/likes/${userUid}`);
      expect(
        (
          await put(`msg-1/likes/${userUid}`, {
            userId: userUid,
            userName: 'Regular User',
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await put(`msg-1/likes/${adminUid}`, {
            userId: adminUid,
            userName: 'Admin User',
          })
        ).status,
      ).not.toBe(200);

      // Replies are child writes whose author is pinned to the caller.
      expect((await put(`msg-1/replies/${replyKey}`, reply(replyKey, userUid, 'Regular User'))).ok)
        .toBe(true);
      expect(
        (
          await put(
            `msg-1/replies/forged-reply`,
            reply('forged-reply', adminUid, 'Admin User'),
          )
        ).status,
      ).not.toBe(200);

      // Admin-authored replies cannot be edited by a member.
      expect(
        (
          await put(
            `msg-1/replies/${adminReplyKey}`,
            reply(adminReplyKey, adminUid, 'Admin User'),
            adminToken,
          )
        ).ok,
      ).toBe(true);
      expect((await patch(`msg-1/replies/${adminReplyKey}`, { body: 'hijacked' })).status)
        .not.toBe(200);

      // Create constraints: id, sticky, author name, attachment URL, date.
      expect(
        (await put(`security-id-${stamp}`, message('different-id', userUid, 'Regular User'))).status,
      ).not.toBe(200);
      expect(
        (
          await put(
            `security-sticky-${stamp}`,
            message(`security-sticky-${stamp}`, userUid, 'Regular User', { isSticky: true }),
          )
        ).status,
      ).not.toBe(200);
      expect(
        (
          await put(
            `security-name-${stamp}`,
            message(`security-name-${stamp}`, userUid, 'n'.repeat(101)),
          )
        ).status,
      ).not.toBe(200);
      expect(
        (
          await put(
            `security-url-${stamp}`,
            message(`security-url-${stamp}`, userUid, 'Regular User', {
              attachmentUrl: 'https://evil.example/x.png',
            }),
          )
        ).status,
      ).not.toBe(200);
      expect(
        (
          await put(
            `security-date-${stamp}`,
            message(`security-date-${stamp}`, userUid, 'Regular User', {
              dateSent: Date.now() - 25 * 60 * 60 * 1000,
            }),
          )
        ).status,
      ).not.toBe(200);
    } finally {
      await writeDb('messages/msg-1', seeded);
      await deleteDb(`messages/${ownKey}`);
      await deleteDb(`messages/${forgedKey}`);
      await deleteDb(`messages/security-id-${stamp}`);
      await deleteDb(`messages/security-sticky-${stamp}`);
      await deleteDb(`messages/security-name-${stamp}`);
      await deleteDb(`messages/security-url-${stamp}`);
      await deleteDb(`messages/security-date-${stamp}`);
    }
  });

  test('rules: message identity is pinned to the writer profile name', async () => {
    // Chat authorName is identity, so it must equal users/<uid>/name; a missing
    // profile name is rejected rather than falling back to the email local part.
    // Expression authorName stays a content field: blank or the writer's own
    // name is accepted, and admins may set any author for quoted material.
    const token = await idToken(E2E_USERS.user.email, E2E_USERS.user.password);
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const uid = Object.entries(users).find(
      ([, value]) => value?.email === E2E_USERS.user.email,
    )?.[0] as string;
    const profileName = await readDb<string>(`users/${uid}/name`);
    expect(profileName).toBeTruthy();
    const stamp = Date.now();
    const key = `security-identity-${stamp}`;
    const base = 'http://localhost:9000/messages';
    const query = `ns=lecoursville-dev-default-rtdb&auth=${token}`;
    const record = (authorName: unknown) => ({
      id: key,
      authorId: uid,
      authorName,
      title: 'Identity probe',
      body: 'Pinned author',
      messageType: 'chat',
      isReply: false,
      replyLevel: 0,
      likes: [],
      replies: [],
      dateSent: Date.now(),
      isSticky: false,
      isEditable: false,
      isSaved: true,
      isDeleted: false,
      attachmentId: '',
      attachmentType: '',
      attachmentUrl: '',
    });
    const put = (body: unknown) =>
      fetch(`${base}/${key}.json?${query}`, { method: 'PUT', body: JSON.stringify(body) });

    try {
      // Another member's name is rejected outright.
      expect((await put(record('Admin User'))).status).not.toBe(200);

      // A member with no profile name is rejected rather than allowed to
      // self-attribute with an email-local-part fallback.
      await writeDb(`users/${uid}/name`, null);
      expect(
        (await put(record(E2E_USERS.user.email.split('@')[0]))).status,
      ).not.toBe(200);
      await writeDb(`users/${uid}/name`, profileName);

      // The actual profile name is accepted.
      expect((await put(record(profileName))).ok).toBe(true);

      const like = (userName: unknown) =>
        fetch(`${base}/msg-1/likes/${uid}.json?${query}`, {
          method: 'PUT',
          body: JSON.stringify({ userId: uid, userName }),
        });
      await deleteDb(`messages/msg-1/likes/${uid}`);
      expect((await like('Admin User')).status).not.toBe(200);
      expect((await like(profileName)).ok).toBe(true);
    } finally {
      await writeDb(`users/${uid}/name`, profileName);
      await deleteDb(`messages/${key}`);
      await deleteDb(`messages/msg-1/likes/${uid}`);
    }
  });

  test('rules: users is own-record or super, not the authenticated roster', async () => {
    const userToken = await idToken(E2E_USERS.user.email, E2E_USERS.user.password);
    const staffToken = await idToken(E2E_USERS.staff.email, E2E_USERS.staff.password);
    const superToken = await idToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const uidFor = (email: string) =>
      Object.entries(users).find(([, value]) => value?.email === email)?.[0] as string;
    const userUid = uidFor(E2E_USERS.user.email);
    const adminUid = uidFor(E2E_USERS.admin.email);

    const read = (path: string, token: string) =>
      fetch(`http://localhost:9000/${path}.json?ns=lecoursville-dev-default-rtdb&auth=${token}`);

    expect((await read(`users/${userUid}`, userToken)).ok).toBe(true);
    expect((await read(`users/${adminUid}`, userToken)).status).not.toBe(200);
    expect((await read('users', staffToken)).status).not.toBe(200);
    expect((await read(`users/${userUid}`, staffToken)).status).not.toBe(200);
    expect((await read('users', superToken)).ok).toBe(true);
  });

  test('rules: media and clans require authentication', async () => {
    const token = await idToken(E2E_USERS.user.email, E2E_USERS.user.password);
    for (const node of ['media', 'clans']) {
      const anonymous = await fetch(
        `http://localhost:9000/${node}.json?ns=lecoursville-dev-default-rtdb`,
      );
      expect(anonymous.status).not.toBe(200);

      const authenticated = await fetch(
        `http://localhost:9000/${node}.json?ns=lecoursville-dev-default-rtdb&auth=${token}`,
      );
      expect(authenticated.ok).toBe(true);
    }
  });

  test('reset link: an alternate contact is only emailed when the admin opts in', async () => {
    const token = await idToken(E2E_USERS.admin.email, E2E_USERS.admin.password);
    const stamp = Date.now();
    const noSendId = `security-reset-nosend-${stamp}`;
    const sendId = `security-reset-send-${stamp}`;
    const noSendAlt = `security-nosend-${stamp}@e2e.local`;
    const sendAlt = `security-send-${stamp}@e2e.local`;
    const email = E2E_USERS.user.email;
    const call = (requestId: string, extra: Record<string, unknown> = {}) =>
      fetch(
        'http://127.0.0.1:5001/lecoursville-dev/us-central1/adminGenerateResetLink',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            data: {
              requestId,
              email,
              reason: 'security regression',
              continueUrl: 'http://localhost:5000/auth/action',
              ...extra,
            },
          }),
        },
      );
    const auditFor = async (requestId: string) => {
      const all = (await readDb<Record<string, any>>('recoveryAudit')) ?? {};
      return Object.values(all).find(
        (entry) => entry?.requestId === requestId && entry?.action === 'generate_reset_link',
      ) as Record<string, any> | undefined;
    };
    const cleanup = async () => {
      for (const id of [noSendId, sendId]) {
        await deleteDb(`recoveryRequests/${id}`);
        const all = (await readDb<Record<string, any>>('recoveryAudit')) ?? {};
        for (const [key, entry] of Object.entries(all)) {
          if (entry?.requestId === id) {
            await deleteDb(`recoveryAudit/${key}`);
          }
        }
      }
      for (const mail of await findOutboundEmails('recovery_link')) {
        if (mail.to === noSendAlt || mail.to === sendAlt) {
          await deleteDb(`outboundEmails/${mail.key}`);
        }
      }
    };

    await writeDb(`recoveryRequests/${noSendId}`, {
      id: noSendId,
      email,
      alternateContact: noSendAlt,
      status: 'open',
      createdAt: stamp,
      updatedAt: stamp,
    });
    await writeDb(`recoveryRequests/${sendId}`, {
      id: sendId,
      email,
      alternateContact: sendAlt,
      status: 'open',
      createdAt: stamp,
      updatedAt: stamp,
    });

    try {
      const denied = await call(noSendId);
      expect(denied.ok).toBe(true);
      const deniedBody = await denied.json();
      expect(deniedBody.result.link).toContain('oobCode');
      expect(deniedBody.result.emailed).toBe(false);
      expect(await findOutboundEmails('recovery_link', { to: noSendAlt })).toEqual([]);
      await expect.poll(async () => (await auditFor(noSendId))?.emailStatus).toBe('skipped');
      expect((await auditFor(noSendId))?.emailed).toBe(false);

      const optedIn = await call(sendId, { emailAlternateContact: true });
      expect(optedIn.ok).toBe(true);
      const optedInBody = await optedIn.json();
      expect(optedInBody.result.emailed).toBe(true);
      await expect
        .poll(async () => (await findOutboundEmails('recovery_link', { to: sendAlt })).length)
        .toBeGreaterThan(0);
      await expect.poll(async () => (await auditFor(sendId))?.emailStatus).toBe('sent');
      expect((await auditFor(sendId))?.emailed).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
