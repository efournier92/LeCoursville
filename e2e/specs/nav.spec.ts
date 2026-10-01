import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('navigation', () => {
  test('logged-out toolbar shows no feature links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#lecoursville-navbar-links')).toHaveCount(0);
  });

  test('logged-in toolbar shows enabled features but NOT chat', async ({ page }) => {
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
