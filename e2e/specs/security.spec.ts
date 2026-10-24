import { test, expect, Page } from '../helpers/fixture';
import type { Locator } from '@playwright/test';
import { login, logout } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';
import { deleteDb, readDb, writeDb } from '../helpers/admin-db';

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

/** Angular keeps sanitized markup, so prove no inline __xss handler survived the render tree. */
async function expectNoInjectedHandler(page: Page): Promise<void> {
  const handlers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('*')).flatMap((el) =>
      Array.from(el.attributes)
        .filter(
          (attr) => attr.name.toLowerCase() === 'onerror' && attr.value.includes('__xss'),
        )
        .map((attr) => attr.value),
    ),
  );
  expect(handlers).toEqual([]);
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
    await expectNoInjectedHandler(page);
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
    await expectNoInjectedHandler(page);
    const xss = await page.evaluate(() => (window as any).__xss ?? 0);
    expect(xss).toBe(0);
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
    const walks: { route: string; content: (p: Page) => Locator }[] = [
      { route: '/contacts', content: (p) => p.locator('.contacts-grid') },
      { route: '/calendar', content: (p) => p.locator('app-calendar-view.calendar-view-component') },
      { route: '/expressions', content: (p) => p.locator('.expression-card-wrapper').first() },
      { route: '/photos', content: (p) => p.locator('.album-tile-title', { hasText: 'E2E Album One' }) },
      { route: '/people', content: (p) => p.locator('.family-group').first() },
      { route: '/media/explorer', content: (p) => p.locator('.media-list-item', { hasText: 'E2E Doc' }) },
      { route: '/upload', content: (p) => p.getByRole('heading', { name: 'Upload Files' }) },
    ];
    for (const { route, content } of walks) {
      await page.goto(route);
      await expect(content(page)).toBeVisible();
      await page.waitForLoadState('networkidle');
    }
    // Only the seeded Drive video iframe and its Google API loader are known
    // external URLs (aborted, not loaded). The Drive player iframe itself
    // requests apis.google.com/js/api.js from inside the iframe.
    const unexpected = external.filter(
      (u) => !u.includes('drive.google.com') && !u.includes('apis.google.com'),
    );
    expect(unexpected).toEqual([]);
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
});
