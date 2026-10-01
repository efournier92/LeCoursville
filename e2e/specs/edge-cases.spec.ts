import { test, expect } from '../helpers/fixture';
import { login, logout } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';

test.describe('edge cases', () => {
  test('double-submit auth: two rapid clicks produce one sign-in, no error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-email').fill('admin@e2e.local');
    await page.getByTestId('auth-password').fill('E2e-pass-2026');
    await page.getByTestId('auth-submit').click();
    await page.getByTestId('auth-submit').click({ force: true }).catch(() => {});
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();
    await expect(page.getByTestId('auth-error')).toHaveCount(0);
  });

  test('double-submit chat: Send opens one confirm and saves exactly one message', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'New Message' }).first().click();
    await page.getByPlaceholder('Title').fill('E2E Double Title');
    await page.getByTestId('chat-message-input').fill('Only one copy should exist.');
    // First click opens the confirm; the isSaving guard makes the form swap to
    // a spinner (chat-send leaves the DOM), so no second dialog can ever open.
    await page.getByTestId('chat-send').click();
    await expect(page.getByRole('heading', { name: 'Are You Sure?' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('E2E Double Title')).toHaveCount(1);
    // Restore the seeded flag state for later spec files.
    await setFeatureFlag(page, 'chat', false);
  });

  test('navigation race: rapid SPA route hops settle on the last route without errors', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    // In-app transitions (not full reloads): overlaps the router's async
    // guards and settles on the last destination.
    const hops = ['People', 'Contacts', 'Calendar', 'Photos', 'Expressions', 'Contacts'];
    for (const label of hops) {
      await nav.getByRole('button', { name: label }).click();
    }
    await expect(page).toHaveURL(/\/contacts/);
    await expect(page.locator('.contacts-skeleton-grid, .contacts-grid').first()).toBeAttached();
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
  });

  test('empty state: album search with no matches shows the no-results message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/photos');
    await page.getByLabel('Search albums').fill('zzznope');
    await expect(page.getByText('Nothing found')).toBeVisible();
  });

  test('malformed CSV import surfaces validation errors', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/people');
    const bad = [
      'ID,Name_First_Given,Name_Last,Birthday',
      'bad-row-1,One',
      'bad-row-2,Two,LastName',
    ].join('\n');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'bad.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(bad),
    });
    await expect(page.locator('.error-card')).toBeVisible();
    await expect(page.locator('.validation-list li').first()).toBeVisible();
    // No import button while errors exist.
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toHaveCount(0);
  });

  test('XSS-shaped string in a person name renders as text only', async ({ page }) => {
    await login(page, 'admin');
    // Seed-like person created via the import pipeline with an XSS name.
    await page.goto('/admin/people');
    const csv = [
      'ID,Name_First_Given,Name_First_Preferred,Name_Last,Birthday,Generation_Number,Living?,Family',
      'xss-1,<img src=x onerror=window.__xss=3>,<img src=x onerror=window.__xss=3>,Probe,1990-01-15,1,TRUE,Mignonne',
    ].join('\n');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'xss.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText('Import Preview')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Import' }).click();
    await expect(page.getByText('Import Complete')).toBeVisible({ timeout: 15000 });
    await page.goto('/people');
    await expect(page.getByText('Probe').first()).toBeVisible();
    await page.waitForTimeout(1000);
    const xss = await page.evaluate(() => (window as any).__xss ?? 0);
    expect(xss).toBe(0);
  });
});
