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
  folderName?: string;
  duration?: string;
  listing?: string[];
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
    folder?: string;
    coverKey?: string;
    zipKey?: string;
    trackKeys?: string[];
    albumId?: string;
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

const ALBUM_TRACKS = ['01-fixture.mp3', '02-fixture.mp3'];

function albumCard(page: Page): Locator {
  return page.locator('app-admin-media-upload-audio-album');
}

/** Mirrors the app's plus-for-space folder convention for ASCII titles. */
function albumFolderFor(title: string): string {
  return title.trim().replace(/ +/g, '+');
}

function albumKeys(folder: string) {
  return {
    folderPath: `Music/Albums/${folder}`,
    cover: `Music/Albums/Covers/${folder}.jpg`,
    zip: `Music/Albums/Zips/${folder}.zip`,
    track: (fileName: string) => `Music/Albums/${folder}/${fileName}`,
  };
}

async function openAlbumUpload(page: Page): Promise<Locator> {
  await login(page, 'admin');
  await page.goto('/admin/media');
  await page.getByRole('tab', { name: 'Audio Album' }).click();
  const card = albumCard(page);
  await expect(card.locator('input[name="albumTitle"]')).toBeVisible();
  return card;
}

async function findAlbumByFolder(folder: string): Promise<MediaRecord | null> {
  const media = await allMedia();
  return (
    Object.values(media).find(
      (record) => record?.type === 'audio-album' && record?.folderName === folder,
    ) ?? null
  );
}

async function waitForAlbum(folder: string): Promise<MediaRecord> {
  await expect.poll(async () => (await findAlbumByFolder(folder))?.id ?? null).not.toBeNull();
  return (await findAlbumByFolder(folder)) as MediaRecord;
}

interface AlbumOptions {
  title: string;
  tracks?: string[];
  manualZip?: boolean;
  zipFile?: string;
}

/**
 * Fills the album form and settles cover extraction before any upload click.
 * Cover extraction runs async from file selection; waiting on the preview or
 * the validation error keeps the click from racing it.
 */
async function prepareAlbum(page: Page, options: AlbumOptions): Promise<Locator> {
  const card = albumCard(page);
  const folder = albumFolderFor(options.title);
  await card.locator('input[name="albumTitle"]').fill(options.title);
  await expect(card.locator('input[name="albumFolderName"]')).toHaveValue(folder);

  const tracks = options.tracks ?? ALBUM_TRACKS;
  if (tracks.length > 0) {
    await card.getByTestId('album-tracks-input').setInputFiles(tracks.map(fixturePath));
    await expect(card.locator('.album-track-row')).toHaveCount(tracks.length);
    await expect(
      card.getByTestId('album-cover-preview').or(card.getByTestId('album-upload-error')),
    ).toBeVisible();
  }

  if (options.manualZip) {
    await card.getByRole('checkbox', { name: 'Use my own zip' }).check({ force: true });
    await expect(card.getByTestId('album-zip-input')).toBeVisible();
    if (options.zipFile) {
      await card.getByTestId('album-zip-input').setInputFiles(fixturePath(options.zipFile));
    }
  }
  return card;
}

async function uploadAlbum(
  page: Page,
  options: AlbumOptions,
): Promise<MediaRecord> {
  const card = await prepareAlbum(page, options);
  await card.locator('.admin-form-action-button-upload').click();
  await expect(page.getByTestId('album-upload-success')).toContainText(
    `Saved album "${options.title}".`,
  );
  return waitForAlbum(albumFolderFor(options.title));
}

async function findBatchForAsset(key: string): Promise<string | null> {
  const batches = (await readDb<Record<string, { assets?: Array<{ key?: string }> }>>(
    'mediaUploads',
  )) ?? {};
  const entry = Object.entries(batches).find(([, batch]) =>
    (batch?.assets ?? []).some((asset) => asset?.key === key),
  );
  return entry?.[0] ?? null;
}

/**
 * Removes every record and batch an album case could have created. Sink objects
 * are covered by the per-project reset, so nothing here touches the sink.
 */
async function cleanupAlbumFolder(folder: string): Promise<void> {
  const folderPath = `Music/Albums/${folder}`;
  const media = (await readDb<Record<string, MediaRecord>>('media')) ?? {};
  const entries = Object.entries(media);
  const albumEntry = entries.find(
    ([, record]) => record?.type === 'audio-album' && record?.folderName === folder,
  );
  const album = albumEntry?.[1];
  const trackEntries = entries.filter(([, record]) => {
    const key = record?.storage?.key;
    return typeof key === 'string' && key.startsWith(`${folderPath}/`);
  });

  const recordIds = new Set<string>([
    ...(album?.listing ?? []),
    ...trackEntries.map(([id]) => id),
    ...(albumEntry ? [albumEntry[0]] : []),
  ]);
  for (const id of recordIds) {
    await deleteDb(`media/${id}`);
    await deleteDb(`mediaDeletions/${id}`);
  }

  const batches = (await readDb<Record<string, { assets?: Array<{ key?: string }> }>>(
    'mediaUploads',
  )) ?? {};
  for (const [id, batch] of Object.entries(batches)) {
    const belongs = (batch?.assets ?? []).some(
      (asset) =>
        typeof asset?.key === 'string' &&
        (asset.key.startsWith(`${folderPath}/`) ||
          asset.key === albumKeys(folder).cover ||
          asset.key === albumKeys(folder).zip),
    );
    if (belongs) {
      await deleteDb(`mediaUploads/${id}`);
    }
  }
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

  test('album upload generates the zip and saves tracks', async ({ page }) => {
    const title = `E2E Album generated ${Date.now()}`;
    const folder = albumFolderFor(title);
    const keys = albumKeys(folder);

    try {
      await openAlbumUpload(page);
      const card = await prepareAlbum(page, { title });

      const rows = card.locator('.album-track-row');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0).locator('input')).toHaveValue('01 fixture');
      await expect(rows.nth(1).locator('input')).toHaveValue('02 fixture');
      await expect(rows.nth(0).locator('.album-track-file')).toHaveText('01-fixture.mp3');
      await expect(rows.nth(1).locator('.album-track-file')).toHaveText('02-fixture.mp3');
      await expect(card.getByTestId('album-cover-source')).toHaveText('From track art');
      await expect(card.getByTestId('album-cover-preview')).toBeVisible();
      await expect(card.locator('.media-zip-controls')).toContainText(
        'Album zip will be generated',
      );

      const album = await uploadAlbum(page, { title });

      expect(album.listing?.length).toBe(2);
      const trackIds = album.listing as string[];
      expect(new Set(trackIds).size).toBe(2);
      expect(album.storage?.managed).toBe(true);
      expect(album.storage?.folder).toBe(keys.folderPath);
      expect(album.urls?.icon).toBe(sinkUrl(keys.cover));
      expect(album.urls?.download).toBe(sinkUrl(keys.zip));
      expect(album.storage?.trackKeys).toEqual([
        keys.track('01-fixture.mp3'),
        keys.track('02-fixture.mp3'),
      ]);

      const tracks = await Promise.all(
        trackIds.map((id) => readDb<MediaRecord>(`media/${id}`)),
      );
      expect(tracks.every((track) => track?.type === 'audio-track')).toBe(true);
      expect(tracks.every((track) => track?.storage?.albumId === album.id)).toBe(true);
      expect(tracks.every((track) => track?.urls?.icon === album.urls?.icon)).toBe(true);
      expect(tracks.map((track) => track?.storage?.key).sort()).toEqual([
        keys.track('01-fixture.mp3'),
        keys.track('02-fixture.mp3'),
      ]);

      for (const key of [
        keys.cover,
        keys.zip,
        keys.track('01-fixture.mp3'),
        keys.track('02-fixture.mp3'),
      ]) {
        const head = await sinkHead(key);
        expect(head).not.toBeNull();
        expect(head?.batchId).toBe(album.storage?.batchId);
      }
    } finally {
      await cleanupAlbumFolder(folder);
    }
  });

  test('album upload requires tracks', async ({ page }) => {
    const title = `E2E Album empty ${Date.now()}`;
    const folder = albumFolderFor(title);

    try {
      await openAlbumUpload(page);
      const card = albumCard(page);
      await card.locator('input[name="albumTitle"]').fill(title);
      await card.locator('.admin-form-action-button-upload').click();

      await expect(card.getByTestId('album-upload-error')).toContainText(
        'Add at least one MP3 track.',
      );
      expect(await findAlbumByFolder(folder)).toBeNull();
    } finally {
      await cleanupAlbumFolder(folder);
    }
  });

  test('album upload requires a cover when the track has none', async ({ page }) => {
    const title = `E2E Album noart ${Date.now()}`;
    const folder = albumFolderFor(title);

    try {
      await openAlbumUpload(page);
      const card = albumCard(page);
      await card.locator('input[name="albumTitle"]').fill(title);
      await card.getByTestId('album-tracks-input').setInputFiles(fixturePath('fixture-noart.mp3'));

      await expect(card.locator('.album-track-row')).toHaveCount(1);
      await expect(card.getByTestId('album-upload-error')).toContainText('Add a cover image.');
      await expect(card.getByTestId('album-cover-preview')).toHaveCount(0);

      await card.locator('.admin-form-action-button-upload').click();
      await expect(card.getByTestId('album-upload-error')).toContainText('Add a cover image.');
      expect(await findAlbumByFolder(folder)).toBeNull();
    } finally {
      await cleanupAlbumFolder(folder);
    }
  });

  test('album upload accepts a manual zip override', async ({ page }) => {
    const title = `E2E Album manualzip ${Date.now()}`;
    const folder = albumFolderFor(title);
    const keys = albumKeys(folder);

    try {
      await openAlbumUpload(page);
      const album = await uploadAlbum(page, {
        title,
        manualZip: true,
        zipFile: 'fixture.zip',
      });

      const stored = await sinkGet(keys.zip);
      expect(stored).not.toBeNull();
      expect(stored?.equals(readFileSync(fixturePath('fixture.zip')))).toBe(true);
      expect(album.urls?.download).toBe(sinkUrl(keys.zip));
    } finally {
      await cleanupAlbumFolder(folder);
    }
  });

  test('album folder uses the plus convention', async ({ page }) => {
    const stamp = Date.now();
    const title = `E2E Album ${stamp}`;
    const folder = `E2E+Album+${stamp}`;
    const keys = albumKeys(folder);

    try {
      await openAlbumUpload(page);
      const card = albumCard(page);
      await card.locator('input[name="albumTitle"]').fill(title);
      await expect(card.getByTestId('album-folder-preview')).toContainText(
        `Music/Albums/${folder}/`,
      );

      const album = await uploadAlbum(page, { title });

      expect(album.folderName).toBe(folder);
      expect(decodeURIComponent(String(album.urls?.download))).toContain('E2E+Album');
      expect(decodeURIComponent(String(album.urls?.icon))).toContain('E2E+Album');
      expect(album.urls?.download).toBe(sinkUrl(keys.zip));

      const trackIds = album.listing as string[];
      for (const id of trackIds) {
        const track = await readDb<MediaRecord>(`media/${id}`);
        expect(decodeURIComponent(String(track?.urls?.download))).toContain('E2E+Album');
        expect(track?.storage?.key?.startsWith(`${keys.folderPath}/`)).toBe(true);
      }
    } finally {
      await cleanupAlbumFolder(folder);
    }
  });

  test('album metadata edit changes titles and order without rewriting tracks', async ({ page }) => {
    const title = `E2E Album edit ${Date.now()}`;
    const editedTitle = `${title} edited`;
    const folder = albumFolderFor(title);

    try {
      await openAlbumUpload(page);
      const created = await uploadAlbum(page, { title });
      const originalListing = created.listing as string[];
      const [firstId, secondId] = originalListing;
      const beforeFirst = await readDb<MediaRecord>(`media/${firstId}`);
      const beforeSecond = await readDb<MediaRecord>(`media/${secondId}`);

      const card = albumCard(page);
      await card.locator('.media-list-item').filter({ hasText: title }).first().click();
      await expect(card.locator('input[name="albumFolderName"]')).toHaveCount(0);
      await expect(card).toContainText(
        'To change tracks, delete this album and upload it again.',
      );

      await card.locator('input[name="albumTitle"]').fill(editedTitle);
      await card.locator('.album-track-row').nth(0).locator('input').fill('Intro edited');
      await card.getByRole('button', { name: 'Move track down' }).first().click();
      await expect(card.locator('.album-track-file')).toHaveText([
        '02-fixture.mp3',
        '01-fixture.mp3',
      ]);

      await card.locator('.admin-form-action-button-upload').click();
      await expect(page.getByTestId('album-upload-success')).toContainText(
        `Saved album "${editedTitle}".`,
      );

      const updated = await readDb<MediaRecord>(`media/${created.id}`);
      expect(updated?.title).toBe(editedTitle);
      expect(updated?.listing).toEqual([secondId, firstId]);
      expect(updated?.storage?.trackKeys).toEqual(created.storage?.trackKeys);
      expect(updated?.storage?.coverKey).toBe(created.storage?.coverKey);
      expect(updated?.storage?.zipKey).toBe(created.storage?.zipKey);
      expect(updated?.urls).toEqual(created.urls);

      const afterFirst = await readDb<MediaRecord>(`media/${firstId}`);
      const afterSecond = await readDb<MediaRecord>(`media/${secondId}`);
      expect(afterFirst?.title).toBe('Intro edited');
      expect(afterSecond?.title).toBe(beforeSecond?.title);
      expect(afterFirst?.urls).toEqual(beforeFirst?.urls);
      expect(afterSecond?.urls).toEqual(beforeSecond?.urls);
    } finally {
      await cleanupAlbumFolder(folder);
    }
  });

  test('album delete cascades records and objects', async ({ page }) => {
    const title = `E2E Album delete ${Date.now()}`;
    const folder = albumFolderFor(title);
    const keys = albumKeys(folder);
    let album: MediaRecord | null = null;

    try {
      await openAlbumUpload(page);
      album = await uploadAlbum(page, { title });
      const trackIds = album.listing as string[];
      const albumId = album.id;

      const card = albumCard(page);
      await card.locator('.media-list-item').filter({ hasText: title }).first().click();
      await card.locator('.admin-form-action-button-delete').click();
      await page.getByRole('button', { name: 'Delete album' }).click();
      await expect(page.getByTestId('album-upload-success')).toContainText(
        `Deleted "${title}".`,
      );

      await expect.poll(async () => readDb(`media/${albumId}`)).toBeNull();
      for (const id of trackIds) {
        await expect.poll(async () => readDb(`media/${id}`)).toBeNull();
      }
      for (const key of [
        keys.cover,
        keys.zip,
        keys.track('01-fixture.mp3'),
        keys.track('02-fixture.mp3'),
      ]) {
        await expect.poll(async () => sinkHead(key)).toBeNull();
      }
    } finally {
      await cleanupAlbumFolder(folder);
      if (album?.id) {
        await deleteDb(`mediaDeletions/${album.id}`);
      }
    }
  });

  test('cancel cleans up the batch and objects', async ({ page }) => {
    const title = `E2E Album cancel ${Date.now()}`;
    const folder = albumFolderFor(title);
    const keys = albumKeys(folder);
    const firstTrackKey = keys.track('01-fixture.mp3');

    let markHeld: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      markHeld = resolve;
    });
    let releaseHeld: () => void = () => {};
    const release = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    let canceled = false;

    await page.route(/emulatorMediaSink/, async (route, request) => {
      if (request.method() === 'PUT') {
        const key = new URL(request.url()).searchParams.get('key') ?? '';
        if (key === firstTrackKey) {
          markHeld();
          await release;
          if (canceled) {
            try {
              await route.abort('failed');
            } catch {
              // Cancel unsubscribed and the browser already dropped the request.
            }
            return;
          }
        }
      }
      await route.continue();
    });

    try {
      await openAlbumUpload(page);
      const card = await prepareAlbum(page, { title });
      await card.locator('.admin-form-action-button-upload').click();
      await held;

      await expect
        .poll(async () => (await findBatchForAsset(firstTrackKey)) ?? null)
        .not.toBeNull();
      const batchId = (await findBatchForAsset(firstTrackKey)) as string;

      await card.locator('.admin-form-action-button-cancel').click();
      await expect.poll(async () => readDb(`mediaUploads/${batchId}`)).toBeNull();
      await expect.poll(async () => sinkHead(firstTrackKey)).toBeNull();
      await expect.poll(async () => sinkHead(keys.cover)).toBeNull();
      await expect.poll(async () => sinkHead(keys.zip)).toBeNull();
    } finally {
      canceled = true;
      releaseHeld();
      await page.unroute(/emulatorMediaSink/);
      await cleanupAlbumFolder(folder);
    }
  });

  test('resume after reload completes the missing asset', async ({ page }) => {
    const title = `E2E Album resume ${Date.now()}`;
    const folder = albumFolderFor(title);
    const keys = albumKeys(folder);
    const secondTrackKey = keys.track('02-fixture.mp3');
    let album: MediaRecord | null = null;

    // Store the bytes in the sink, then fail the browser response, so the
    // reload sees a complete batch while the client still believes it failed.
    await page.route(/emulatorMediaSink/, async (route, request) => {
      if (
        request.method() === 'PUT' &&
        new URL(request.url()).searchParams.get('key') === secondTrackKey
      ) {
        // Intercepted XHR uploads expose no body buffer, so replay the fixture
        // bytes explicitly while the sink still stores the real object.
        await route.fetch({ postData: readFileSync(fixturePath('02-fixture.mp3')) });
        await route.fulfill({
          status: 500,
          headers: {
            'access-control-allow-origin': 'http://localhost:5000',
            'content-type': 'text/plain',
          },
          body: 'forced failure',
        });
        return;
      }
      await route.continue();
    });

    try {
      await openAlbumUpload(page);
      const card = await prepareAlbum(page, { title });
      await card.locator('.admin-form-action-button-upload').click();
      await expect(card.getByTestId('album-upload-error')).toBeVisible();
      await expect(card.locator('.admin-form-action-button-upload')).toHaveText('Upload');

      await page.unroute(/emulatorMediaSink/);
      await page.goto('/admin/media');
      await page.getByRole('tab', { name: 'Audio Album' }).click();
      const resume = page.getByRole('button', { name: 'Resume upload' });
      await expect(resume).toBeVisible();
      await resume.click();

      await expect(page.getByTestId('album-upload-success')).toContainText(
        `Saved album "${title}".`,
      );
      album = await waitForAlbum(folder);
      expect(album.listing?.length).toBe(2);
      expect(album.storage?.trackKeys).toEqual([
        keys.track('01-fixture.mp3'),
        keys.track('02-fixture.mp3'),
      ]);

      for (const id of album.listing as string[]) {
        const track = await readDb<MediaRecord>(`media/${id}`);
        expect(track?.storage?.albumId).toBe(album.id);
        expect(await sinkHead(track?.storage?.key as string)).not.toBeNull();
      }
    } finally {
      await page.unroute(/emulatorMediaSink/);
      await cleanupAlbumFolder(folder);
    }
  });

  test('album upload controls expose labels and live regions', async ({ page }) => {
    await openAlbumUpload(page);
    const card = albumCard(page);

    await expect(card.getByLabel('Folder name')).toBeVisible();
    await expect(card.getByLabel('Album tracks')).toBeVisible();
    await expect(card.getByLabel('Choose cover image')).toBeVisible();
    await expect(card.locator('mat-checkbox[name="useOwnZip"]')).toBeVisible();

    await card.getByRole('checkbox', { name: 'Use my own zip' }).check({ force: true });
    await expect(card.getByLabel('Zip file')).toBeVisible();

    const progress = card.getByTestId('album-upload-progress');
    await expect(progress).toHaveAttribute('role', 'status');

    await card.locator('.admin-form-action-button-upload').click();
    const error = card.getByTestId('album-upload-error');
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
