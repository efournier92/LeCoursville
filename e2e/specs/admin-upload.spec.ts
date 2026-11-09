import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, Locator } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb } from '../helpers/admin-db';
import { sinkGet, sinkHead, sinkUrl } from '../helpers/sink';

/**
 * Admin Media Upload against the emulator, driven by the pinned fixture that
 * scripts/e2e/seed.mjs writes. The gate stays offline and deterministic, and
 * nothing here downloads from a live archive.
 */

const FIXTURE = join(
  process.cwd(),
  'dist/lecoursville/browser/assets/e2e-fixtures/fixture.mp4',
);

interface MediaRecord {
  id: string;
  title: string;
  fileName?: string;
  type?: string;
  format?: string;
  urls?: { download: string; icon: string };
  storage?: {
    managed?: boolean;
    key?: string;
    iconKey?: string;
    batchId?: string;
    bytes?: number;
    contentType?: string;
  };
  [field: string]: unknown;
}

async function findMediaByKey(key: string): Promise<MediaRecord | null> {
  const media = (await readDb<Record<string, MediaRecord>>('media')) ?? {};
  return Object.values(media).find((record) => record?.storage?.key === key) ?? null;
}

async function cleanupRecord(id: string | null | undefined, batchId?: string | null): Promise<void> {
  if (!id) {
    return;
  }
  const record = await readDb<MediaRecord>(`media/${id}`);
  const batch = batchId ?? record?.storage?.batchId;
  await deleteDb(`media/${id}`);
  await deleteDb(`mediaDeletions/${id}`);
  if (batch) {
    await deleteDb(`mediaUploads/${batch}`);
  }
}

/** Opens the Advanced disclosure without toggling it closed when it is open. */
async function openAdvanced(form: Locator): Promise<void> {
  const details = form.locator('details.media-form-advanced');
  if (!(await details.evaluate((el: HTMLDetailsElement) => el.open))) {
    await details.locator('summary').click();
  }
  await expect(details).toHaveJSProperty('open', true);
}

test('pinned fixture uploads through the admin UI and stores the object and record', async ({ page }) => {
  const fixtureBytes = readFileSync(FIXTURE);
  const storageName = `e2e-admin-upload-${Date.now()}`;
  const key = `Video/${storageName}.mp4`;
  const iconKey = `Video/Icons/${storageName}.jpg`;
  let created: MediaRecord | null = null;

  try {
    await login(page, 'admin');
    await page.goto('/admin/media');

    const form = page.locator('.admin-media-upload-upload-form');
    await page.getByTestId('video-file-input').setInputFiles(FIXTURE);
    await expect(form.locator('input[name="videoStorageName"]')).not.toHaveValue('');

    // File selection starts async thumbnail capture. Wait for it to settle
    // before supplying the override so the two do not race.
    const settled = page
      .getByTestId('video-thumbnail-preview')
      .or(page.getByTestId('video-upload-error'));
    await expect(settled).toBeVisible();
    await page.getByTestId('video-thumbnail-input').setInputFiles(FIXTURE);
    await expect(page.getByTestId('video-thumbnail-preview')).toBeVisible();
    await openAdvanced(form);

    await form.locator('input[name="videoTitle"]').fill('admin upload');
    await expect(form.locator('input[name="videoTitle"]')).toHaveValue('admin upload');
    await form.locator('input[name="videoDate"]').fill('2026');
    await form.locator('input[name="videoStorageName"]').fill(storageName);
    await form.locator('.admin-form-action-button-upload').click();
    await expect(page.getByTestId('video-upload-success')).toContainText('Saved "admin upload".');

    await expect.poll(async () => (await findMediaByKey(key))?.id ?? null).not.toBeNull();
    created = await findMediaByKey(key);

    expect(created?.title).toBe('admin upload');
    expect(created?.type).toBe('video');
    expect(created?.format).toBe('video/mp4');
    expect(created?.fileName).toBe(`${storageName}.mp4`);
    expect(created?.urls?.download).toBe(sinkUrl(key));
    expect(created?.urls?.icon).toBe(sinkUrl(iconKey));
    expect(created?.storage?.managed).toBe(true);
    expect(created?.storage?.key).toBe(key);
    expect(created?.storage?.iconKey).toBe(iconKey);
    expect(created?.storage?.bytes).toBe(fixtureBytes.length);

    const stored = await sinkHead(key);
    expect(stored).not.toBeNull();
    expect(stored?.size).toBe(fixtureBytes.length);
    expect(stored?.contentType).toBe('video/mp4');
    const storedBytes = await sinkGet(key);
    expect(storedBytes).not.toBeNull();
    expect(storedBytes?.equals(fixtureBytes)).toBe(true);
    expect(stored?.batchId).toBe(created?.storage?.batchId);
    expect((await sinkHead(iconKey))?.batchId).toBe(created?.storage?.batchId);
  } finally {
    await cleanupRecord(created?.id);
  }
});
