import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('admin analytics', () => {
  test.afterEach(async ({ collector }) => collector.assertClean());

  test('analytics: renders the emulator fixture totals, top pages, and top events', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/analytics');

    const totals = page.getByTestId('admin-analytics-totals');
    await expect(totals).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('admin-analytics-users')).toHaveText('1204');
    await expect(page.getByTestId('admin-analytics-sessions')).toHaveText('3567');

    const pages = page.getByTestId('admin-analytics-pages');
    await expect(pages.locator('tbody tr')).toHaveCount(10);
    await expect(pages).toContainText('/calendar');

    const events = page.getByTestId('admin-analytics-events');
    await expect(events.locator('tbody tr')).toHaveCount(10);
    await expect(events).toContainText('page_view');
  });

  test('analytics: a non-admin cannot reach the page', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/admin/analytics');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByTestId('admin-analytics-totals')).toHaveCount(0);
  });
});
