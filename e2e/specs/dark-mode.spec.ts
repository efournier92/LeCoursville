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
 * Dark mode: the toolbar toggle is session-only; the Account page persists
 * the per-user preference at users/{uid}/prefs/theme.
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

test('theme control exposes switch semantics with an action icon', async ({ page }) => {
  await login(page, 'user');
  const toggle = page.getByTestId('theme-toggle');
  await expect(toggle).toHaveAttribute('role', 'switch');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  // Icon shows the action, not current state: moon in light (→ dark),
  // sun in dark (→ light).
  await expect(page.getByTestId('theme-icon-moon')).toBeVisible();
  await expect(page.getByTestId('theme-icon-sun')).toHaveCount(0);
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('theme-icon-sun')).toBeVisible();
  await expect(page.getByTestId('theme-icon-moon')).toHaveCount(0);
  await toggle.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('theme toggle sits at the far right of the top nav, after Account', async ({ page }) => {
  await login(page, 'user');
  const logo = page.locator('.toolbar-logo');
  const toggle = page.getByTestId('theme-toggle');
  const account = page.getByRole('button', { name: 'Account' });
  await expect(logo).toBeVisible();
  await expect(toggle).toBeVisible();
  await expect(account).toBeVisible();
  const logoBox = await logo.boundingBox();
  const toggleBox = await toggle.boundingBox();
  const accountBox = await account.boundingBox();
  expect(logoBox && toggleBox && accountBox).toBeTruthy();
  // Logo stays within the 64px toolbar row (it had blown up when the left
  // cluster lost its definite height).
  expect(logoBox!.height).toBeLessThanOrEqual(64);
  // Logo on the left; toggle is the rightmost control, after Account.
  expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(toggleBox!.x);
  expect(accountBox!.x + accountBox!.width).toBeLessThanOrEqual(toggleBox!.x);
});

test('theme switch operates by keyboard', async ({ page }) => {
  await login(page, 'user');
  const toggle = page.getByTestId('theme-toggle');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Space');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('session toggle survives a reload in the same tab', async ({ page }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  // The toolbar override is session-scoped (sessionStorage): it survives a
  // reload in this tab but never touches the account preference.
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
  await page.getByTestId('theme-toggle').waitFor({ state: 'visible', timeout: 30000 });
  // The visible toggle proves the user node resolved; aria-checked proves the
  // stored preference loaded before asserting "no attribute".
  await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-checked', 'false');
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

test('toolbar toggle is session-only and leaves the account pref untouched', async ({ page }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // The account preference must remain unset (no RTDB write).
  await expect.poll(() => readDb(`users/${uid}/prefs/theme`), { timeout: 5000 }).toBeNull();
  // And the account card reflects no saved preference.
  await page.getByRole('button', { name: 'Account' }).click();
  const pref = page.getByTestId('account-always-dark');
  await expect(pref).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.account-theme-label')).toHaveText('Always Light');
});

test('account "Always use dark mode" persists to RTDB and a fresh session', async ({ page }) => {
  await login(page, 'user');
  await page.getByRole('button', { name: 'Account' }).click();
  const pref = page.getByTestId('account-always-dark');
  await expect(pref).toHaveAttribute('aria-checked', 'false');
  const label = page.locator('.account-theme-label');
  await expect(label).toHaveText('Always Light');
  await pref.click();
  await expect(pref).toHaveAttribute('aria-checked', 'true');
  await expect(label).toHaveText('Always Dark');
  await expect
    .poll(() => readDb(`users/${uid}/prefs/theme`), { timeout: 10000 })
    .toBe('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // The pref write emits a user update; it must not trigger the promoted-route
  // bounce and yank us off Account.
  await expect(page).toHaveURL(/\/$/);
  // Simulate a new session: drop the per-tab override, then reload. The
  // account preference alone must restore dark mode.
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.getByTestId('theme-toggle').waitFor({ state: 'visible', timeout: 30000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('account theme toggle keeps you on the account page', async ({ page }) => {
  await login(page, 'user');
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page).toHaveURL(/\/$/);
  const pref = page.getByTestId('account-always-dark');
  await pref.click();
  await expect(pref).toHaveAttribute('aria-checked', 'true');
  // Regression: the profile write used to emit a user update that re-ran the
  // promoted-route bounce, sending the user to /calendar mid-toggle.
  await expect(page).toHaveURL(/\/$/);
  await expect(pref).toBeVisible();
});

test('clicking anywhere on the account theme chip toggles it', async ({ page }) => {
  await login(page, 'user');
  await page.getByRole('button', { name: 'Account' }).click();
  const pref = page.getByTestId('account-always-dark');
  await expect(pref).toHaveAttribute('aria-checked', 'false');
  // Click the text label, not the icon pair: the whole chip is the control.
  await page.locator('.account-theme-label').click();
  await expect(pref).toHaveAttribute('aria-checked', 'true');
});

test('mobile: theme toggle sits just left of the hamburger', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await login(page, 'user');
  const toggle = page.getByTestId('theme-toggle');
  const burger = page.locator('.menu-icon-container');
  await expect(toggle).toBeVisible();
  await expect(burger).toBeVisible();
  const toggleBox = await toggle.boundingBox();
  const burgerBox = await burger.boundingBox();
  expect(toggleBox && burgerBox).toBeTruthy();
  // Toggle is immediately left of the burger, which stays at the right edge.
  expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(burgerBox!.x);
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
  // The overlay layer is raised above the fixed top nav, so the scrim dims the
  // header instead of the header painting over it.
  await expect(page.locator('.cdk-overlay-container')).toHaveCSS('z-index', '1200');
  const topAtHeader = await page.evaluate(() => {
    const toolbar = document.querySelector('mat-toolbar')!.getBoundingClientRect();
    const top = document.elementFromPoint(toolbar.left + 10, toolbar.top + toolbar.height / 2);
    return top?.className ?? '';
  });
  expect(topAtHeader).toContain('cdk-overlay-backdrop');
  await page.getByTestId('draft-cancel').click();
  await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
});

test('dark dialog scrim separates the sheet from the dark page', async ({ page }) => {
  try {
    await login(page, 'admin');
    await writeDb(`users/${adminUid}/prefs/theme`, 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
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

test('dark mode keeps filled brand controls on brand green with white ink', async ({ page }) => {
  await login(page, 'user');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const print = page.locator('.calendar-print-button');
  await expect(print).toBeVisible();
  // Brand solid (#2D5A27) survives dark mode; text stays white.
  const { text, background } = await surfaceColors(print);
  expect(background).toBe('rgb(45, 90, 39)');
  expect(text).toBe('rgb(255, 255, 255)');
  await expectReadable(print);
  // M3 filled buttons (Edit profile) follow the same brand-green + white rule.
  await page.getByRole('button', { name: 'Account' }).click();
  const edit = page.getByRole('button', { name: 'Edit profile' });
  await expect(edit).toBeVisible();
  const editColors = await surfaceColors(edit);
  expect(editColors.background).toBe('rgb(45, 90, 39)');
  expect(editColors.text).toBe('rgb(255, 255, 255)');
  await expectReadable(edit);
});

test('dark mode destructive confirm stays red with white ink', async ({ page }) => {
  await login(page, 'admin');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/admin/photo-albums');
  await expect(page.locator('.admin-album-grid')).toBeVisible();
  await page.getByRole('button', { name: 'New Album' }).click();
  const createDialog = page.locator('mat-dialog-container');
  await createDialog.getByLabel('Album title').fill('E2E Dark Throwaway');
  await createDialog.getByRole('button', { name: 'Create' }).click();
  const throwaway = page.locator('.admin-album-card', { hasText: 'E2E Dark Throwaway' });
  await expect(throwaway).toBeVisible();
  await throwaway.locator('button[matTooltip="Delete"]').click();
  const confirm = page.locator('app-confirm-dialog');
  await expect(confirm).toBeVisible({ timeout: 30_000 });
  const confirmButton = confirm.getByRole('button', { name: 'Delete album' });
  // The class must beat the html-level dark filled-button override.
  const { text, background } = await surfaceColors(confirmButton);
  expect(background).toBe('rgb(179, 38, 30)');
  expect(text).toBe('rgb(255, 255, 255)');
  await expectReadable(confirmButton);
  await expect(confirmButton.locator('mat-icon')).toBeVisible();
  await confirmButton.click();
  await expect(throwaway).toBeHidden();
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

test('account card surface follows the dark theme', async ({ page }) => {
  await login(page, 'user');
  // A fresh load at '/' bounces a signed-in user to the promoted route
  // (app.component), so reach the account card the way users do: the
  // Account toolbar link (client-side, no reload).
  await page.locator('#lecoursville-navbar-links').getByRole('button', { name: 'Account' }).click();
  const card = page.locator('.auth-card--account');
  await expect(card).toBeVisible();
  const light = await card.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Dark --color-surface is #1B1F24; color-mix 86% keeps that hue at 0.86 alpha.
  // Browsers serialize the mix either as rgba() or color(srgb ...), so match both.
  await expect(card).toHaveCSS(
    'background-color',
    /^(rgba\(27, 31, 36, 0\.86\)|color\(srgb 0\.1058\d* 0\.1215\d* 0\.1411\d* \/ 0\.86\))$/,
  );
  const dark = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(dark, 'card surface follows the theme').not.toBe(light);
});

test('topnav toolbar keeps the legacy prod green in both themes', async ({ page }) => {
  await login(page, 'user');
  const toolbar = page.locator('mat-toolbar').first();
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toHaveCSS('background-color', 'rgb(45, 90, 39)');

  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toolbar).toHaveCSS('background-color', 'rgb(45, 90, 39)');
});
