import { test, expect } from '../helpers/fixture';
import { login, logout } from '../helpers/auth';
import { readDb, deleteDb } from '../helpers/admin-db';

/**
 * Dark mode: per-user theme toggle stored at users/{uid}/prefs/theme.
 * Light is the floor for every unknown state; guests never render dark.
 */

const USER_EMAIL = 'user@e2e.local';
let uid: string | null = null;

test.beforeAll(async () => {
  const users = (await readDb<Record<string, { email?: string }>>('users')) ?? {};
  uid = Object.keys(users).find((id) => users[id]?.email === USER_EMAIL) ?? null;
  expect(uid, 'seeded user@e2e.local must resolve to a uid').toBeTruthy();
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
