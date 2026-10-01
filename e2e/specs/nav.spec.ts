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
