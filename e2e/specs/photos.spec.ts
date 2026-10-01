import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('photos', () => {
  test('albums grid renders the 2 seeded album titles', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/photos');
    await expect(page.getByText('E2E Album One')).toBeVisible();
    await expect(page.getByText('E2E Album Two')).toBeVisible();
  });

  test('albums page resolves without ever showing the empty state', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/photos');
    // The skeleton is transient (it clears 500ms after the first RTDB
    // emission), so the deterministic assertions are the invariant ones:
    // real content arrives and the empty state never renders for it.
    await expect(page.locator('[data-testid="albums-skeleton"], .album-tile').first()).toBeAttached();
    await expect(page.getByText('No albums yet')).toHaveCount(0);
    await expect(page.getByText('E2E Album One')).toBeVisible();
    await expect(page.getByTestId('albums-skeleton')).toHaveCount(0);
  });

  test('album search with no matches shows a full-width no-results message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/photos');
    await expect(page.getByText('E2E Album One')).toBeVisible();
    await page.getByLabel('Search albums').fill('zzz-no-match');
    const message = page.locator('.no-results-message');
    await expect(message).toBeVisible();
    // The message spans the whole grid row, not one 180px cell.
    const [messageBox, gridBox] = await Promise.all([
      message.boundingBox(),
      page.locator('.album-grid').boundingBox(),
    ]);
    expect(messageBox!.width).toBeGreaterThan(gridBox!.width * 0.9);
  });

  test('album detail renders the seeded photos from the storage emulator', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/photos/album-1');
    await expect(page.getByText('E2E Album One').first()).toBeVisible();
    const imgs = page.locator('.photo-tile img');
    await expect(imgs).toHaveCount(2);
    const widths = await imgs.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).naturalWidth));
    for (const w of widths) {
      expect(w).toBeGreaterThan(0);
    }
  });

  test('slideshow renders and next/prev advance the image', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/photos/album-1/slideshow');
    await expect(page.locator('.slideshow-image')).toBeVisible();
    const counter = page.locator('.slideshow-counter');
    await expect(counter).toContainText('/ 2');
    await page.locator('button[matTooltip="Next"]').click();
    await expect(counter).toContainText('2 / 2');
    await page.locator('button[matTooltip="Previous"]').click();
    await expect(counter).toContainText('1 / 2');
  });

  test('upload photo: admin uploads a folder with one PNG and the album appears', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/photo-albums');
    // webkitdirectory inputs need a real directory path.
    const dir = mkdtempSync(join(tmpdir(), 'e2e-upload-'));
    writeFileSync(join(dir, 'photo-e2e.png'), TINY_PNG);
    await page.locator('input[webkitdirectory]').setInputFiles(dir);
    await expect(page.locator('.upload-dialog-summary')).toContainText('Detected 1');
    await page.getByLabel('Album title').fill('E2E Upload Album');
    await page.getByRole('button', { name: 'Start Upload' }).click();
    // Upload completes through the real SDK to the storage emulator.
    await expect(page.getByText('E2E Upload Album').first()).toBeVisible({ timeout: 30000 });
  });
});
