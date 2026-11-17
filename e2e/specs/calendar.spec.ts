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

  test('top bar keeps filters on one horizontal row without label overlap', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: 1280, height: 900 });
    try {
      await page.goto('/calendar');
      const filters = page.locator('.calendar-toolbar-filters');
      await expect(filters).toHaveCSS('flex-direction', 'row');

      const gaps = await filters.locator('mat-slide-toggle').evaluateAll((toggles) =>
        toggles.map((toggle) => {
          const track = toggle.querySelector('.mdc-switch__track');
          const label = toggle.querySelector('label');
          if (!track || !label) return null;
          return label.getBoundingClientRect().left - track.getBoundingClientRect().right;
        }));
      expect(gaps).not.toContain(null);
      for (const gap of gaps) {
        expect(gap, `label/track gap ${gaps.join(',')}`).toBeGreaterThanOrEqual(0);
      }

      const handles = await filters.locator('mat-slide-toggle').evaluateAll((toggles) =>
        toggles.map((toggle) => {
          const track = toggle.querySelector('.mdc-switch__track');
          const handle = toggle.querySelector('.mdc-switch__handle');
          if (!track || !handle) return null;
          const t = track.getBoundingClientRect();
          const h = handle.getBoundingClientRect();
          return { track: { left: t.left, right: t.right, top: t.top, bottom: t.bottom },
            handle: { left: h.left, right: h.right, top: h.top, bottom: h.bottom } };
        }));
      expect(handles).not.toContain(null);
      for (const box of handles) {
        expect(box!.handle.right - box!.handle.left, `handle boxes ${JSON.stringify(handles)}`).toBeGreaterThan(0);
        expect(box!.handle.left, `handle left ${JSON.stringify(box)}`).toBeGreaterThanOrEqual(box!.track.left - 1);
        expect(box!.handle.right, `handle right ${JSON.stringify(box)}`).toBeLessThanOrEqual(box!.track.right + 1);
        expect(box!.handle.top, `handle top ${JSON.stringify(box)}`).toBeGreaterThanOrEqual(box!.track.top - 1);
        expect(box!.handle.bottom, `handle bottom ${JSON.stringify(box)}`).toBeLessThanOrEqual(box!.track.bottom + 1);
      }

      const bar = await page.locator('app-page-toolbar .page-toolbar').boundingBox();
      expect(bar).not.toBeNull();
      expect(bar!.height).toBeLessThan(120);
    } finally {
      await page.setViewportSize(original);
    }
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

  test('event tags use the family color and fall back to brand', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');

    // Alice is family-1 #F44336; Nora has no family, so brand applies.
    const alder = page.locator('.event-birth', { hasText: 'Alice Anderson' }).first()
      .locator('.calendar-cell-event-container');
    const noFamily = page.locator('.event-birth', { hasText: 'Nora Nobody' }).first()
      .locator('.calendar-cell-event-container');
    await expect(alder).toBeVisible();
    await expect(noFamily).toBeVisible();
    await expect(alder).toHaveCSS('border-left-color', 'rgb(244, 67, 54)');
    await expect(noFamily).toHaveCSS('border-left-color', 'rgb(39, 116, 74)');

    // A second family proves the accent follows the family, not the event type.
    await page.goto('/calendar?year=2026&month=4');
    const cedar = page.locator('.event-birth', { hasText: 'Ben Brown' }).first()
      .locator('.calendar-cell-event-container');
    await expect(cedar).toBeVisible();
    await expect(cedar).toHaveCSS('border-left-color', 'rgb(33, 150, 243)');

    // Anniversaries resolve the family color through their anchor person too.
    await page.goto('/calendar?year=2026&month=11');
    const anniversary = page.locator('.event-anniv', { hasText: 'Dave Davis' }).first()
      .locator('.calendar-cell-event-container');
    await expect(anniversary).toBeVisible();
    await expect(anniversary).toHaveCSS('border-left-color', 'rgb(244, 67, 54)');

    // Family identity is not colour-only: the tag carries the family name.
    await page.goto('/calendar?year=2026&month=3');
    const alderTag = page.locator('.event-birth', { hasText: 'Alice Anderson' }).first();
    await expect(alderTag.locator('.calendar-cell-event-container')).toHaveAttribute('title', 'Family: Alder');
    await expect(alderTag.locator('.calendar-cell-event-container')).toContainText('Alder');
  });

  test('today marker uses a brand circle and a brand cell wash', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    const today = page.locator('.cal-day-cell.cal-today');
    await expect(today).toBeVisible();
    await expect(today.locator('.cal-day-number')).toHaveCSS('background-color', 'rgb(39, 116, 74)');
    await expect(today.locator('.cal-day-number')).toHaveCSS('color', 'rgb(255, 255, 255)');
    const wash = await today.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(wash).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('wrapped tag labels share one left edge', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');

    const label = page.locator('.event-birth', { hasText: 'Bartholomew' }).first()
      .locator('.event-title-link').first();
    await expect(label).toBeVisible();
    await expect(label).toHaveCSS('text-indent', '0px');

    const lineLefts = await label.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return Array.from(range.getClientRects()).map((rect) => Math.round(rect.left));
    });
    expect(lineLefts.length).toBeGreaterThan(1);
    expect(new Set(lineLefts).size, `wrapped line offsets ${lineLefts.join(',')}`).toBe(1);

    await page.goto('/calendar?year=2026&month=12');
    const holiday = page.locator('.event-holiday', { hasText: 'Christmas Day' }).first()
      .locator('.event-title-holiday');
    await expect(holiday).toBeVisible();
    await expect(holiday).toHaveCSS('text-indent', '0px');
  });

  test('anniversary ampersand row keeps both names on one left edge', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');

    const anniversary = page.locator('.event-anniv', { hasText: 'Alexandria' }).first();
    const primary = anniversary.locator('.event-title-link').first();
    const spouse = anniversary.locator('.event-title-spouse-link').first();
    await expect(primary).toBeVisible();
    await expect(spouse).toBeVisible();
    await expect(primary).toHaveCSS('text-indent', '0px');
    await expect(spouse).toHaveCSS('text-indent', '0px');

    const lefts = await Promise.all([primary, spouse].map((locator) =>
      locator.evaluate((el) => Math.round(el.getBoundingClientRect().left))));
    expect(Math.abs(lefts[0] - lefts[1]), `name offsets ${lefts.join(',')}`).toBeLessThanOrEqual(1);
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

  test('Today returns to the current month from a different year and month', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2024&month=1');

    await expect(page.locator('.calendar-month-label')).toHaveText('January');
    await expect(page.locator('.calendar-year-label')).toHaveText('2024');

    const today = page.locator('.calendar-today-btn');
    await expect(today).toHaveText('Current Month');
    await today.click();

    const now = new Date();
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now);
    await expect(page.locator('.calendar-month-label')).toHaveText(monthName);
    await expect(page.locator('.calendar-year-label')).toHaveText(String(now.getFullYear()));
    await expect(page).toHaveURL(new RegExp(`month=${now.getMonth() + 1}`));
    // Already on the current month now, so the shortcut retires itself.
    await expect(today).toBeHidden();
  });

  test('Today shortcut hides while already on the current month', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    await expect(page.locator('.calendar-today-btn')).toHaveCount(0);
    await page.goto('/calendar?year=2024&month=1');
    await expect(page.locator('.calendar-today-btn')).toBeVisible();
  });

  test('Today sits inline and right-aligned with the month/year tool', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2024&month=1');
    const row = page.locator('.calendar-nav-row');
    const pill = page.locator('.calendar-month-year-pill');
    const today = page.locator('.calendar-today-btn');
    await expect(today).toBeVisible();
    const rowBox = (await row.boundingBox())!;
    const pillBox = (await pill.boundingBox())!;
    const todayBox = (await today.boundingBox())!;
    // Same row: vertical centers line up.
    const pillCenterY = pillBox.y + pillBox.height / 2;
    const todayCenterY = todayBox.y + todayBox.height / 2;
    expect(Math.abs(pillCenterY - todayCenterY)).toBeLessThan(4);
    // Sits to the right of the month/year tool.
    expect(todayBox.x).toBeGreaterThanOrEqual(pillBox.x + pillBox.width);
    // Right-aligned to the row edge.
    expect(Math.abs((todayBox.x + todayBox.width) - (rowBox.x + rowBox.width))).toBeLessThan(2);
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

  test('mobile toolbar collapses filters behind a Filters button and shows the filled Print Calendar action', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await page.goto('/calendar');
      const filters = page.locator('.calendar-toolbar-filters');
      const toggle = page.locator('.calendar-filters-toggle');
      // Collapsed by default: the switches are hidden until the button opens them.
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(filters).toBeHidden();

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(filters).toBeVisible();
      const columns = await filters.evaluate((el) =>
        getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
      expect(columns).toBe(2);

      await expect(page.locator('.calendar-print-button')).toBeHidden();
      const print = page.locator('.calendar-print-button-mobile');
      await expect(print).toBeVisible();
      await expect(print).toHaveText(/Print Calendar/);
      await expect(print).toHaveCSS('background-color', 'rgb(39, 116, 74)');
      const printBox = await print.boundingBox();
      expect(printBox).not.toBeNull();
      expect(printBox!.height).toBeGreaterThanOrEqual(44);
      expect(printBox!.width).toBeGreaterThanOrEqual(200);

      const clips = await filters.locator('mat-slide-toggle').evaluateAll((toggles) =>
        toggles.map((toggle) => toggle.scrollWidth - toggle.clientWidth));
      for (const clip of clips) {
        expect(clip).toBeLessThanOrEqual(1);
      }

      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(pageOverflow).toBeLessThanOrEqual(0);
    } finally {
      await page.setViewportSize(original);
    }
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
    await expect(page.getByRole('switch', { name: 'Show deceased' })).toBeVisible();
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

    await page.getByRole('switch', { name: 'Birthdays' }).click();
    await page.getByRole('button', { name: 'Print', exact: true }).click();
    await expect(page.locator('.calendar-printer-summary')).toContainText(
      'Including anniversaries.',
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('.calendar-printer-container')).toHaveCount(0);

    await page.getByRole('switch', { name: 'Anniversaries' }).click();
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
    await page.getByRole('switch', { name: 'Birthdays' }).click();
    await expect(alice).toHaveCount(0);
    await page.getByRole('switch', { name: 'Birthdays' }).click();
    await expect(alice.first()).toBeVisible();

    await page.goto('/calendar?year=2026&month=11');
    const anniversary = page.locator('.event-anniv', { hasText: 'Dave Davis' });
    await expect(anniversary.first()).toBeVisible();
    await page.getByRole('switch', { name: 'Anniversaries' }).click();
    await expect(anniversary).toHaveCount(0);
    await page.getByRole('switch', { name: 'Anniversaries' }).click();
    await expect(anniversary.first()).toBeVisible();

    await page.goto('/calendar?year=2026&month=1');
    const edith = page.locator('.event-birth', { hasText: 'Edith Evans' });
    const notLiving = page.getByRole('switch', { name: 'Show deceased' });
    if ((await notLiving.getAttribute('aria-checked')) === 'true') await notLiving.click();
    await expect(edith).toHaveCount(0);
    await notLiving.click();
    await expect(edith.first()).toBeVisible();
    await notLiving.click();
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
      await page.getByRole('switch', { name: 'Holidays' }).click();
      await writeDb('people', null);

      await expect(page.getByText("We couldn't find any events.")).toBeVisible();
      await expect(page.locator('.calendar-skeleton')).toHaveCount(0);
      await expect(page.locator('app-calendar-view')).toBeVisible();
    } finally {
      await writeDb('people', people);
    }
  });

  test('mobile month grid shows seven aligned fluid columns without horizontal scroll', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await page.goto('/calendar');
      await expect(page.locator('.cal-days')).toBeVisible();

      const headers = page.locator('.cal-header .cal-cell');
      await expect(headers).toHaveCount(7);
      const cells = page.locator('.cal-days .cal-cell-row').first().locator('.cal-day-cell');
      await expect(cells).toHaveCount(7);

      const headerLefts = await headers.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().left));
      const cellLefts = await cells.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().left));
      for (let i = 0; i < 7; i++) {
        expect(Math.abs(headerLefts[i] - cellLefts[i])).toBeLessThanOrEqual(1);
      }

      const saturday = headers.last();
      await expect(saturday).toBeVisible();
      const satBox = await saturday.boundingBox();
      expect(satBox).not.toBeNull();
      expect(satBox!.x + satBox!.width).toBeLessThanOrEqual(390);
      await expectNoHorizontalOverflow(page.locator('.calendar-scroll-container'));

      // Weekday names shorten to one letter at phone width.
      await expect(page.locator('.cal-header-short').first()).toBeVisible();
      await expect(page.locator('.cal-header-full').first()).toBeHidden();

      // The short glyph is aria-hidden, so every columnheader keeps the full
      // weekday as its accessible name.
      await expect(headers.first()).toHaveAccessibleName('Sunday');
      await expect(headers.last()).toHaveAccessibleName('Saturday');
    } finally {
      await page.setViewportSize(original);
    }
  });

  test('mobile grid hides the desktop chip layer and keeps dots and 64px cells', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await page.goto('/calendar?year=2026&month=3');
      await expect(page.locator('.cal-events-desktop').first()).toBeHidden();
      await expect(page.locator('.day-dot').first()).toBeVisible();

      // Every day cell keeps UI-018's 64px minimum height.
      const cellBox = await page.locator('.cal-days .cal-day-cell').first().boundingBox();
      expect(cellBox!.height).toBeGreaterThanOrEqual(64);
      await expectNoHorizontalOverflow(page.locator('.calendar-scroll-container'));
    } finally {
      await page.setViewportSize(original);
    }
  });

  test('very narrow phone fits seven fluid columns without panning', async ({ page }) => {
    // Supersedes the 44px-column scroll contract: a panned grid hid the
    // Saturday column with no affordance, which is a worse defect than 39px
    // cells. Cells keep the 64px height floor, so the touch box stays large.
    await login(page, 'admin');
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: 320, height: 700 });
    try {
      await page.goto('/calendar?year=2026&month=3');
      const headers = page.locator('.cal-header .cal-cell');
      await expect(headers).toHaveCount(7);
      const widths = await headers.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().width));
      for (const width of widths) expect(width).toBeGreaterThanOrEqual(24);

      // The grid shrinks to the box instead of panning sideways.
      const overflow = await page.locator('.calendar-scroll-container').evaluate(
        (el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      const last = await headers.last().boundingBox();
      const box = await page.locator('.calendar-scroll-container').boundingBox();
      expect(last && box).toBeTruthy();
      expect(last!.x + last!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
    } finally {
      await page.setViewportSize(original);
    }
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

    const holidayCheckbox = page.getByRole('switch', { name: 'Holidays' });
    await holidayCheckbox.click();
    await expect(christmas).toHaveCount(0);
    await expect.poll(async () => {
      if (!prefsUid) return true;
      const prefs = await readDb<{ showHolidays?: boolean }>(`users/${prefsUid}/prefs/calendar`);
      return prefs?.showHolidays;
    }).toBe(false);

    await page.reload();
    await expect(page.locator('.calendar-month-label')).toHaveText('December');
    await expect(page.getByRole('switch', { name: 'Holidays' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.event-holiday', { hasText: 'Christmas Day' })).toHaveCount(0);

    await page.getByRole('switch', { name: 'Holidays' }).click();
    await expect(page.locator('.event-holiday', { hasText: 'Christmas Day' }).first()).toBeVisible();
  });

  test('clicking an event opens the person modal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=3');
    const birthEvent = page.locator('.event-birth', { hasText: 'Alice Anderson' }).first();
    await birthEvent.locator('.event-title-link').click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
  });

  test('overflow and person controls are keyboard operable', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar?year=2026&month=7');

    const more = page.getByRole('button', { name: /\+\d+ more/ }).first();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.press('Space');
    await expect(page.getByRole('button', { name: 'Show less' }).first()).toHaveAttribute('aria-expanded', 'true');

    await page.goto('/calendar?year=2026&month=3');
    const person = page.getByRole('button', { name: 'Alice Anderson' }).first();
    await person.press('Space');
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

test.describe('mobile convergence', () => {
  test('deceased and holidays toggles share a row at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page, 'user');
    await page.goto('/calendar?year=2026&month=11');
    await page.locator('.calendar-filters-toggle').click();
    const deceased = page.locator('mat-slide-toggle.calendar-checkbox', { hasText: 'Deceased' });
    const holidays = page.locator('mat-slide-toggle.calendar-checkbox', { hasText: 'Holidays' });
    await expect(deceased).toBeVisible();
    await expect(holidays).toBeVisible();
    const [deceasedBox, holidaysBox] = await Promise.all([
      deceased.boundingBox(),
      holidays.boundingBox(),
    ]);
    expect(deceasedBox).not.toBeNull();
    expect(holidaysBox).not.toBeNull();
    const deceasedCenter = deceasedBox!.y + deceasedBox!.height / 2;
    const holidaysCenter = holidaysBox!.y + holidaysBox!.height / 2;
    expect(Math.abs(deceasedCenter - holidaysCenter)).toBeLessThanOrEqual(4);
  });
});
