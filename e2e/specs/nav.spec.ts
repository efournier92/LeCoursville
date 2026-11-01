import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('navigation', () => {
  test('logged-out toolbar shows no feature links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#lecoursville-navbar-links')).toHaveCount(0);
  });

  test('logged-in nav shows enabled features and never the Admin entry', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    await expect(nav.getByRole('button', { name: 'People' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Contacts' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Calendar' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Music' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Videos' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Photos' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Expressions' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Upload' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Account' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Chat' })).toHaveCount(0);
    // Family Explorer is a URL-shared public page, never app chrome.
    await expect(nav.getByRole('button', { name: 'Family Explorer' })).toHaveCount(0);
    await expect(nav.getByTestId('nav-admin-link')).toHaveCount(0);
  });

  test('cached session renders nav links immediately, never Sign In', async ({ page }) => {
    await login(page, 'user');
    // Hold every RTDB websocket so the reload boots with a cached session
    // whose RTDB user record cannot load: the nav must still render the
    // links instantly from the localStorage cache.
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    await page.routeWebSocket(/ws:\/\/[^/]*:9000\/.*/, async ws => {
      await gate;
      ws.connectToServer();
    });

    await page.reload();
    // Cache-first: navbar-links renders instantly with its flags skeleton;
    // the auth skeleton and Sign In must never appear for a cached session.
    await expect(page.getByTestId('nav-flags-skeleton')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' })).toHaveCount(0);
    await expect(page.getByTestId('nav-links-skeleton')).toHaveCount(0);

    release();
    // Flags resolve and the real links render.
    await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();
    await expect(page.getByTestId('nav-flags-skeleton')).toHaveCount(0);
  });

  test('clicking each toolbar link navigates to its route', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    const links: [string, RegExp][] = [
      ['People', /\/people/],
      ['Contacts', /\/contacts/],
      ['Calendar', /\/calendar/],
      ['Music', /\/media\/audio/],
      ['Videos', /\/media\/video/],
      ['Photos', /\/photos/],
      ['Expressions', /\/expressions/],
      ['Upload', /\/upload/],
    ];
    for (const [label, url] of links) {
      await nav.getByRole('button', { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(nav).toBeVisible();
    }
  });
});

test.describe('admin sidebar navigation', () => {
  test('super admin sidebar shows Contacts (People) and Expressions (Content)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    const nav = page.getByTestId('admin-nav');
    const contacts = nav.getByTestId('admin-nav-link-contacts');
    await expect(contacts).toBeVisible();
    await expect(contacts).toHaveText(/Contacts/);
    await expect(
      page.getByTestId('admin-nav-group-people').locator('.admin-nav-link-contacts, [data-testid="admin-nav-link-contacts"]'),
    ).toHaveCount(1);
    const expressions = nav.getByTestId('admin-nav-link-expressions');
    await expect(expressions).toBeVisible();
    await expect(expressions).toHaveText(/Expressions/);
    await expect(
      page.getByTestId('admin-nav-group-content').locator('[data-testid="admin-nav-link-expressions"]'),
    ).toHaveCount(1);
    // The entries navigate to their admin routes.
    await contacts.click();
    await expect(page).toHaveURL(/\/admin\/contacts/);
    await expressions.click();
    await expect(page).toHaveURL(/\/admin\/expressions/);
  });

  test('member navbar is unchanged by the admin route additions', async ({ page }) => {
    await login(page, 'user');
    const nav = page.locator('#lecoursville-navbar-links');
    await expect(nav.getByTestId('nav-admin-link')).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Expressions' })).toBeVisible();
  });
});
