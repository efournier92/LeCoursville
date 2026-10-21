import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb, writeDb } from '../helpers/admin-db';

const STORAGE_ORIGIN = 'http://127.0.0.1:9199';
const STORAGE_BUCKET = 'lecoursville-dev.appspot.com';
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Download URL the app's Storage SDK can parse (host must match its emulator). */
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

test.afterEach(async ({ collector }) => collector.assertClean());

test.describe('admin content surfaces', () => {
  test('media: only the live tabs render, and a filtered-out tab shows an empty message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');

    await expect(page.getByRole('tab', { name: 'Video' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Audio Album' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(2);

    const audioTab = page.getByRole('tab', { name: 'Audio Album' });
    await audioTab.click();
    const activeTab = page.locator('.mat-mdc-tab-body-active');
    await expect(activeTab.locator('.media-list-item').first()).toBeVisible();

    // Filtering everything out must leave an explicit message, never a
    // blank pane.
    await activeTab.getByLabel('Filter').fill('zzz-no-match');
    await expect(activeTab.locator('.no-results-message')).toBeVisible();
    await expect(activeTab.locator('.no-results-message')).toContainText('No media match');

    await activeTab.getByLabel('Filter').fill('');
    await expect(activeTab.locator('.media-list-item').first()).toBeVisible();
  });

  test('photo albums: seeded albums render, and a throwaway album delete can be cancelled then confirmed', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/photo-albums');
    await expect(page.getByText('E2E Album One')).toBeVisible();
    await expect(page.locator('.admin-album-grid')).toBeVisible();

    await page.getByRole('button', { name: 'New Album' }).click();
    const createDialog = page.locator('mat-dialog-container');
    await createDialog.getByLabel('Album title').fill('E2E Throwaway Album');
    await createDialog.getByRole('button', { name: 'Create' }).click();

    const throwaway = page.locator('.admin-album-card', { hasText: 'E2E Throwaway Album' });
    await expect(throwaway).toBeVisible();

    await throwaway.locator('button[matTooltip="Delete"]').click();
    const confirm = page.locator('app-confirm-dialog');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('E2E Throwaway Album');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(throwaway).toBeVisible();

    await throwaway.locator('button[matTooltip="Delete"]').click();
    await page.locator('app-confirm-dialog').getByRole('button', { name: 'Delete album' }).click();
    await expect(throwaway).toBeHidden();
    await expect(page.getByText('E2E Album One')).toBeVisible();
  });

  test('uploads: pending and all filters, and a rejected upload is kept when the confirm is cancelled', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/uploads');

    // The seeded upload is approved, so the default pending queue is empty.
    await expect(page.getByText("You're all caught up")).toBeVisible();

    await page.getByRole('button', { name: /All \(\d+\)/ }).click();
    await expect(page.locator('.admin-table')).toBeVisible();
    await expect(page.getByText('fixture.png').first()).toBeVisible();

    await page.getByRole('button', { name: 'Reject fixture.png' }).click();
    const confirm = page.locator('app-confirm-dialog');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('fixture.png');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();

    await expect(page.getByText('fixture.png').first()).toBeVisible();
    await page.getByRole('button', { name: /Pending \(\d+\)/ }).click();
    await expect(page.getByText("You're all caught up")).toBeVisible();
  });

  test('uploads: a rejected upload is removed after confirming, and the seeded record is restored', async ({ page }) => {
    // The seed's fixture.png lives on Hosting, not in Storage, so the real
    // reject path cannot delete it. Point the seeded record at a throwaway
    // Storage object, exercise the actual delete, then restore the record.
    const original = await readDb('userUploads/upload-1');
    expect(original).not.toBeNull();
    await putStorageObject('userUploads/e2e-reject.png');
    await writeDb('userUploads/upload-1', {
      ...(original as Record<string, unknown>),
      url: storageUrl('userUploads/e2e-reject.png'),
      path: 'userUploads/e2e-reject.png',
      status: 'approved',
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/uploads');
      await page.getByRole('button', { name: /All \(\d+\)/ }).click();
      await expect(page.locator('.admin-table tbody tr').filter({ hasText: 'fixture.png' })).toBeVisible();

      await page.getByRole('button', { name: 'Reject fixture.png' }).click();
      const confirm = page.locator('app-confirm-dialog');
      await expect(confirm).toContainText('Reject upload?');
      await expect(confirm).toContainText('fixture.png');
      await confirm.getByRole('button', { name: 'Reject upload' }).click();

      await expect(page.getByText('No uploads yet')).toBeVisible();
      await expect(page.getByText('fixture.png')).toHaveCount(0);
      await expect.poll(async () => readDb('userUploads/upload-1')).toBeNull();
    } finally {
      await writeDb('userUploads/upload-1', original);
      await deleteStorageObject('userUploads/e2e-reject.png');
    }
  });

  test('uploads: a pending upload is approved through the album picker and cleaned up', async ({ page }) => {
    const uploadId = 'e2e-approve-upload';
    const sourcePath = 'userUploads/e2e-approve.png';
    const destPath = 'photos/album-1/e2e-approve.png';
    const originalAlbum = await readDb('photoAlbums/album-1');

    await putStorageObject(sourcePath);
    await writeDb(`userUploads/${uploadId}`, {
      id: uploadId,
      url: storageUrl(sourcePath),
      path: sourcePath,
      dateAdded: Date.now(),
      eventName: 'E2E Approve',
      status: 'pending',
      uploader: { name: 'Regular User', email: 'user@e2e.local' },
      fileName: 'e2e-approve.png',
      fileType: 'image/png',
      fileSize: TINY_PNG.length,
    });

    try {
      await login(page, 'admin');
      // Make sure the root album stream has settled before the picker opens.
      await page.goto('/admin/photo-albums');
      await expect(page.getByText('E2E Album One')).toBeVisible();
      await page.goto('/admin/uploads');
      const row = page.getByRole('row').filter({ hasText: 'e2e-approve.png' });
      await expect(row).toBeVisible();

      await page.getByRole('button', { name: 'Approve e2e-approve.png' }).click();
      const picker = page.locator('app-photo-album-picker-dialog');
      await expect(picker).toBeVisible();
      await picker.getByRole('radio', { name: 'Use existing album' }).click();
      await picker.locator('mat-select').click();
      await page.getByRole('option', { name: 'E2E Album One' }).click();
      await picker.getByRole('button', { name: 'Approve & Add' }).click();

      await expect
        .poll(async () => (await readDb<{ status?: string }>(`userUploads/${uploadId}`))?.status, {
          timeout: 15000,
        })
        .toBe('approved');
      // updateAlbum is the last write in the approval chain; wait for it before
      // restoring the seeded album in finally.
      await expect
        .poll(async () => (await readDb<{ updatedAt?: number }>('photoAlbums/album-1'))?.updatedAt)
        .not.toBe((originalAlbum as { updatedAt?: number } | null)?.updatedAt);

      await page.getByRole('button', { name: /All \(\d+\)/ }).click();
      await expect(
        page.getByRole('row').filter({ hasText: 'e2e-approve.png' }),
      ).toContainText('Approved');
    } finally {
      await deleteDb(`userUploads/${uploadId}`);
      const photos = (await readDb<Record<string, any>>('photos')) ?? {};
      for (const [id, photo] of Object.entries(photos)) {
        if (photo?.path === destPath) {
          await deleteDb(`photos/${id}`);
        }
      }
      if (originalAlbum === null) {
        await deleteDb('photoAlbums/album-1');
      } else {
        await writeDb('photoAlbums/album-1', originalAlbum);
      }
      await deleteStorageObject(sourcePath);
      await deleteStorageObject(destPath);
    }
  });

  test('390x844: the uploads table becomes cards and the album grid is one column without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');

    await page.goto('/admin/uploads');
    await page.getByRole('button', { name: /All \(\d+\)/ }).click();
    await expect(page.getByText('fixture.png').first()).toBeVisible();
    await expect(page.locator('.admin-table thead')).toBeHidden();
    await expect(page.locator('td[data-label="File"]')).toBeVisible();

    const uploadsOverflow = await page.evaluate(() => {
      const content = document.querySelector('.admin-content') as HTMLElement;
      return { scrollWidth: content.scrollWidth, clientWidth: content.clientWidth };
    });
    expect(uploadsOverflow.scrollWidth).toBeLessThanOrEqual(uploadsOverflow.clientWidth + 1);

    await page.goto('/admin/photo-albums');
    await expect(page.getByText('E2E Album One')).toBeVisible();
    const columns = await page
      .locator('.admin-album-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(1);

    const albumsOverflow = await page.evaluate(() => {
      const content = document.querySelector('.admin-content') as HTMLElement;
      return { scrollWidth: content.scrollWidth, clientWidth: content.clientWidth };
    });
    expect(albumsOverflow.scrollWidth).toBeLessThanOrEqual(albumsOverflow.clientWidth + 1);
  });
});
