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

async function storageObjectExists(path: string): Promise<boolean> {
  const response = await fetch(
    `${STORAGE_ORIGIN}/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}`,
  );
  return response.ok;
}

test.afterEach(async ({ collector }) => collector.assertClean());

test.describe('admin content surfaces', () => {
  test('media: only the live sections render, and a filtered-out section shows an empty message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');

    await expect(page.getByTestId('media-section-video')).toBeVisible();
    await expect(page.getByTestId('media-section-audio')).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);

    await page.getByTestId('media-section-audio').click();
    const audioPanel = page.locator('app-admin-media-upload-audio-album');
    await expect(audioPanel.locator('.media-list-item').first()).toBeVisible();

    // Filtering everything out must leave an explicit message, never a
    // blank pane.
    await audioPanel.getByLabel('Filter').fill('zzz-no-match');
    await expect(audioPanel.locator('.no-results-message')).toBeVisible();
    await expect(audioPanel.locator('.no-results-message')).toContainText('No media match');

    await audioPanel.getByLabel('Filter').fill('');
    await expect(audioPanel.locator('.media-list-item').first()).toBeVisible();
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
    // 30s timeout: webkit full-suite load can exceed the 15s default (ledger C-20261023-01).
    await expect(confirm).toBeVisible({ timeout: 30_000 });
    await expect(confirm).toContainText('E2E Throwaway Album');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(throwaway).toBeVisible();

    await throwaway.locator('button[matTooltip="Delete"]').click();
    // 30s timeout: webkit full-suite load can exceed the 15s default (ledger C-20261023-01).
    await expect(confirm).toBeVisible({ timeout: 30_000 });
    await page.locator('app-confirm-dialog').getByRole('button', { name: 'Delete album' }).click();
    await expect(throwaway).toBeHidden();
    await expect(page.getByText('E2E Album One')).toBeVisible();
  });

  test('photo albums: grid follows the density ladder and covers crop 4:3', async ({ page }) => {
    await login(page, 'admin');

    for (const [width, expected] of [[1600, 5], [1280, 4], [390, 1]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/admin/photo-albums');
      await expect(page.locator('.admin-album-card').first()).toBeVisible();
      const columns = await page
        .locator('.admin-album-grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(expected);
    }

    const cover = await page.locator('.admin-album-card .album-cover').first().boundingBox();
    expect(cover!.width / cover!.height).toBeCloseTo(4 / 3, 1);
  });

  test('photo albums: deleting an album cascades to its photo record and Storage object', async ({ page }) => {
    const albumsBefore = (await readDb<Record<string, any>>('photoAlbums')) ?? {};
    const photosBefore = (await readDb<Record<string, any>>('photos')) ?? {};
    expect(albumsBefore['album-3']).toBeTruthy();
    expect(photosBefore['photo-3-1']).toBeTruthy();
    expect(await storageObjectExists('photos/album-3/photo1.png')).toBe(true);

    await login(page, 'admin');
    await page.goto('/admin/photo-albums');
    const card = page.locator('.admin-album-card', { hasText: 'E2E Delete Album' });
    await expect(card).toBeVisible();

    await card.locator('button[aria-label="Delete album"]').click();
    const confirm = page.locator('app-confirm-dialog');
    await expect(confirm).toContainText('E2E Delete Album');
    await expect(confirm).toContainText('1 photo');
    await confirm.getByRole('button', { name: 'Delete album' }).click();

    await expect.poll(async () => readDb('photoAlbums/album-3')).toBeNull();
    await expect.poll(async () => readDb('photos/photo-3-1')).toBeNull();
    await expect
      .poll(async () => storageObjectExists('photos/album-3/photo1.png'))
      .toBe(false);

    const albumsAfter = (await readDb<Record<string, any>>('photoAlbums')) ?? {};
    const photosAfter = (await readDb<Record<string, any>>('photos')) ?? {};
    delete albumsBefore['album-3'];
    delete photosBefore['photo-3-1'];
    expect(albumsAfter).toEqual(albumsBefore);
    expect(photosAfter).toEqual(photosBefore);
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
        // Approvals now suffix the destination with the photo push id, so match
        // the suffix as well as the legacy exact path.
        const path = String(photo?.path ?? '');
        if (path === destPath || path.endsWith('_e2e-approve.png')) {
          await deleteDb(`photos/${id}`);
          await deleteStorageObject(path);
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

  test('uploads: the preview dialog names the uploader and event, and reject closes it', async ({ page }) => {
    const uploadId = `e2e-preview-${Date.now()}`;
    const fileName = `${uploadId}.png`;
    const path = `userUploads/${fileName}`;

    await putStorageObject(path);
    await writeDb(`userUploads/${uploadId}`, {
      id: uploadId,
      url: storageUrl(path),
      path,
      dateAdded: Date.now(),
      eventName: 'E2E Preview',
      status: 'pending',
      uploader: { name: 'Regular User', email: 'user@e2e.local' },
      fileName,
      fileType: 'image/png',
      fileSize: TINY_PNG.length,
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/uploads');
      await expect(page.getByRole('button', { name: `Preview ${fileName}` })).toBeVisible();

      await page.getByRole('button', { name: `Preview ${fileName}` }).click();
      const preview = page.locator('.upload-preview-dialog');
      await expect(preview).toContainText('Uploaded by Regular User');
      await expect(preview).toContainText('Event: E2E Preview');

      await preview.getByRole('button', { name: 'Reject' }).click();
      const confirm = page.locator('app-confirm-dialog');
      await expect(confirm).toContainText('Reject upload?');
      await confirm.getByRole('button', { name: 'Reject upload' }).click();

      await expect(preview).toBeHidden();
      await expect(page.getByText("You're all caught up")).toBeVisible();
      await expect.poll(async () => readDb(`userUploads/${uploadId}`)).toBeNull();
    } finally {
      await deleteDb(`userUploads/${uploadId}`);
      await deleteStorageObject(path);
    }
  });

  test('calendars and families: Add focuses the first field; calendar links open safely in a new tab', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/calendars');

    const year = new Date().getFullYear().toString();
    const row = page.locator('.admin-table tbody tr').filter({ hasText: year });
    await expect(row.getByRole('button', { name: `Edit ${year}` })).toBeVisible();
    await expect(row.getByRole('button', { name: `Delete ${year}` })).toBeVisible();

    const link = row.locator('a.calendar-url-link');
    await expect(link).toHaveAttribute('target', '_blank');
    expect(await link.getAttribute('rel')).toContain('noopener');
    expect(await link.getAttribute('rel')).toContain('noreferrer');

    await page.getByRole('button', { name: 'Add Calendar' }).click();
    const yearInput = page.getByLabel('Year (e.g. 2026)');
    await expect(yearInput).toBeFocused();
    await yearInput.fill(year);
    await page.getByLabel('Firebase Storage URL').fill('https://example.test/replacement.pdf');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    const confirm = page.locator('app-confirm-dialog');
    await expect(confirm).toContainText(`A calendar already exists for ${year}`);
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(yearInput).toHaveValue(year);

    await page.goto('/admin/families');
    await expect(page.locator('.families-table tbody tr')).toHaveCount(2, { timeout: 20000 });
    await page.getByRole('button', { name: 'Add Family' }).click();
    await expect(page.getByLabel('Sort Order')).toBeFocused();
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

  test('390x844: filter rows and album drill-in actions stay reachable without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');

    const assertNoOverflow = async () => {
      const content = await page.evaluate(() => {
        const el = document.querySelector('.admin-content') as HTMLElement;
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      });
      expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
    };

    await page.goto('/admin/uploads');
    const uploadsFilters = page.locator('.admin-filter-bar');
    await expect(uploadsFilters).toBeVisible();
    const segmentedHeight = await page
      .locator('.gallery-segmented')
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(segmentedHeight).toBe(36);
    await expect(page.getByRole('button', { name: 'Storage' })).toBeVisible();
    await assertNoOverflow();

    await page.goto('/admin/photo-albums');
    await expect(page.locator('.admin-filter-bar')).toBeVisible();
    await expect(page.getByLabel('Search albums')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Album' })).toBeVisible();
    await assertNoOverflow();

    await page.locator('.admin-album-card', { hasText: 'E2E Album One' }).click();
    await expect(page.locator('.album-photos-header')).toBeVisible();
    for (const name of ['Add Photos', 'Rename', 'Delete Album']) {
      const action = page.getByRole('button', { name });
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    }
    await assertNoOverflow();

    await page.getByRole('button', { name: 'Rename' }).click();
    const renameDialog = page.locator('mat-dialog-container');
    await expect(renameDialog.getByRole('heading', { name: 'Edit Album' })).toBeVisible();
    await expect(renameDialog.getByLabel('Album title')).toHaveValue('E2E Album One');
    await renameDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(renameDialog).toBeHidden();
  });
});
