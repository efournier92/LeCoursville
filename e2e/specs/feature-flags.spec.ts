import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';
import { readDb, writeDb } from '../helpers/admin-db';

test.describe('feature flags', () => {
  // Chat is seeded OFF; the mutation test turns it ON, so restore through the
  // Admin SDK regardless of the page state the test ended in.
  test.afterEach(async () => {
    await writeDb('features/chat/enabled', false);
    await writeDb('features/songs/enabled', true);
  });

  test('disabled feature: /chat redirects to the feature-disabled page', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/feature-disabled/);
    // mat-card-title is not a heading role; assert the card title text.
    await expect(page.locator('.disabled-card').getByText('Feature Disabled')).toBeVisible();
    await expect(page.getByText(/feature is currently disabled/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go Home' })).toBeVisible();

    // The flag page uses the app's surface card, not Material's tinted default.
    const card = page.locator('.disabled-card');
    await expect(card).toHaveClass(/surface-card/);
    const surfaces = await card.evaluate(el => {
      const probe = document.createElement('div');
      probe.style.background = 'var(--color-surface)';
      document.body.appendChild(probe);
      const token = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { card: getComputedStyle(el).backgroundColor, token };
    });
    expect(surfaces.card).toBe(surfaces.token);
    await expect(card).toHaveCSS('border-radius', '16px');
  });

  test('enabled features render their pages', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await expect(page.locator('.page-toolbar-title', { hasText: 'Contacts' })).toBeVisible();
    await page.goto('/calendar');
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
    // enablePhotoAlbums is seeded true: /photos renders the album grid.
    await page.goto('/photos');
    await expect(page.getByText('E2E Album One')).toBeVisible();
  });

  test('mutation: admin toggles chat ON and the chat page renders', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    await expect(page.getByRole('button', { name: 'New Message' }).first()).toBeVisible();
  });

  test('the Features page shows a Songs row and toggling it persists', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/features');
    await expect(page.getByTestId('features-loading')).toHaveCount(0);

    const toggle = page.getByTestId('feature-toggle-songs');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('Songs');

    await setFeatureFlag(page, 'songs', false);
    expect(await readDb('features/songs/enabled')).toBe(false);

    await setFeatureFlag(page, 'songs', true);
    expect(await readDb('features/songs/enabled')).toBe(true);
  });

  test('layout: every toggle right edge aligns to one shared column', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/features');
    await expect(page.getByTestId('features-loading')).toHaveCount(0);
    const toggles = page.locator('[data-testid^="feature-toggle-"]');
    await expect(toggles.first()).toBeVisible();
    const boxes = (await toggles.evaluateAll(els =>
      els.map(el => Math.round((el as HTMLElement).getBoundingClientRect().right)),
    )).filter(right => right > 0);
    expect(boxes.length).toBeGreaterThan(1);
    const maxRight = Math.max(...boxes);
    for (const right of boxes) {
      expect(maxRight - right).toBeLessThanOrEqual(2);
    }
  });

  test('layout: Changed tag sits left of its toggle with a small gap, Title Case', async ({ page }) => {
    await login(page, 'admin');
    // Toggle through the real UI so updatedAt lands and the tag renders.
    await setFeatureFlag(page, 'chat', true);
    const tag = page.getByTestId('feature-changed-chat');
    await expect(tag).toBeVisible();
    // Full label form: "Changed" + a localized timestamp; toLocaleString
    // output varies by engine (nbsp width, ordering), so match the
    // title-case prefix and require a digit-bearing stamp separately.
    const text = (await tag.textContent())?.trim() ?? '';
    expect(text).toMatch(/^Changed\b/);
    expect(text.replace(/[^\d]/g, '')).not.toBe('');
    const toggle = page.getByTestId('feature-toggle-chat');
    const tagBox = await tag.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(tagBox && toggleBox).toBeTruthy();
    const gap = toggleBox!.x - (tagBox!.x + tagBox!.width);
    // Small fixed gap: present but not a wide void (scss gap is 12px).
    expect(gap).toBeGreaterThanOrEqual(2);
    expect(gap).toBeLessThanOrEqual(24);
  });
});
