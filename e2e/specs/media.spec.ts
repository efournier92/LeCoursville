import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, Page, Locator } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb, writeDb } from '../helpers/admin-db';
import { sinkGet, sinkHead, sinkUrl } from '../helpers/sink';

test.afterEach(async ({ collector }) => collector.assertClean());

const FIXTURE_DIR = join(process.cwd(), 'dist/lecoursville/browser/assets/e2e-fixtures');
const fixturePath = (name: string): string => join(FIXTURE_DIR, name);

interface MediaRecord {
  id: string;
  title: string;
  fileName?: string;
  duration?: string;
  urls?: { download: string; icon: string };
  type?: string;
  format?: string;
  storage?: {
    managed?: boolean;
    key?: string;
    iconKey?: string;
    batchId?: string;
    bytes?: number;
    contentType?: string;
    uploadedByHash?: string;
  };
  [field: string]: unknown;
}

function mediaRow(page: Page, title: string): Locator {
  return page.locator('.media-list-item').filter({ hasText: title }).first();
}

async function allMedia(): Promise<Record<string, MediaRecord>> {
  return (await readDb<Record<string, MediaRecord>>('media')) ?? {};
}

async function findMediaByTitle(title: string): Promise<MediaRecord | null> {
  const media = await allMedia();
  return Object.values(media).find((record) => record?.title === title) ?? null;
}

async function findMediaByKey(key: string): Promise<MediaRecord | null> {
  const media = await allMedia();
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

/**
 * Selects the MP4 and settles thumbnail capture before supplying the override.
 * Waiting for either the preview or the capture error keeps the override from
 * racing the async frame capture that file selection starts.
 */
async function prepareVideo(page: Page, fileName = 'fixture.mp4'): Promise<Locator> {
  const form = page.locator('.admin-media-upload-upload-form');
  await page.getByTestId('video-file-input').setInputFiles(fixturePath(fileName));
  await expect(form.locator('input[name="videoStorageName"]')).not.toHaveValue('');
  const settled = page
    .getByTestId('video-thumbnail-preview')
    .or(page.getByTestId('video-upload-error'));
  await expect(settled).toBeVisible();
  await page.getByTestId('video-thumbnail-input').setInputFiles(fixturePath('fixture.png'));
  await expect(page.getByTestId('video-thumbnail-preview')).toBeVisible();
  return form;
}

async function waitForRecordByKey(storageName: string): Promise<MediaRecord> {
  const key = `Video/${storageName}.mp4`;
  await expect.poll(async () => (await findMediaByKey(key))?.id ?? null).not.toBeNull();
  return (await findMediaByKey(key)) as MediaRecord;
}

async function uploadManaged(
  page: Page,
  storageName: string,
  title?: string,
): Promise<MediaRecord> {
  const form = await prepareVideo(page);
  if (title !== undefined) {
    await form.locator('input[name="videoTitle"]').fill(title);
  }
  await form.locator('input[name="videoDate"]').fill('2026');
  await form.locator('input[name="videoStorageName"]').fill(storageName);
  await form.locator('.admin-form-action-button-upload').click();
  await expect(page.getByTestId('video-upload-success')).toContainText(
    `Saved "${title ?? 'fixture'}".`,
  );
  return waitForRecordByKey(storageName);
}

test.describe('media', () => {
  test('signed-out explorer without an id redirects to sign-in', async ({ page }) => {
    await page.goto('/media/explorer');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('auth-email')).toBeVisible();
  });

  test('signed-out audio and video routes still redirect to sign-in', async ({ page }) => {
    for (const route of ['/media/audio', '/media/video']) {
      await page.goto(route);
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('auth-email')).toBeVisible();
    }
  });

  test('signed-out shared link plays the referenced item', async ({ page }) => {
    await page.goto('/media/explorer?id=media-audio');
    await expect(page).toHaveURL(/\/media\/explorer\?id=media-audio$/);
    await expect(page.locator('.audio-player-container')).toBeVisible();
    await expect(page.locator('.audio-player-element')).toHaveAttribute('src', /fixture\.wav/);
    await expect(page.getByTestId('auth-email')).toHaveCount(0);
    await expect(page.locator('.media-list-item')).toHaveCount(0);

    // A copied link to a Drive video must also open signed out. Stub the
    // external iframe so the assertion does not depend on the network.
    await page.route('https://drive.google.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }),
    );
    await page.goto('/media/explorer?id=media-video', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/media\/explorer\?id=media-video$/);
    const videoFrame = page.locator('app-video-player-drive-iframe iframe.video-iframe');
    await expect(videoFrame).toBeVisible();
    await expect(videoFrame).toHaveAttribute(
      'src',
      'https://drive.google.com/file/d/e2efixture/preview',
    );
    await expect(page.getByTestId('auth-email')).toHaveCount(0);
    await expect(page.locator('.media-list-item')).toHaveCount(0);

    // A native (non-Drive) shared link opens the inline player without auth.
    await page.goto('/media/explorer?id=media-video-s3');
    await expect(page).toHaveURL(/\/media\/explorer\?id=media-video-s3$/);
    const nativePlayer = page.getByTestId('native-video-player');
    await expect(nativePlayer).toBeVisible();
    await expect(nativePlayer).toHaveAttribute(
      'src',
      'http://localhost:5000/assets/e2e-fixtures/fixture.mp4',
    );
    await expect(page.getByTestId('auth-email')).toHaveCount(0);
    await expect(page.locator('.media-list-item')).toHaveCount(0);
  });

  test('explorer lists the seeded media entries', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/media/explorer');
    await expect(page.getByText('E2E Audio').first()).toBeVisible();
    await expect(page.getByText('E2E Doc').first()).toBeVisible();
    await expect(page.getByText('E2E Video').first()).toBeVisible();
    await expect(page.getByText('E2E S3 Video').first()).toBeVisible();
  });

  test('video player renders a native element for a CloudFront URL', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/media/explorer?id=media-video-s3');
    const nativePlayer = page.getByTestId('native-video-player');
    await expect(nativePlayer).toBeVisible();
    await expect(nativePlayer).toHaveAttribute(
      'src',
      'http://localhost:5000/assets/e2e-fixtures/fixture.mp4',
    );
    await expect(nativePlayer).toHaveAttribute(
      'poster',
      'http://localhost:5000/assets/e2e-fixtures/fixture.png',
    );
  });

  test('audio: player shell renders and the local WAV plays', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/media/explorer');
    await page.getByText('E2E Audio').first().click();
    await expect(page.locator('.audio-player-container')).toBeVisible();
    const audio = page.locator('.audio-player-element');
    await expect(audio).toHaveAttribute('src', /fixture\.wav/);
    // Autoplay can be blocked; drive play explicitly and wait for time to advance.
    await audio.evaluate((el) => (el as HTMLAudioElement).play().catch(() => {}));
    await expect
      .poll(async () => (await audio.evaluate((el) => (el as HTMLAudioElement).currentTime)) ?? 0, {
        timeout: 15000,
      })
      .toBeGreaterThan(0);
  });

  test('video: player shell (drive iframe) renders; playback not asserted', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/media/explorer');
    await page.getByText('E2E Video').first().click();
    await expect(page.locator('iframe.video-iframe')).toBeVisible();
  });

  test('doc: the PDF viewer container renders', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/media/explorer');
    await page.getByText('E2E Doc').first().click();
    await expect(page.locator('.doc-viewer-container').first()).toBeVisible({ timeout: 20000 });
  });

  test('video upload saves a managed record with derived URLs', async ({ page }) => {
    const storageName = `e2e-managed-${Date.now()}`;
    const key = `Video/${storageName}.mp4`;
    const iconKey = `Video/Icons/${storageName}.jpg`;
    let created: MediaRecord | null = null;

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');
      const form = await prepareVideo(page);

      // The title is prefilled from the filename; only the storage name changes.
      await expect(form.locator('input[name="videoTitle"]')).toHaveValue('fixture');
      await form.locator('input[name="videoDate"]').fill('2026');
      await form.locator('input[name="videoStorageName"]').fill(storageName);
      await form.locator('.admin-form-action-button-upload').click();
      await expect(page.getByTestId('video-upload-success')).toContainText('Saved "fixture".');

      created = await waitForRecordByKey(storageName);
      expect(created.title).toBe('fixture');
      expect(created.type).toBe('video');
      expect(created.format).toBe('video/mp4');
      expect(created.fileName).toBe(`${storageName}.mp4`);
      expect(created.urls?.download).toBe(sinkUrl(key));
      expect(created.urls?.icon).toBe(sinkUrl(iconKey));
      expect(created.storage?.managed).toBe(true);
      expect(created.storage?.key).toBe(key);
      expect(created.storage?.iconKey).toBe(iconKey);
      expect(created.storage?.uploadedByHash).toBeUndefined();

      expect((await findMediaByTitle('fixture'))?.id).toBe(created.id);

      const videoHead = await sinkHead(key);
      const iconHead = await sinkHead(iconKey);
      expect(videoHead).not.toBeNull();
      expect(iconHead).not.toBeNull();
      expect(videoHead?.batchId).toBe(created.storage?.batchId);
      expect(iconHead?.batchId).toBe(created.storage?.batchId);
    } finally {
      await cleanupRecord(created?.id);
    }
  });

  test('video upload keeps the form and shows the duplicate message', async ({ page }) => {
    const storageName = `e2e-duplicate-${Date.now()}`;
    let created: MediaRecord | null = null;

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');
      created = await uploadManaged(page, storageName);

      const form = await prepareVideo(page);
      await form.locator('input[name="videoDate"]').fill('2026');
      await form.locator('input[name="videoStorageName"]').fill(storageName);
      await form.locator('.admin-form-action-button-upload').click();

      await expect(page.getByTestId('video-upload-error')).toContainText(
        `A record named "Video/${storageName}.mp4" already exists. Delete it or choose a different name.`,
      );
      await expect(form.locator('input[name="videoTitle"]')).toHaveValue('fixture');
      await expect(form.locator('input[name="videoDate"]')).toHaveValue('2026');
      await expect(form.locator('input[name="videoStorageName"]')).toHaveValue(storageName);
    } finally {
      await cleanupRecord(created?.id);
    }
  });

  test('video upload rejects a non-MP4 file', async ({ page }) => {
    const before = Object.keys(await allMedia()).sort();

    await login(page, 'admin');
    await page.goto('/admin/media');
    await page.getByTestId('video-file-input').setInputFiles(fixturePath('fixture.wav'));

    await expect(page.getByTestId('video-upload-error')).toContainText('Choose an MP4 file.');
    expect(Object.keys(await allMedia()).sort()).toEqual(before);
  });

  test('video upload requires a title and date', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');
    const form = await prepareVideo(page);

    await form.locator('input[name="videoDate"]').fill('');
    await form.locator('.admin-form-action-button-upload').click();
    await expect(page.getByTestId('video-upload-error')).toContainText(
      'Enter the date before uploading.',
    );

    await form.locator('input[name="videoTitle"]').fill('');
    await form.locator('.admin-form-action-button-upload').click();
    await expect(page.getByTestId('video-upload-error')).toContainText(
      'Enter the title before uploading.',
    );
  });

  test('video metadata edit preserves storage', async ({ page }) => {
    const storageName = `e2e-edit-${Date.now()}`;
    let created: MediaRecord | null = null;

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');
      created = await uploadManaged(page, storageName);

      await expect(mediaRow(page, 'fixture')).toBeVisible();
      await mediaRow(page, 'fixture').click();
      const form = page.locator('.admin-media-upload-upload-form');
      await expect(form.locator('input[name="videoDuration"]')).toBeVisible();

      await form.locator('input[name="videoTitle"]').fill('fixture edited');
      await form.locator('input[name="videoDate"]').fill('2025');
      await form.locator('input[name="videoDuration"]').fill('3:45');
      await form.locator('.admin-form-action-button-upload').click();
      await expect(page.getByTestId('video-upload-success')).toContainText(
        'Saved "fixture edited".',
      );

      const updated = await readDb<MediaRecord>(`media/${created.id}`);
      expect(updated?.title).toBe('fixture edited');
      expect(updated?.date).toBe('2025');
      expect(updated?.duration).toBe('3:45');
      expect(updated?.storage?.key).toBe(created.storage?.key);
      expect(updated?.storage?.iconKey).toBe(created.storage?.iconKey);
      expect(updated?.urls).toEqual(created.urls);
    } finally {
      await cleanupRecord(created?.id);
    }
  });

  test('video replace reuses the icon when no thumbnail is supplied', async ({ page }) => {
    const storageName = `e2e-replace-${Date.now()}`;
    let created: MediaRecord | null = null;

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');
      created = await uploadManaged(page, storageName);
      const key = created.storage?.key as string;
      const iconKey = created.storage?.iconKey as string;
      const originalBytes = await sinkGet(key);
      expect(originalBytes).not.toBeNull();

      await mediaRow(page, 'fixture').click();
      const form = page.locator('.admin-media-upload-upload-form');
      await expect(form.locator('input[name="videoDuration"]')).toBeVisible();

      await page
        .getByRole('checkbox', { name: 'Replace video file' })
        .check({ force: true });
      await expect(page.getByTestId('video-file-input')).toBeVisible();
      await page.getByTestId('video-file-input').setInputFiles(fixturePath('fixture-2.mp4'));
      await expect(page.locator('.media-file-name')).toHaveText('fixture-2.mp4');
      await expect(
        page
          .getByTestId('video-thumbnail-preview')
          .or(page.getByTestId('video-upload-error')),
      ).toBeVisible();

      await form.locator('.admin-form-action-button-upload').click();
      await expect(page.getByTestId('video-upload-success')).toContainText('Saved "fixture".');

      const updated = await readDb<MediaRecord>(`media/${created.id}`);
      expect(updated?.id).toBe(created.id);
      expect(updated?.storage?.key).toBe(key);
      expect(updated?.storage?.iconKey).toBe(iconKey);

      const replacement = readFileSync(fixturePath('fixture-2.mp4'));
      await expect.poll(async () => (await sinkGet(key))?.equals(replacement)).toBe(true);
      expect(originalBytes?.equals(replacement)).toBe(false);
    } finally {
      await cleanupRecord(created?.id);
    }
  });

  test('video delete removes managed objects', async ({ page }) => {
    const storageName = `e2e-delete-${Date.now()}`;
    let created: MediaRecord | null = null;

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');
      created = await uploadManaged(page, storageName);
      const key = created.storage?.key as string;
      const iconKey = created.storage?.iconKey as string;

      await mediaRow(page, 'fixture').click();
      await page.locator('.admin-form-action-button-delete').click();
      await page.getByRole('button', { name: 'Delete video' }).click();
      await expect(page.getByTestId('video-upload-success')).toContainText('Deleted "fixture".');

      await expect.poll(async () => readDb(`media/${created?.id}`)).toBeNull();
      await expect.poll(async () => sinkHead(key)).toBeNull();
      await expect.poll(async () => sinkHead(iconKey)).toBeNull();
    } finally {
      await cleanupRecord(created?.id, created?.storage?.batchId);
    }
  });

  test('legacy video delete stays database-only', async ({ page }) => {
    const original = await readDb<MediaRecord>('media/media-video');
    expect(original).not.toBeNull();

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');
      await mediaRow(page, 'E2E Video').click();
      await expect(page.locator('input[name="videoDuration"]')).toBeVisible();

      await page.locator('.admin-form-action-button-delete').click();
      await page.getByRole('button', { name: 'Delete video' }).click();
      await expect(page.getByTestId('video-upload-success')).toContainText(
        'Deleted "E2E Video".',
      );
      await expect.poll(async () => readDb('media/media-video')).toBeNull();
      await expect(page.locator('.admin-error')).toHaveCount(0);
    } finally {
      if (original) {
        await writeDb('media/media-video', original);
      }
      await deleteDb('mediaDeletions/media-video');
    }
  });

  test('retry finalize does not re-upload', async ({ page }) => {
    const storageName = `e2e-retry-${Date.now()}`;
    const key = `Video/${storageName}.mp4`;
    let created: MediaRecord | null = null;
    let videoPuts = 0;
    let finalizePosts = 0;

    await page.route(/emulatorMediaSink/, async (route, request) => {
      if (request.method() === 'PUT') {
        const putKey = new URL(request.url()).searchParams.get('key') ?? '';
        if (putKey === key) {
          videoPuts += 1;
        }
      }
      await route.continue();
    });
    await page.route(/finalizeMediaUpload/, async (route, request) => {
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      finalizePosts += 1;
      if (finalizePosts === 1) {
        await route.fulfill({
          status: 500,
          headers: {
            'access-control-allow-origin': 'http://localhost:5000',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ error: { status: 'INTERNAL', message: 'forced failure' } }),
        });
        return;
      }
      await route.continue();
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');
      const form = await prepareVideo(page);
      await form.locator('input[name="videoDate"]').fill('2026');
      await form.locator('input[name="videoStorageName"]').fill(storageName);
      await form.locator('.admin-form-action-button-upload').click();

      await expect(page.getByTestId('video-upload-error')).toContainText(
        'The file uploaded but the record could not be saved. Choose Retry to finish saving.',
      );
      const retry = page.locator('.admin-form-action-button-retry');
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(page.getByTestId('video-upload-success')).toContainText('Saved "fixture".');

      created = await waitForRecordByKey(storageName);
      expect(videoPuts).toBe(1);
      expect(finalizePosts).toBe(2);
    } finally {
      await cleanupRecord(created?.id);
    }
  });

  test('video upload controls expose labels and live regions', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');

    await expect(page.getByLabel('Video file')).toBeVisible();
    await expect(page.getByLabel('Storage name')).toBeVisible();
    await expect(page.getByLabel('Thumbnail frame')).toBeVisible();
    await expect(page.getByLabel('Choose thumbnail image')).toBeVisible();

    const progress = page.getByTestId('video-upload-progress');
    await expect(progress).toHaveAttribute('role', 'status');

    await page.locator('.admin-form-action-button-upload').click();
    const error = page.getByTestId('video-upload-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute('role', 'alert');
  });

  test('admin media cards keep the shared surface and action row', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');

    const videoCard = page.locator('app-admin-media-upload-video .admin-surface');
    await expect(videoCard).toBeVisible({ timeout: 20000 });
    await expect(videoCard).not.toHaveClass(/mat-elevation-z6/);
    await expect(videoCard.locator('.w-100')).toHaveCount(0);

    const videoActions = videoCard.locator('.admin-form-actions');
    await expect(videoActions).toHaveCSS('justify-content', 'flex-end');
    await expect(videoActions.getByRole('button', { name: 'Clear' })).toHaveCSS('height', '36px');

    await page.getByRole('tab', { name: 'Audio Album' }).click();
    const audioCard = page.locator('app-admin-media-upload-audio-album .admin-surface');
    await expect(audioCard).toBeVisible();
    await expect(audioCard).not.toHaveClass(/mat-elevation-z6/);
    const audioActions = audioCard.locator('.admin-form-actions');
    await expect(audioActions).toHaveCSS('justify-content', 'flex-end');
    await expect(audioActions.getByRole('button', { name: 'Clear' })).toHaveCSS('height', '36px');
  });
});
