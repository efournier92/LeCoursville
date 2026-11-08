import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { expectNoHorizontalOverflow } from '../helpers/overflow';
import { readDb, writeDb } from '../helpers/admin-db';

let prefsUid: string | null = null;
let savedCalendarPrefs: unknown = null;

async function adminUid(): Promise<string | null> {
  const users = await readDb<Record<string, { email?: string }>>('users');
  return Object.entries(users ?? {}).find(([, user]) => user?.email === 'admin@e2e.local')?.[0] ?? null;
}

test.describe('calendar', () => {
  test.afterEach(async () => {
    // Restore user prefs first: a failing feature-flag write must not skip it.
    if (prefsUid) {
      await writeDb(`users/${prefsUid}/prefs/calendar`, savedCalendarPrefs);
      prefsUid = null;
      savedCalendarPrefs = null;
    }
    await writeDb('features/legacyCalendarPdf/enabled', false);
  });

  test('top bar does not overflow horizontally at 900px and 768px', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    try {
      for (const width of [900, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/calendar');
        // The month grid is an intentional horizontal scroller, so only the
        // toolbar is asserted here.
        await expectNoHorizontalOverflow(page.locator('app-page-toolbar .page-toolbar'));
      }
    } finally {
      await page.setViewportSize(original);
    }
  });

  test('all seven day columns fit the viewport at desktop and 900px', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    try {
      for (const width of [1280, 900]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/calendar');
        await expect(page.locator('.cal-days')).toBeVisible();
        const grid = page.locator('.calendar-month-view-container');
        const saturday = page.locator('.cal-header .cal-cell').last();
        await expect(saturday).toContainText('Saturday');
        const gridBox = await grid.boundingBox();
        const satBox = await saturday.boundingBox();
        expect(gridBox).not.toBeNull();
        expect(satBox).not.toBeNull();
        // Grid never extends past the viewport and Saturday is fully visible.
        expect(gridBox!.x + gridBox!.width).toBeLessThanOrEqual(width);
        expect(satBox!.x).toBeGreaterThanOrEqual(0);
        expect(satBox!.x + satBox!.width).toBeLessThanOrEqual(width);
      }
    } finally {
      await page.setViewportSize(original);
    }
  });

  test('pinned month shows the seeded birthday and anniversary', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=11');
    // Carol & Dave anniversary is seeded on November 14. (Anniversary titles
    // render as split spans: primary + '&' + spouse.)
    await expect(page.locator('.event-anniv', { hasText: 'Dave Davis' }).first()).toBeVisible();
    await expect(page.locator('.calendar-month-label')).toHaveText('November');
    await expect(page.locator('.calendar-year-label')).toHaveText('2026');
  });

  test('a birthday in another month is NOT shown in the pinned month', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=11');
    // Alice's birthday is seeded in March.
    await expect(page.locator('.event-birth', { hasText: 'Alice Anderson' })).toHaveCount(0);
  });

  test('view switch changes the month, year, and rendered events', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');
    const monthLabel = page.locator('.calendar-month-label');
    await expect(monthLabel).toHaveText('March');
    await expect(page.locator('.event-birth', { hasText: 'Alice Anderson' }).first()).toBeVisible();

    await page.locator('.calendar-nav-btn').last().click();
    await expect(monthLabel).toHaveText('April');
    await expect(page.locator('.event-birth', { hasText: 'Ben Brown' }).first()).toBeVisible();
    await expect(page.locator('.event-birth', { hasText: 'Alice Anderson' })).toHaveCount(0);

    // Previous restores the month and its events.
    await page.locator('.calendar-nav-btn').first().click();
    await expect(monthLabel).toHaveText('March');
    await expect(page.locator('.event-birth', { hasText: 'Alice Anderson' }).first()).toBeVisible();
  });

  test('print opens the generated calendar route', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');
    await page.getByRole('button', { name: 'Print' }).click();
    await expect(page).toHaveURL(/\/calendar\/print/);
    await expect(page.getByTestId('calendar-print-page')).toHaveCount(12);
    const firstPage = page.getByTestId('calendar-print-page').first();
    await expect(firstPage.getByTestId('calendar-print-month-name')).toHaveText('January');
    await expect(firstPage.getByTestId('calendar-print-year-label')).toHaveText('2026');
    await expect(firstPage.getByTestId('calendar-print-brand')).toHaveText(/^LeCours Family$/i);
  });

  test('birth tags use the blue accent and anniversary tags the red accent', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');

    const birth = page.locator('.event-birth .calendar-cell-event-container').first();
    const anniv = page.locator('.event-anniv .calendar-cell-event-container').first();
    await expect(birth).toBeVisible();
    await expect(anniv).toBeVisible();
    await expect(birth).toHaveCSS('border-left-color', 'rgb(43, 108, 176)');
    await expect(anniv).toHaveCSS('border-left-color', 'rgb(197, 48, 48)');
  });

  test('event tags are inset 4px from the day cell edge', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');

    const tag = page.locator('.event-birth .calendar-cell-event-container').first();
    await expect(tag).toBeVisible();
    const inset = await tag.evaluate((el) => {
      const cell = el.closest('.cal-day-cell');
      if (!cell) return null;
      return Math.round(el.getBoundingClientRect().left - cell.getBoundingClientRect().left);
    });
    expect(inset).toBe(4);
  });

  test('month picker selection changes the month and events, and closes on outside click or Escape', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');

    const pill = page.locator('.calendar-month-year-pill');
    const panel = page.locator('.calendar-datepicker-panel');
    await expect(panel).toHaveCount(0);

    await pill.click();
    await expect(panel).toBeVisible();
    await expect(pill).toHaveAttribute('aria-expanded', 'true');

    // Select November: the header, year, and rendered anniversary must all change.
    await panel.locator('.calendar-datepicker-cell').nth(10).click();
    await expect(panel).toHaveCount(0);
    await expect(pill).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.calendar-month-label')).toHaveText('November');
    await expect(page.locator('.calendar-year-label')).toHaveText('2026');
    await expect(page.locator('.event-anniv', { hasText: 'Dave Davis' }).first()).toBeVisible();

    await pill.click();
    await expect(panel).toBeVisible();
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
    await expect(navRow).toHaveCSS('margin-bottom', '24px');
    const desktopMargins = await navRow.evaluate((el) => {
      const styles = getComputedStyle(el);
      return { top: parseFloat(styles.marginTop), bottom: parseFloat(styles.marginBottom) };
    });
    expect(desktopMargins.top).toBe(desktopMargins.bottom);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/calendar');
    await expect(navRow).toHaveCSS('margin-top', '16px');
    await expect(navRow).toHaveCSS('margin-bottom', '16px');
    const mobileMargins = await navRow.evaluate((el) => {
      const styles = getComputedStyle(el);
      return { top: parseFloat(styles.marginTop), bottom: parseFloat(styles.marginBottom) };
    });
    expect(mobileMargins.top).toBe(mobileMargins.bottom);
  });

  test('legacy picker uses the shared scale and the primary action treatment', async ({ page }) => {
    await writeDb('features/legacyCalendarPdf/enabled', true);
    await login(page, 'admin');
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Print' }).click();

    await expect(page.getByTestId('calendar-legacy-picker')).toBeVisible();
    await expect(page.locator('.calendar-printer-title')).toBeVisible();
    const year = new Date().getFullYear().toString();
    await expect(page.getByRole('button', { name: year, exact: true })).toBeVisible();

    await expect(page.locator('.calendar-printer-action-btn')).toHaveCSS('background-color', 'rgb(39, 116, 74)');

    const content = page.locator('.mat-mdc-dialog-content');
    await expect(content).toBeVisible();
    const padding = await content.evaluate((el) => {
      const styles = getComputedStyle(el);
      return { top: parseFloat(styles.paddingTop), left: parseFloat(styles.paddingLeft) };
    });
    expect(padding.top).toBeGreaterThanOrEqual(24);
    expect(padding.left).toBeGreaterThanOrEqual(24);
  });

  test('passed-away filter uses plain language, not the old jargon', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    await expect(page.getByRole('checkbox', { name: 'Show relatives who have passed' })).toBeVisible();
    await expect(page.getByText('Include Not Living')).toHaveCount(0);
  });

  test('Print is a labelled control with a print icon', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    const print = page.getByRole('button', { name: 'Print', exact: true });
    await expect(print).toBeEnabled();
    await expect(print.locator('mat-icon')).toHaveText('print');
  });

  test('legacy picker summarises the active filters as they change', async ({ page }) => {
    prefsUid = await adminUid();
    savedCalendarPrefs = prefsUid
      ? await readDb(`users/${prefsUid}/prefs/calendar`)
      : null;
    await writeDb('features/legacyCalendarPdf/enabled', true);
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');

    await page.getByRole('checkbox', { name: 'Birthdays' }).uncheck();
    await page.getByRole('button', { name: 'Print', exact: true }).click();
    await expect(page.locator('.calendar-printer-summary')).toContainText(
      'Including anniversaries.',
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('.calendar-printer-container')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Anniversaries' }).uncheck();
    await page.getByRole('button', { name: 'Print', exact: true }).click();
    await expect(page.locator('.calendar-printer-summary')).toContainText(
      'No event types selected.',
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('.calendar-printer-container')).toHaveCount(0);
  });

  test('birthday, anniversary, and notLiving toggles each change rendered events', async ({ page }) => {
    prefsUid = await adminUid();
    savedCalendarPrefs = prefsUid
      ? await readDb(`users/${prefsUid}/prefs/calendar`)
      : null;
    await login(page, 'admin');

    await page.goto('/calendar?year=2026&month=3');
    const alice = page.locator('.event-birth', { hasText: 'Alice Anderson' });
    await expect(alice.first()).toBeVisible();
    await page.getByRole('checkbox', { name: 'Birthdays' }).uncheck();
    await expect(alice).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Birthdays' }).check();
    await expect(alice.first()).toBeVisible();

    await page.goto('/calendar?year=2026&month=11');
    const anniversary = page.locator('.event-anniv', { hasText: 'Dave Davis' });
    await expect(anniversary.first()).toBeVisible();
    await page.getByRole('checkbox', { name: 'Anniversaries' }).uncheck();
    await expect(anniversary).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Anniversaries' }).check();
    await expect(anniversary.first()).toBeVisible();

    await page.goto('/calendar?year=2026&month=1');
    const edith = page.locator('.event-birth', { hasText: 'Edith Evans' });
    const notLiving = page.getByRole('checkbox', { name: 'Show relatives who have passed' });
    if (await notLiving.isChecked()) await notLiving.uncheck();
    await expect(edith).toHaveCount(0);
    await notLiving.check();
    await expect(edith.first()).toBeVisible();
    await notLiving.uncheck();
    await expect(edith).toHaveCount(0);
  });

  test('warm route with an empty dataset shows the hint, not a stale skeleton', async ({ page }) => {
    prefsUid = await adminUid();
    savedCalendarPrefs = prefsUid
      ? await readDb(`users/${prefsUid}/prefs/calendar`)
      : null;
    const people = await readDb('people');
    try {
      await login(page, 'admin');
      await page.goto('/calendar?year=2026&month=3');
      await expect(page.locator('.event-birth', { hasText: 'Alice Anderson' }).first()).toBeVisible();

      // Holidays are events too; turn them off so an empty people list is truly empty.
      await page.getByRole('checkbox', { name: 'Holidays' }).uncheck();
      await writeDb('people', null);

      await expect(page.getByText("We couldn't find any events.")).toBeVisible();
      await expect(page.locator('.calendar-skeleton')).toHaveCount(0);
      await expect(page.locator('app-calendar-view')).toBeVisible();
    } finally {
      await writeDb('people', people);
    }
  });

  test('mobile month grid advertises that it pans horizontally', async ({ page }) => {
    await login(page, 'admin');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/calendar');
    await expect(page.locator('.calendar-pan-hint')).toBeVisible();
    await expect(page.locator('.calendar-pan-hint')).toContainText('Swipe to see the full month');
  });

  test('holidays show on the calendar and the filter persists across reloads', async ({ page }) => {
    prefsUid = await adminUid();
    savedCalendarPrefs = prefsUid
      ? await readDb(`users/${prefsUid}/prefs/calendar`)
      : null;

    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=12');

    const christmas = page.locator('.event-holiday', { hasText: 'Christmas Day' });
    await expect(christmas.first()).toBeVisible();
    await expect(page.getByTestId('calendar-toggle-holidays')).toBeVisible();

    const holidayCheckbox = page.getByRole('checkbox', { name: 'Holidays' });
    await holidayCheckbox.uncheck();
    await expect(christmas).toHaveCount(0);
    await expect.poll(async () => {
      if (!prefsUid) return true;
      const prefs = await readDb<{ showHolidays?: boolean }>(`users/${prefsUid}/prefs/calendar`);
      return prefs?.showHolidays;
    }).toBe(false);

    await page.reload();
    await expect(page.locator('.calendar-month-label')).toHaveText('December');
    await expect(page.getByRole('checkbox', { name: 'Holidays' })).not.toBeChecked();
    await expect(page.locator('.event-holiday', { hasText: 'Christmas Day' })).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Holidays' }).check();
    await expect(page.locator('.event-holiday', { hasText: 'Christmas Day' }).first()).toBeVisible();
  });

  test('clicking an event opens the person modal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');
    const birthEvent = page.locator('.event-birth', { hasText: 'Alice Anderson' }).first();
    await birthEvent.locator('.event-title-link').click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
  });
});

test.describe('control standard geometry', () => {
  test('Print button is the filled pill variant: 44px tall, radius 999, brand fill', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    const print = page.locator('.calendar-print-button');
    await expect(print).toBeVisible();
    const style = await print.evaluate((el) => {
      const s = getComputedStyle(el);
      return { height: s.height, radius: s.borderRadius, bg: s.backgroundColor, border: s.borderTopWidth };
    });
    expect(style.height).toBe('44px');
    expect(style.radius).toBe('999px');
    expect(style.bg).toBe('rgb(39, 116, 74)');
    expect(style.border).toBe('0px');
  });
});
