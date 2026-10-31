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

  test('at 600px the inline links are hidden and the hamburger carries them', async ({ page }) => {
    await login(page, 'admin');
    await page.setViewportSize({ width: 600, height: 800 });
    // Below lg the inline nav collapses; only the hamburger shows.
    await expect(page.locator('#lecoursville-navbar-links')).toBeHidden();
    const hamburger = page.locator('.icons-menu .menu-icon-container');
    await expect(hamburger).toBeVisible();
    // The hamburger menu carries the same links.
    await hamburger.click();
    const menu = page.locator('.toolbar-routes-menu');
    // mat-menu items carry role=menuitem, not button.
    await expect(menu.getByRole('menuitem', { name: 'People' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Calendar' })).toBeVisible();
  });

  test('active nav button shows a 3px bar flush with the toolbar bottom', async ({ page }) => {
    await login(page, 'admin');
    await page.locator('#lecoursville-navbar-links').getByRole('button', { name: 'People' }).click();
    await expect(page).toHaveURL(/\/people/);

    const bar = page.locator('button.active .active-indicator');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveCSS('height', '3px');

    const barBox = (await bar.boundingBox())!;
    const toolbarBox = (await page.locator('mat-toolbar').first().boundingBox())!;
    // Flush: the bar's bottom edge sits on the toolbar's bottom edge.
    expect(Math.abs(barBox.y + barBox.height - (toolbarBox.y + toolbarBox.height))).toBeLessThanOrEqual(1);
    // Full-width: the bar spans the active button (icon + label + padding).
    const buttonBox = (await page.locator('button.active').boundingBox())!;
    expect(Math.abs(barBox.width - buttonBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(barBox.x - buttonBox.x)).toBeLessThanOrEqual(1);
  });

  test('nav link computed font-size is 15px', async ({ page }) => {
    await login(page, 'admin');
    const people = page.locator('#lecoursville-navbar-links').getByRole('button', { name: 'People' });
    await expect(people).toBeVisible();
    await expect(people).toHaveCSS('font-size', '15px');
  });

  test('toolbar renders the elevation-8 drop shadow', async ({ page }) => {
    await login(page, 'admin');
    const toolbar = page.locator('mat-toolbar').first();
    await expect(toolbar).toBeVisible();
    const boxShadow = await toolbar.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).toContain('rgba(0, 0, 0, 0.2)');
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
