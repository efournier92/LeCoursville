import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { expectNoHorizontalOverflow } from '../helpers/overflow';
import { expectMinTouchTarget } from '../helpers/touch';

const MOBILE = { width: 390, height: 844 };

async function gotoNovember(page: import('../helpers/fixture').Page): Promise<void> {
  await page.goto('/calendar?year=2026&month=11');
  await expect(page.locator('.cal-days')).toBeVisible();
}

function preview(page: import('../helpers/fixture').Page) {
  return page.locator('app-week-agenda.calendar-timeline-preview');
}

test.describe('calendar mobile month', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page, 'admin');
    // Timers keep running, only the wall clock is pinned so "today" is stable.
    await page.clock.setFixedTime(new Date('2026-11-14T12:00:00'));
  });

  test('month cells show dots and hide the desktop chip layer', async ({ page }) => {
    await gotoNovember(page);
    const grid = page.locator('.calendar-month-view-container');
    const day = grid.getByRole('button', { name: /^November 14, 1 event: anniversary$/ });
    await expect(day).toBeVisible();
    await expect(day.locator('.day-dot')).toHaveCount(1);
    await expect(day.locator('.cal-events-desktop')).toBeHidden();
  });

  test('day cells expose accessible labels with event counts', async ({ page }) => {
    await gotoNovember(page);
    const grid = page.locator('.calendar-month-view-container');
    await expect(grid.getByRole('button', { name: 'November 14, 1 event: anniversary' })).toBeVisible();
    await expect(grid.getByRole('button', { name: 'November 3, no events' })).toBeVisible();
  });

  test('preview sits above the grid and shows today with the anniversary name', async ({ page }) => {
    await gotoNovember(page);
    const card = preview(page);
    await expect(card).toBeVisible();
    const rows = card.locator('.week-agenda-item');
    await expect(rows).toHaveCount(3);
    const today = card.locator('.week-agenda-item[data-today="true"]');
    await expect(today).toBeVisible();
    await expect(today.locator('.week-agenda-date')).toHaveAttribute('aria-current', 'date');
    await expect(today.locator('.event-anniv', { hasText: 'Dave Davis' })).toBeVisible();
    await expect(card.locator('.week-agenda-title')).toHaveText('Timeline');

    const cardBox = await card.boundingBox();
    const gridBox = await page.locator('.calendar-month-view-container').boundingBox();
    expect(cardBox).not.toBeNull();
    expect(gridBox).not.toBeNull();
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(gridBox!.y);
  });

  test('preview stays inside the fold at 390x844 and 320x568', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await gotoNovember(page);
      await page.evaluate(() => window.scrollTo(0, 0));

      const card = preview(page);
      const todayRow = card.locator('.week-agenda-item[data-today="true"]');
      const dave = card.locator('.event-anniv', { hasText: 'Dave Davis' }).first();
      const innerHeight = await page.evaluate(() => window.innerHeight);
      const todayBox = await todayRow.boundingBox();
      const daveBox = await dave.boundingBox();

      expect(todayBox).not.toBeNull();
      expect(daveBox).not.toBeNull();
      expect(todayBox!.y + todayBox!.height).toBeLessThanOrEqual(innerHeight);
      expect(daveBox!.y + daveBox!.height).toBeLessThanOrEqual(innerHeight);
    }
  });

  test('preview precedes the grid in DOM and owns the first focusable control after nav', async ({ page }) => {
    await gotoNovember(page);
    const order = await page.evaluate(() => {
      const card = document.querySelector('app-week-agenda.calendar-timeline-preview');
      const grid = document.querySelector('.calendar-scroll-container');
      const nav = document.querySelector('.calendar-nav-row');
      if (!card || !grid || !nav) return null;
      const previewBeforeGrid = !!(card.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING);
      const focusables = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]'));
      const firstAfterNav = focusables.find(el =>
        !nav.contains(el) && (nav.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      return {
        previewBeforeGrid,
        firstAfterNavInPreview: !!firstAfterNav?.closest('app-week-agenda'),
      };
    });
    expect(order).not.toBeNull();
    expect(order!.previewBeforeGrid).toBe(true);
    expect(order!.firstAfterNavInPreview).toBe(true);
  });

  test('expanded sheet scrolls both ways and returns after closing a person', async ({ page }) => {
    await gotoNovember(page);
    await page.getByRole('button', { name: 'Expand' }).click();

    const sheet = page.locator('app-calendar-agenda-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.calendar-agenda-sheet-header h2')).toHaveText('Expand');
    const rows = sheet.locator('.week-agenda-item');
    await expect(rows).toHaveCount(21);

    const scroller = sheet.locator('.week-agenda-scroll');
    await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(rows).toHaveCount(28);

    await scroller.evaluate(el => { el.scrollTop = 0; });
    await expect(rows).toHaveCount(35);
    await expect(sheet.locator('.week-agenda-today-btn')).toBeVisible();

    const dave = sheet.locator('.event-title-link, .event-title-spouse-link')
      .filter({ hasText: 'Dave Davis' })
      .first();
    await dave.click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Dave Davis');
    await expect(sheet).toBeVisible();

    await page.locator('app-person-detail-modal .close-button').click();
    await expect(page.locator('app-person-detail-modal')).toHaveCount(0);
    await expect(sheet).toBeVisible();
    await expect(rows).toHaveCount(35);
  });

  test('tapping a grid day moves the preview to that day', async ({ page }) => {
    await gotoNovember(page);
    const grid = page.locator('.calendar-month-view-container');
    await grid.getByRole('button', { name: 'November 20, no events' }).click();

    const card = preview(page);
    const firstRow = card.locator('.week-agenda-item').first();
    await expect(firstRow).toContainText('20');
    await expect(firstRow.locator('.week-agenda-date')).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('.week-agenda-range')).toContainText('Nov 20');
  });

  test('mobile print is a filled brand action below the grid and opens the print route', async ({ page }) => {
    await gotoNovember(page);
    await expect(page.locator('.calendar-print-button')).toBeHidden();
    const mobile = page.locator('.calendar-print-button-mobile');
    await expect(mobile).toBeVisible();
    await expect(mobile).toHaveText(/Print Calendar/);
    await expect(mobile).toHaveCSS('background-color', 'rgb(39, 116, 74)');
    await expect(mobile).toBeEnabled();

    const gridBox = await page.locator('.calendar-month-view-container').boundingBox();
    const printBox = await mobile.boundingBox();
    expect(gridBox).not.toBeNull();
    expect(printBox).not.toBeNull();
    expect(printBox!.height).toBeGreaterThanOrEqual(44);
    expect(printBox!.y).toBeGreaterThanOrEqual(gridBox!.y + gridBox!.height - 1);

    await mobile.click();
    await expect(page).toHaveURL(/\/calendar\/print/);
  });

  test('preview and grid have no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await gotoNovember(page);
    await expectNoHorizontalOverflow(preview(page));
    await expectNoHorizontalOverflow(page.locator('.calendar-scroll-container'));
  });
});

test.describe('calendar landscape and tablet', () => {
  test('844x390 landscape keeps the preview with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await login(page, 'user');
    await page.clock.setFixedTime(new Date('2026-11-14T12:00:00'));
    await page.goto('/calendar?year=2026&month=11');
    await expect(page.locator('.cal-days')).toBeVisible();
    await expect(preview(page)).toBeVisible();
    await expectNoHorizontalOverflow(page.locator('.calendar-scroll-container'));
    await expectNoHorizontalOverflow(page.locator('.app-container'));
    await expect(page.locator('.day-dot').first()).toBeVisible();
    await expect(page.locator('.cal-events-desktop').first()).toBeHidden();
  });

  test('1024x768 keeps full chips at a 24px touch height', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await login(page, 'user');
    await page.goto('/calendar?year=2026&month=11');
    await expect(page.locator('.cal-days')).toBeVisible();
    await expect(preview(page)).toBeHidden();
    const grid = page.locator('.calendar-month-view-container');
    await expect(grid.locator('.event-title-link').first()).toBeVisible();
    await expectMinTouchTarget(page, '.calendar-month-view-container .event-title-link');
    await expectNoHorizontalOverflow(page.locator('.calendar-scroll-container'));
  });
});

test.describe('calendar desktop month', () => {
  test('keeps full text chips at 1280px with no preview or sheet', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, 'admin');
    await gotoNovember(page);
    await expect(preview(page)).toBeHidden();
    await expect(page.locator('app-calendar-agenda-sheet')).toHaveCount(0);
    const grid = page.locator('.calendar-month-view-container');
    await expect(grid.locator('.event-anniv', { hasText: 'Dave Davis' }).first()).toBeVisible();
    const eventCell = page.locator('.cal-day-control', {
      has: page.locator('.event-anniv', { hasText: 'Dave Davis' }),
    });
    await expect(eventCell.locator('.cal-events-desktop')).toBeVisible();
    await expect(page.locator('.day-dot').first()).toBeHidden();
  });
});
