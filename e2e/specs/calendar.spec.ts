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
    const before = (await monthLabel.textContent())?.trim() ?? '';
    const next = new Date();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const expectedNext = next.toLocaleString('en-US', { month: 'long' });
    await page.locator('.calendar-nav-btn').last().click();
    await expect(monthLabel).toHaveText(expectedNext);
    // Previous restores the month the test started on.
    await page.locator('.calendar-nav-btn').first().click();
    await expect(monthLabel).toHaveText(before);
  });

  test('printer view opens and shows the seeded year', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Print' }).click();
    await expect(page.locator('.calendar-printer-title')).toContainText('Print Calendar');
    const year = new Date().getFullYear().toString();
    await expect(page.getByRole('button', { name: year, exact: true })).toBeVisible();
  });

  test('birth tags use the blue accent and anniversary tags the red accent', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');

    const birth = page.locator('.event-birth .calendar-cell-event-container').first();
    const anniv = page.locator('.event-anniv .calendar-cell-event-container').first();
    await expect(birth).toBeVisible();
    await expect(anniv).toBeVisible();
    await expect(birth).toHaveCSS('border-left-color', 'rgb(43, 108, 176)');
    await expect(anniv).toHaveCSS('border-left-color', 'rgb(197, 48, 48)');
  });

  test('event tags are inset 4px from the day cell edge', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');

    const tag = page.locator('.event-birth .calendar-cell-event-container').first();
    await expect(tag).toBeVisible();
    const inset = await tag.evaluate((el) => {
      const cell = el.closest('.cal-day-cell');
      if (!cell) return null;
      return Math.round(el.getBoundingClientRect().left - cell.getBoundingClientRect().left);
    });
    expect(inset).toBe(4);
  });

  test('month picker opens on the pill and closes on outside click or Escape', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');

    const pill = page.locator('.calendar-month-year-pill');
    const panel = page.locator('.calendar-datepicker-panel');
    await expect(panel).toHaveCount(0);

    await pill.click();
    await expect(panel).toBeVisible();
    await expect(pill).toHaveAttribute('aria-expanded', 'true');

    await page.locator('.calendar-nav-row').click({ position: { x: 4, y: 4 } });
    await expect(panel).toHaveCount(0);
    await expect(pill).toHaveAttribute('aria-expanded', 'false');

    await pill.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(pill).toBeFocused();
  });

  test('nav row keeps its vertical rhythm at desktop and 390px', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');

    const navRow = page.locator('.calendar-nav-row');
    await expect(navRow).toHaveCSS('margin-top', '24px');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(navRow).toHaveCSS('margin-top', '16px');
  });

  test('print dialog uses the shared scale and the primary action treatment', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Print' }).click();

    await expect(page.locator('.calendar-printer-title')).toBeVisible();
    const year = new Date().getFullYear().toString();
    await expect(page.getByRole('button', { name: year, exact: true })).toBeVisible();

    await expect(page.locator('.calendar-printer-action-btn')).toHaveCSS('background-color', 'rgb(45, 90, 39)');

    const content = page.locator('.mat-mdc-dialog-content');
    await expect(content).toBeVisible();
    const padding = await content.evaluate((el) => {
      const styles = getComputedStyle(el);
      return { top: parseFloat(styles.paddingTop), left: parseFloat(styles.paddingLeft) };
    });
    expect(padding.top).toBeGreaterThanOrEqual(24);
    expect(padding.left).toBeGreaterThanOrEqual(24);
  });

  test('clicking an event opens the person modal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    const birthEvent = page.locator('.event-birth', { hasText: 'Alice Anderson' }).first();
    await birthEvent.locator('.event-title-link').click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
  });
});
