import { test, expect } from '../helpers/fixture';
import { login, logout } from '../helpers/auth';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';

type Rgb = { r: number; g: number; b: number };

const parseRgb = (value: string): Rgb => {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return { r: 0, g: 0, b: 0 };
  const [r, g, b] = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  return { r, g, b };
};

const channel = (value: number) => {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const contrast = (fg: string, bg: string) => {
  const a = luminance(parseRgb(fg));
  const b = luminance(parseRgb(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** Text color plus the first opaque background up the ancestor chain. */
async function surfaceColors(locator: import('@playwright/test').Locator) {
  return locator.evaluate((el) => {
    const opaque = (value: string) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return false;
      const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
      return (parts[3] ?? 1) > 0;
    };
    const text = getComputedStyle(el).color;
    let node: Element | null = el;
    while (node && !opaque(getComputedStyle(node).backgroundColor)) {
      node = node.parentElement;
    }
    const background = node ? getComputedStyle(node).backgroundColor : 'rgb(255, 255, 255)';
    return { text, background };
  });
}

async function expectReadable(locator: import('@playwright/test').Locator) {
  await expect(locator).toBeVisible();
  const { text, background } = await surfaceColors(locator);
  expect(contrast(text, background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
}

/**
 * Dark mode: per-user theme toggle stored at users/{uid}/prefs/theme.
 * Light is the floor for every unknown state; guests never render dark.
 */

const USER_EMAIL = 'user@e2e.local';
const OTHER_EMAIL = 'other@e2e.local';
let uid: string | null = null;
let otherUid: string | null = null;
let adminUid: string | null = null;
let otherRoles: unknown = { user: true };

test.beforeAll(async () => {
  const users = (await readDb<Record<string, { email?: string; roles?: unknown }>>('users')) ?? {};
  uid = Object.keys(users).find((id) => users[id]?.email === USER_EMAIL) ?? null;
  otherUid = Object.keys(users).find((id) => users[id]?.email === OTHER_EMAIL) ?? null;
  adminUid = Object.keys(users).find((id) => users[id]?.email === 'admin@e2e.local') ?? null;
  otherRoles = users[otherUid ?? '']?.roles ?? { user: true };
  expect(uid, 'seeded user@e2e.local must resolve to a uid').toBeTruthy();
  expect(otherUid, 'seeded other@e2e.local must resolve to a uid').toBeTruthy();
  expect(adminUid, 'seeded admin@e2e.local must resolve to a uid').toBeTruthy();
});

test.afterEach(async () => {
  // Restore the seeded no-prefs state even when an assertion failed.
  await deleteDb(`users/${uid}/prefs`);
});

const body = (page: import('@playwright/test').Page) =>
  // The app template nests a <body class="app-container"> inside app-root;
  // the real document body (carrying the token background) is the first.
  page.locator('body').first();

test('fresh user with no prefs defaults to light', async ({ page }) => {
  await login(page, 'user');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveClass(/theme-dark/);
  await expect(body(page)).toHaveCSS('background-color', 'rgb(243, 244, 246)');
});

test('toggle switches the document to dark', async ({ page }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(body(page)).not.toHaveCSS('background-color', 'rgb(243, 244, 246)');
});

test('dark theme persists across reload', async ({ page }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  // Reload restores auth from persistence; the attribute returns once the
  // user node resolves. Wait on the visible toggle, then the attribute.
  await page.getByTestId('theme-toggle').waitFor({ state: 'visible', timeout: 30000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('toggling off restores light and persists', async ({ page }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(body(page)).toHaveCSS('background-color', 'rgb(243, 244, 246)');
  await page.reload();
  await page.getByTestId('theme-state-light').waitFor({ state: 'visible', timeout: 30000 });
  // The state marker proves the user node resolved; only then is "no
  // attribute" meaningful (the pre-resolve render is light by default).
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});

test('guest never renders dark', async ({ page }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // The Sign out button lives on the Account page (route '/').
  await page.getByRole('button', { name: 'Account' }).click();
  await logout(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(body(page)).toHaveCSS('background-color', 'rgb(243, 244, 246)');
});

test('toggle writes theme to RTDB', async ({ page }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() => readDb(`users/${uid}/prefs/theme`), { timeout: 10000 })
    .toBe('dark');
});

test('light dialog scrim separates the sheet from the pale page', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await page.goto('/admin/songs');
  await expect(page.getByTestId('admin-songs-table')).toBeVisible();
  await page.getByTestId('admin-add-song').click();
  await page.getByTestId('admin-paste-input').fill('Title: E2E Light Scrim\n\nA lyric line');
  await page.getByTestId('admin-parse-button').click();
  await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
  await expect(page.locator('.cdk-overlay-backdrop')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0.45)',
  );
  await page.getByTestId('draft-cancel').click();
  await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
});

test('dark dialog scrim separates the sheet from the dark page', async ({ page }) => {
  try {
    await login(page, 'admin');
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Wait for the preference write before the finally deletes it, or the
    // in-flight write can land afterwards and leak dark into later specs.
    await expect
      .poll(() => readDb(`users/${adminUid}/prefs/theme`), { timeout: 10000 })
      .toBe('dark');
    await page.goto('/admin/songs');
    await expect(page.getByTestId('admin-songs-table')).toBeVisible();
    await page.getByTestId('admin-add-song').click();
    await page.getByTestId('admin-paste-input').fill('Title: E2E Scrim\n\nA lyric line');
    await page.getByTestId('admin-parse-button').click();
    await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
    await expect(page.locator('.cdk-overlay-backdrop')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0.55)',
    );
    await page.getByTestId('draft-cancel').click();
    await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
  } finally {
    await deleteDb(`users/${adminUid}/prefs`);
  }
});

test('no console errors during theme flows', async ({ page, collector }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(
    collector.errors.filter((e) => !e.includes('[Emulator]')),
    'no console/page errors beyond the allowlist',
  ).toEqual([]);
});

test('family explorer removal footer stays readable in both themes', async ({ page }) => {
  await login(page, 'user');
  await page.goto('/family-explorer/ferland');
  await expect(page.getByTestId('family-explorer-page')).toBeVisible();
  const link = page.locator('.explorer-footer .removal-link');
  await expectReadable(link);
  const light = await surfaceColors(link);

  await page.goto('/media/explorer');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/family-explorer/ferland');
  await expect(page.getByTestId('family-explorer-page')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectReadable(link);
  const dark = await surfaceColors(link);
  expect(dark.background, 'footer surface follows the theme').not.toBe(light.background);
});

test('pending banner stays readable in both themes', async ({ page }) => {
  await writeDb(`users/${otherUid}/roles`, {});
  try {
    await login(page, 'other');
    const banner = page.locator('.pending-banner');
    await expectReadable(banner);
    const light = await surfaceColors(banner);

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectReadable(banner);
    const dark = await surfaceColors(banner);
    expect(dark.background, 'banner surface follows the theme').not.toBe(light.background);
  } finally {
    await writeDb(`users/${otherUid}/roles`, otherRoles);
  }
});

test('admin family explorer stays readable in both themes', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/admin/family-explorer');
  const row = page.getByTestId('archive-row-ferland');
  await expect(row).toBeVisible();
  const cell = row.locator('td').first();
  await expectReadable(cell);
  const light = await surfaceColors(cell);

  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(row).toBeVisible();
  await expectReadable(cell);
  const dark = await surfaceColors(cell);
  expect(dark.background, 'table surface follows the theme').not.toBe(light.background);
});

test('person tree renders theme-aware rows in both themes', async ({ page }) => {
  await login(page, 'user');
  await page.goto('/people');
  const root = page.locator('.first-gen-person', { hasText: 'Alice' });
  await expect(root).toBeVisible();
  await root.click();
  const modal = page.locator('app-person-detail-modal');
  await expect(modal.locator('.close-button')).toBeVisible();
  const bar = modal.locator('.generation-bar').first();
  await expect(bar).toBeVisible();
  const lightBar = await bar.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(lightBar, 'generation tint is opaque').not.toBe('rgba(0, 0, 0, 0)');
  await expectReadable(modal.locator('.person-name').first());
  const light = await surfaceColors(modal.locator('.person-name').first());
  await modal.locator('.close-button').click();
  await expect(modal).toHaveCount(0);

  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await root.click();
  await expect(modal.locator('.close-button')).toBeVisible();
  await expect(modal.locator('.generation-bar').first()).toBeVisible();
  await expectReadable(modal.locator('.person-name').first());
  const dark = await surfaceColors(modal.locator('.person-name').first());
  expect(dark.background, 'tree surface follows the theme').not.toBe(light.background);
});
