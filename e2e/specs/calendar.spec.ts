import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('calendar', () => {
  test('current month shows the seeded birthdays and anniversary', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    // Alice birthday is today; Ben birthday is +2 days; Carol & Dave anniversary is +1 day.
    // (Anniversary titles render as split spans: primary + '&' + spouse.)
    await expect(page.locator('.event-birth', { hasText: 'Alice Anderson' }).first()).toBeVisible();
    await expect(page.locator('.event-birth', { hasText: 'Ben Brown' }).first()).toBeVisible();
    await expect(page.locator('.event-anniv', { hasText: 'Dave Davis' }).first()).toBeVisible();
  });

  test('a birthday three months ago is NOT shown in the current month', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    // Dave's own BIRTHDAY event must not appear (he does appear as Carol's
    // anniversary spouse, which is a separate .event-anniv node).
    await expect(page.locator('.event-birth', { hasText: 'Dave Davis' })).toHaveCount(0);
  });

  test('view switch changes the month without console errors', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    const monthLabel = page.locator('.calendar-month-label');
    const before = (await monthLabel.textContent())?.trim();
    await page.locator('.calendar-nav-btn').last().click();
    await expect(monthLabel).not.toHaveText(before ?? '____');
  });

  test('printer view opens and shows the seeded year', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Print' }).click();
    await expect(page.locator('.calendar-printer-title')).toContainText('Print Calendar');
    const year = new Date().getFullYear().toString();
    await expect(page.getByRole('button', { name: year })).toBeVisible();
  });

  test('clicking an event opens the person modal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    const birthEvent = page.locator('.event-birth', { hasText: 'Alice Anderson' }).first();
    await birthEvent.locator('.event-title-link').click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
  });
});
