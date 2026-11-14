import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { expectNoHorizontalOverflow } from '../helpers/overflow';

const MOBILE = { width: 390, height: 844 };

async function gotoNovember(page: import('../helpers/fixture').Page): Promise<void> {
  await page.goto('/calendar?year=2026&month=11');
  await expect(page.locator('.cal-days')).toBeVisible();
}

test.describe('calendar mobile month', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page, 'admin');
  });

  test('month cells show dots and no event text', async ({ page }) => {
    await gotoNovember(page);
    const day = page.getByRole('button', { name: /^November 14, 1 event: anniversary$/ });
    await expect(day).toBeVisible();
    await expect(day.locator('.day-dot')).toHaveCount(1);
    await expect(day.locator('.cal-events-desktop')).toHaveCSS('opacity', '0');
    await expect(day.locator('.cal-events-desktop')).toHaveCSS('pointer-events', 'none');
  });

  test('day cells expose accessible labels with event counts', async ({ page }) => {
    await gotoNovember(page);
    await expect(page.getByRole('button', { name: 'November 14, 1 event: anniversary' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'November 3, no events' })).toBeVisible();
  });

  test('tapping a day with events reveals the agenda below the grid', async ({ page }) => {
    await gotoNovember(page);
    const grid = page.locator('.calendar-month-view-container');
    const day = page.getByRole('button', { name: /^November 14, 1 event: anniversary$/ });
    await day.click();
    await expect(day).toHaveAttribute('aria-selected', 'true');

    const agenda = page.locator('app-day-agenda');
    await expect(agenda).toBeVisible();
    await expect(agenda.locator('.day-agenda-heading')).toHaveText(/November 14/);
    await expect(agenda).toContainText('Dave Davis');
    await expect(agenda).toContainText('Anniversary');

    const agendaBox = await agenda.boundingBox();
    const gridBox = await grid.boundingBox();
    expect(agendaBox).not.toBeNull();
    expect(gridBox).not.toBeNull();
    expect(agendaBox!.y).toBeGreaterThanOrEqual(gridBox!.y + gridBox!.height - 1);
  });

  test('tapping an empty day shows the empty line', async ({ page }) => {
    await gotoNovember(page);
    await page.getByRole('button', { name: 'November 3, no events' }).click();
    const agenda = page.locator('app-day-agenda');
    await expect(agenda).toBeVisible();
    await expect(agenda.locator('.day-agenda-empty')).toHaveText('No events');
  });

  test('month grid has no horizontal overflow at 390px', async ({ page }) => {
    await gotoNovember(page);
    await expectNoHorizontalOverflow(page.locator('.calendar-scroll-container'));
  });
});

test.describe('calendar desktop month', () => {
  test('keeps full text chips at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, 'admin');
    await gotoNovember(page);
    await expect(page.locator('.event-anniv', { hasText: 'Dave Davis' }).first()).toBeVisible();
    const eventCell = page.locator('.cal-day-control', {
      has: page.locator('.event-anniv', { hasText: 'Dave Davis' }),
    });
    await expect(eventCell.locator('.cal-events-desktop')).toBeVisible();
    await expect(page.locator('.day-dot').first()).toBeHidden();
    await expect(page.locator('app-day-agenda')).toBeHidden();
  });
});
