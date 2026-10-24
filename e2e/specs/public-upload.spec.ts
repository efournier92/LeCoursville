import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, deleteDb } from '../helpers/admin-db';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const STORAGE_ORIGIN = 'http://127.0.0.1:9199';
const STORAGE_BUCKET = 'lecoursville-dev.appspot.com';

function storageObjectUrl(path: string): string {
  return `${STORAGE_ORIGIN}/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}`;
}

test.describe('public upload', () => {
  test('unauthenticated access: /upload renders without login', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByRole('heading', { name: 'Upload Files' })).toBeVisible();
    await expect(page.getByText('Click To Select Files')).toBeVisible();
  });

  test('happy path: upload creates a pending record visible to admin', async ({ page }) => {
    await page.goto('/upload');
    await page.getByLabel('Event Name').fill('E2E Reunion Upload');
    await page.getByTestId('upload-file-input').setInputFiles({
      name: 'family-photo.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('1 File Selected')).toBeVisible();
    await page.getByRole('button', { name: 'Upload All' }).click();
    await expect(page.getByText('Thanks For Sharing!')).toBeVisible({ timeout: 30000 });

    // Admin sees the new pending upload in the review queue.
    await login(page, 'admin');
    await page.goto('/admin/uploads');
    await expect(page.getByText('family-photo.png').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Pending').first()).toBeVisible();
  });

  test('signed-in member can upload', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/upload');
    await page.getByLabel('Event Name').fill('E2E Member Upload');
    await page.getByTestId('upload-file-input').setInputFiles({
      name: 'member-photo.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('1 File Selected')).toBeVisible();
    await page.getByRole('button', { name: 'Upload All' }).click();
    await expect(page.getByText('Thanks For Sharing!')).toBeVisible({ timeout: 30000 });
  });

  test('validation: submit with no file is impossible (no upload button rendered)', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/upload');
    // Prove the page mounted before asserting absence; otherwise this passes on
    // a blank body.
    await expect(page.getByRole('heading', { name: 'Upload Files' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    // The file list (and its Upload All button) only renders once files are selected.
    await expect(page.getByRole('button', { name: 'Upload All' })).toHaveCount(0);
    const uploadRequests = requests.filter((u) => u.includes(':9199'));
    expect(uploadRequests).toHaveLength(0);
  });

  test('characterization: a text file is accepted today (accepted risk)', async ({ page }) => {
    // Ledger C-20261023-13: the public upload has no content-type gate, and the
    // deployed Storage rules check size but not type, so text is stored as-is.
    // Pinned deliberately; changing the posture is its own decision.
    const before = (await readDb<Record<string, any>>('userUploads')) ?? {};
    let created: { id: string; path: string } | null = null;
    try {
      await page.goto('/upload');
      await page.getByLabel('Event Name').fill('E2E Text Upload');
      await page.getByTestId('upload-file-input').setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('plain text'),
      });
      await expect(page.getByText('1 File Selected')).toBeVisible();
      await page.getByRole('button', { name: 'Upload All' }).click();
      await expect(page.getByText('Thanks For Sharing!')).toBeVisible({ timeout: 30000 });

      const after = (await readDb<Record<string, any>>('userUploads')) ?? {};
      const entry = Object.entries(after)
        .filter(([id, record]) => !(id in before) && record?.fileName === 'notes.txt')
        .sort((a, b) => (b[1].dateAdded ?? 0) - (a[1].dateAdded ?? 0))[0];
      expect(entry).toBeTruthy();
      created = { id: entry[0], path: entry[1].path };

      expect(entry[1].status).toBe('pending');
      expect(entry[1].fileName).toBe('notes.txt');
      // The callable owns the path: userUploads/<id>/<batch>/notes.txt.
      expect(created.path.startsWith(`userUploads/${created.id}/`)).toBe(true);
      expect(created.path.endsWith('/notes.txt')).toBe(true);

      await expect.poll(async () => (await fetch(storageObjectUrl(created!.path))).status).toBe(200);
      const metadata = await (await fetch(storageObjectUrl(created.path))).json();
      expect(metadata.contentType).toBe('text/plain');
      expect(Number(metadata.size)).toBe(Buffer.byteLength('plain text'));
    } finally {
      if (created) {
        await deleteDb(`userUploads/${created.id}`);
        await fetch(storageObjectUrl(created.path), { method: 'DELETE' }).catch(() => undefined);
      }
    }
  });
});
