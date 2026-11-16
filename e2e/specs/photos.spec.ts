import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { expectNoHorizontalOverflow } from '../helpers/overflow';
import { expectInputFontSize, expectMinTouchTarget } from '../helpers/touch';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('photos', () => {
  test('top bars do not overflow horizontally at 900px and 768px', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    try {
      for (const width of [900, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/photos');
        await expectNoHorizontalOverflow(page.locator('app-page-toolbar .page-toolbar'));
        await expectNoHorizontalOverflow(page.locator('mat-toolbar'));
      }
    } finally {
      await page.setViewportSize(original);
    }
  });

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
    await expect(page.getByText("We couldn't find any albums.")).toHaveCount(0);
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
    // Images can still be decoding when they become visible; poll the decoded
    // width instead of sampling once.
    await expect
      .poll(async () =>
        (await imgs.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).naturalWidth))).every(
          (w) => w > 0,
        ),
      )
      .toBe(true);
  });

  test('empty album shows a page-level centered empty state', async ({ page }) => {
    await login(page, 'admin');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/photos/album-4');
    const message = page.locator('.no-results-message');
    await expect(message).toBeVisible();
    const [messageBox, pageBox] = await Promise.all([
      message.boundingBox(),
      page.locator('.page-content').boundingBox(),
    ]);
    expect(messageBox!.width).toBeGreaterThanOrEqual(400);
    const messageCenter = messageBox!.x + messageBox!.width / 2;
    const pageCenter = pageBox!.x + pageBox!.width / 2;
    expect(Math.abs(messageCenter - pageCenter)).toBeLessThanOrEqual(2);
  });

  test('slideshow renders and next/prev advance the image', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/photos/album-1/slideshow');
    await expect(page.locator('.slideshow-image')).toBeVisible();
    const counter = page.locator('.slideshow-counter');
    await expect(counter).toContainText('/2');
    await page.locator('button[matTooltip="Next"]').click();
    await expect(counter).toContainText('2/2');
    await page.locator('button[matTooltip="Previous"]').click();
    await expect(counter).toContainText('1/2');
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

test.describe('control standard geometry (gallery)', () => {
  test('gallery search field is a 44px card-radius control and the slideshow button is a 44px pill', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/photos');
    const search = page.locator('.gallery-search').first();
    await expect(search).toBeVisible();
    const searchStyle = await search.evaluate((el) => {
      const s = getComputedStyle(el);
      return { height: s.height, radius: s.borderRadius };
    });
    expect(searchStyle.height).toBe('44px');
    expect(searchStyle.radius).toBe('16px');

    await page.goto('/photos/album-1');
    const slideshow = page.locator('.gallery-slideshow-btn');
    await expect(slideshow).toBeVisible();
    const btnStyle = await slideshow.evaluate((el) => {
      const s = getComputedStyle(el);
      return { height: s.height, radius: s.borderRadius };
    });
    expect(btnStyle.height).toBe('44px');
    expect(btnStyle.radius).toBe('999px');
    await expect(slideshow.locator('mat-icon')).toHaveText('photo_library');
  });
});

test.describe('mobile touch targets', () => {
  test('gallery search clears 24px and 16px text on albums and album detail', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'user');
    await page.goto('/photos');
    await expect(page.locator('.album-grid')).toBeVisible();
    await expectMinTouchTarget(page, 'input.gallery-search-input');
    await expectInputFontSize(page, 'input.gallery-search-input', 16);

    await page.goto('/photos/album-1');
    await expect(page.locator('input.gallery-search-input')).toBeVisible();
    await expectMinTouchTarget(page, 'input.gallery-search-input');
    await expectInputFontSize(page, 'input.gallery-search-input', 16);
  });

  test('toolbar tools stay inside the bar at 320px', async ({ page }) => {
    // WebKit stretched the column flex slot to its max-content width, so the
    // search field pushed the whole toolbar 28px past the viewport.
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page, 'user');
    await page.goto('/photos');
    await expect(page.locator('.album-grid')).toBeVisible();
    await expectNoHorizontalOverflow(page.locator('.page-toolbar'));
    await expectNoHorizontalOverflow(page.locator('.app-container'));
  });
});

test.describe('mobile convergence', () => {
  test('album grid uses exactly two columns at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'user');
    await page.goto('/photos');
    const grid = page.locator('.album-grid:not([data-testid="albums-skeleton"])');
    await expect(grid).toBeVisible();
    const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    const tracks = columns.split(/\s+/).filter((part) => part.length > 0);
    expect(tracks).toHaveLength(2);
  });

  test('album detail breaks a short album to three columns at 768 and keeps two at 320', async ({ page }) => {
    await login(page, 'user');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/photos/album-1');
    const grid = page.locator('.photo-grid');
    await expect(grid).toBeVisible();
    const wide = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(wide.split(/\s+/).filter(Boolean)).toHaveLength(3);

    await page.setViewportSize({ width: 320, height: 568 });
    const narrow = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(narrow.split(/\s+/).filter(Boolean)).toHaveLength(2);
  });
});
