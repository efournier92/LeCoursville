import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb } from '../helpers/admin-db';

test.afterEach(async ({ collector }) => collector.assertClean());

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

    // A copied link to a single video must also open signed out. Stub the
    // external Drive iframe so the assertion does not depend on the network.
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
  });

  test('explorer lists the 3 seeded media entries', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/media/explorer');
    await expect(page.getByText('E2E Audio').first()).toBeVisible();
    await expect(page.getByText('E2E Doc').first()).toBeVisible();
    await expect(page.getByText('E2E Video').first()).toBeVisible();
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

  test('video upload validates inline and keeps the entered values', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');

    const form = page.locator('.admin-media-upload-upload-form');
    await form.locator('input[name="videoTitle"]').fill('E2E Missing Fields');

    await form.locator('.admin-form-action-button-upload').click();

    await expect(page.getByTestId('video-upload-error')).toContainText('Enter the file name and date');
    await expect(form.locator('input[name="videoTitle"]')).toHaveValue('E2E Missing Fields');
  });

  test('audio album upload validates inline instead of silently clearing', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');
    await page.getByRole('tab', { name: 'Audio Album' }).click();

    const form = page.locator('.audio-album-upload-form');
    await form.locator('input[name="albumTitle"]').fill('E2E Album Missing Folder');
    await form.locator('.admin-form-action-button-upload').click();

    await expect(page.getByTestId('album-upload-error')).toContainText('folder name');
    await expect(form.locator('input[name="albumTitle"]')).toHaveValue('E2E Album Missing Folder');
  });

  test('video upload clears the form only after the save succeeds', async ({ page }) => {
    const id = `e2e-upload-${Date.now()}`;

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');

      const form = page.locator('.admin-media-upload-upload-form');
      await form.locator('input[name="videoTitle"]').fill('E2E Uploaded Video');
      await form.locator('input[name="videoFileName"]').fill('e2e-uploaded.mp4');
      await form.locator('input[name="videoDate"]').fill('2026');
      await form.locator('input[name="videoId"]').fill(id);
      await form.locator('.admin-form-action-button-upload').click();

      await expect(page.getByTestId('video-upload-success')).toContainText('Saved');
      await expect(form.locator('input[name="videoTitle"]')).toHaveValue('');
      await expect.poll(async () => readDb(`media/${id}`)).not.toBeNull();
    } finally {
      await deleteDb(`media/${id}`);
    }
  });

  test('admin media upload cards use the shared surface and action row', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');

    const videoCard = page.locator('app-admin-media-upload-video .admin-surface');
    await expect(videoCard).toBeVisible({ timeout: 20000 });
    await expect(videoCard).not.toHaveClass(/mat-elevation-z6/);
    await expect(videoCard.locator('.w-100')).toHaveCount(0);

    const videoActions = videoCard.locator('.admin-form-actions');
    await expect(videoActions).toHaveCSS('justify-content', 'flex-end');
    const videoClear = videoActions.getByRole('button', { name: 'Clear' });
    await expect(videoClear).toHaveCSS('height', '36px');
    await expect(videoClear).toHaveCSS('width', '112px');

    await page.getByRole('tab', { name: 'Audio Album' }).click();
    const audioCard = page.locator('app-admin-media-upload-audio-album .admin-surface');
    await expect(audioCard).toBeVisible();
    await expect(audioCard).not.toHaveClass(/mat-elevation-z6/);
    const audioActions = audioCard.locator('.admin-form-actions');
    await expect(audioActions).toHaveCSS('justify-content', 'flex-end');
    await expect(audioActions.getByRole('button', { name: 'Clear' })).toHaveCSS('height', '36px');
  });
});
