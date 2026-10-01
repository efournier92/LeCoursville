import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

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
});
