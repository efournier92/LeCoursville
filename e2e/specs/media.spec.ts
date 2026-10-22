import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.afterEach(async ({ collector }) => collector.assertClean());

test.describe('media', () => {
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
