import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, writeDb } from '../helpers/admin-db';

const YEAR = 2026;
const PRINT_URL = `/calendar/print?year=${YEAR}`;

test.describe('calendar print', () => {
  test.afterEach(async () => {
    // The kill switch must be OFF between tests.
    await writeDb('features/legacyCalendarPdf/enabled', false);
  });

  test('1. renders twelve January-first pages', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    const pages = page.getByTestId('calendar-print-page');
    await expect(pages).toHaveCount(12);
    const firstPage = pages.first();
    await expect(firstPage.getByTestId('calendar-print-month-name')).toHaveText('January');
    await expect(firstPage.getByTestId('calendar-print-year-label')).toHaveText(String(YEAR));
    await expect(firstPage.getByTestId('calendar-print-brand')).toHaveText(/^LeCours Family$/i);

    const monthStack = await firstPage
      .getByTestId('calendar-print-month-name')
      .evaluate((n) => getComputedStyle(n).fontFamily);
    expect(monthStack.toLowerCase()).toContain('figtree');
    const yearStack = await firstPage
      .getByTestId('calendar-print-year-label')
      .evaluate((n) => getComputedStyle(n).fontFamily);
    expect(yearStack.toLowerCase()).toContain('figtree');
    const brandStack = await firstPage
      .getByTestId('calendar-print-brand')
      .evaluate((n) => getComputedStyle(n).fontFamily);
    expect(brandStack.toLowerCase()).toContain('figtree');

    // The family stack alone names Figtree even without the asset: prove the
    // @font-face rule exists and its woff2 file is actually served.
    const figtree = await page.evaluate(async () => {
      const faces: string[] = [];
      const walk = (rules: any): void => {
        for (const rule of Array.from(rules) as any[]) {
          if (rule instanceof CSSFontFaceRule) faces.push(rule.style.cssText);
          else if (rule.cssRules) walk(rule.cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try { walk(sheet.cssRules); } catch { /* cross-origin sheet */ }
      }
      const face = faces.find(css => /font-family:\s*['"]?Figtree/i.test(css));
      const src = face?.match(/url\(["']?([^"')]+\.woff2[^"')]*)["']?\)/i)?.[1] ?? '';
      const response = src ? await fetch(src) : null;
      return { hasFace: Boolean(face), src, status: response?.status ?? 0 };
    });
    expect(figtree.hasFace).toBe(true);
    expect(figtree.src).toContain('.woff2');
    expect(figtree.status).toBe(200);

    const brandAndFooter = await firstPage.evaluate((page) => {
      const brand = page.querySelector('.calendar-print-brand');
      const folio = page.querySelector('.calendar-print-folio-text');
      return {
        brand: brand ? parseFloat(getComputedStyle(brand).fontSize) : 0,
        folio: folio ? parseFloat(getComputedStyle(folio).fontSize) : 0,
      };
    });
    // The header family mark is 12pt (16px) and the running foot is 7pt (about 9.3px).
    expect(brandAndFooter.brand).toBeCloseTo(16, 0);
    expect(brandAndFooter.folio).toBeCloseTo(9.3, 0);
    expect(brandAndFooter.brand).toBeGreaterThan(brandAndFooter.folio);
  });

  test('2. one-click Print calls window.print with a temporary title', async ({ page }) => {
    await login(page, 'admin');
    const originalTitle = await page.title();
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');

    await page.evaluate(() => {
      (window as any).__printed = 0;
      (window as any).__printTitle = '';
      window.print = () => {
        (window as any).__printed++;
        (window as any).__printTitle = document.title;
      };
    });

    const button = page.getByTestId('calendar-print-print-button');
    await expect(button).toBeEnabled();
    await button.click();

    await expect.poll(() => page.evaluate(() => (window as any).__printed)).toBe(1);
    expect(await page.evaluate(() => (window as any).__printTitle)).toBe('LeCoursville Family Calendar');
    await expect(page).toHaveTitle(originalTitle);
  });

  test('3. Customize is collapsed on load and expands on click', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    const customize = page.getByTestId('calendar-print-customize');
    await expect(customize).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('calendar-print-year')).toHaveCount(0);

    await customize.click();
    await expect(customize).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('calendar-print-year')).toBeVisible();
  });

  test('4. single-month scope renders one page for the chosen month', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await page.getByTestId('calendar-print-customize').click();
    await page.getByTestId('calendar-print-scope-month').check();
    await page.getByTestId('calendar-print-month').selectOption('5');

    await expect(page.getByTestId('calendar-print-status')).toHaveText('1 page');
    await expect(page.getByTestId('calendar-print-page')).toHaveCount(1);
    const single = page.getByTestId('calendar-print-page');
    await expect(single.getByTestId('calendar-print-month-name')).toHaveText('May');
    await expect(single.getByTestId('calendar-print-year-label')).toHaveText(String(YEAR));
    await expect(single.getByTestId('calendar-print-brand')).toHaveText(/^LeCours Family$/i);
  });

  test('5. year stepper accepts 1900 and 2100 and rejects 2101, empty, and 1800', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await page.getByTestId('calendar-print-customize').click();

    const yearInput = page.getByTestId('calendar-print-year');
    const printButton = page.getByTestId('calendar-print-print-button');
    const error = page.locator('#calendar-print-year-error');
    const firstPageYear = page.getByTestId('calendar-print-page').first()
      .getByTestId('calendar-print-year-label');

    await expect(yearInput).toHaveValue(String(YEAR));
    await page.getByRole('button', { name: 'Next year' }).click();
    await expect(yearInput).toHaveValue(String(YEAR + 1));
    await expect(firstPageYear).toHaveText(String(YEAR + 1));

    await yearInput.fill('2100');
    await expect(error).toHaveCount(0);
    await expect(printButton).toBeEnabled();
    await expect(firstPageYear).toHaveText('2100');

    await page.getByRole('button', { name: 'Next year' }).click();
    await expect(yearInput).toHaveValue('2101');
    await expect(printButton).toBeDisabled();
    await expect(error).toContainText('Enter a year between 1900 and 2100.');

    await yearInput.fill('');
    await expect(printButton).toBeDisabled();
    await expect(error).toContainText('Enter a year between 1900 and 2100.');

    await yearInput.fill('1900');
    await expect(error).toHaveCount(0);
    await expect(printButton).toBeEnabled();
    await expect(firstPageYear).toHaveText('1900');

    await yearInput.fill('1800');
    await expect(printButton).toBeDisabled();
    await expect(error).toContainText('Enter a year between 1900 and 2100.');
    await expect(page).toHaveURL(/\/calendar\/print/);
  });

  test('5a. an out-of-range ?year falls back to a valid year', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar/print?year=1800');
    await page.getByTestId('calendar-print-customize').click();

    const value = Number(await page.getByTestId('calendar-print-year').inputValue());
    expect(value).not.toBe(1800);
    expect(value).toBeGreaterThanOrEqual(1900);
    expect(value).toBeLessThanOrEqual(2100);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    await expect(page.getByTestId('calendar-print-page')).toHaveCount(12);
  });

  test('6. deceased people are absent by default', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    await expect(
      page.getByTestId('calendar-print-entry').filter({ hasText: 'Edith Evans' }),
    ).toHaveCount(0);
  });

  test('7. including deceased shows their lifespan suffixes', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await page.getByTestId('calendar-print-customize').click();
    await page.getByTestId('calendar-print-toggle-deceased').click();

    await expect(
      page.getByTestId('calendar-print-entry').filter({ hasText: 'Edith Evans (1935-2015)' }),
    ).toBeVisible();
    await expect(
      page.getByTestId('calendar-print-entry').filter({ hasText: 'Frank Foster (b. 1940)' }),
    ).toBeVisible();
  });

  test('8. lifespan toggle off renders the deceased with an age and no parenthesis', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await page.getByTestId('calendar-print-customize').click();
    await page.getByTestId('calendar-print-toggle-deceased').click();
    await page.getByTestId('calendar-print-toggle-lifespan').click();

    const edith = page
      .getByTestId('calendar-print-entry')
      .filter({ hasText: `Edith Evans - ${YEAR - 1935}` });
    await expect(edith).toBeVisible();
    await expect(edith).not.toContainText('(');
  });

  test('19. entry tokens are bold, right-aligned numerals with no bracket rules', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    await page.emulateMedia({ media: 'print' });

    const tokens = page.locator('.calendar-print-entry-token');
    await expect(tokens.first()).toBeVisible();
    const measured = await tokens.evaluateAll((elements) =>
      elements.slice(0, 3).map((element) => {
        const computed = getComputedStyle(element);
        const entry = element.closest('.calendar-print-entry') as HTMLElement | null;
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          text: element.textContent ?? '',
          fontWeight: computed.fontWeight,
          beforeContent: getComputedStyle(element, '::before').content,
          afterContent: getComputedStyle(element, '::after').content,
          borderTop: computed.borderTopWidth,
          borderRight: computed.borderRightWidth,
          borderBottom: computed.borderBottomWidth,
          borderLeft: computed.borderLeftWidth,
          entryAlignItems: entry ? getComputedStyle(entry).alignItems : '',
        };
      }),
    );

    expect(measured.length).toBeGreaterThan(0);
    for (const token of measured) {
      // No fill and no grey: black ink on paper only.
      expect(token.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(token.color).toBe('rgb(0, 0, 0)');
      expect(token.text.trim()).toMatch(/^[0-9]/);
      expect(token.fontWeight).toBe('700');
      expect(token.beforeContent).toBe('none');
      expect(token.afterContent).toBe('none');
      for (const width of [token.borderTop, token.borderRight, token.borderBottom, token.borderLeft]) {
        expect(width).toBe('0px');
      }
      // Bottom-aligned boxes put the token baseline on the label's last line.
      expect(token.entryAlignItems).toBe('end');
    }
  });

  test('20. entry tokens share a right edge, a lifespan token stays inside its cell, and roomy pages space rows wider than dense cells', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    await page.emulateMedia({ media: 'print' });

    const denseCell = page.getByTestId('calendar-print-page').nth(6)
      .locator('.calendar-print-cell').filter({ hasText: 'Dense1' }).first();
    const edges = await denseCell.locator('.calendar-print-entry-token').evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().right));
    expect(edges.length).toBeGreaterThan(1);
    for (const right of edges) {
      expect(Math.abs(right - edges[0])).toBeLessThan(1.5);
    }

    await page.emulateMedia({ media: 'screen' });
    await page.getByTestId('calendar-print-customize').click();
    await page.getByTestId('calendar-print-toggle-deceased').click();
    await page.emulateMedia({ media: 'print' });

    const edithCell = page.getByTestId('calendar-print-page').first()
      .locator('.calendar-print-cell').filter({ hasText: 'Edith Evans' }).first();
    const edithTag = edithCell.locator('.calendar-print-entry-token').first();
    await expect(edithTag).toHaveText('1935-2015');
    const cellBox = await edithCell.boundingBox();
    const tagBox = await edithTag.boundingBox();
    expect(cellBox).not.toBeNull();
    expect(tagBox).not.toBeNull();
    expect(tagBox!.x + tagBox!.width).toBeLessThanOrEqual(cellBox!.x + cellBox!.width + 0.5);
    expect(tagBox!.x).toBeGreaterThanOrEqual(cellBox!.x - 0.5);
    const fit = await edithCell.evaluate((element) => ({
      scroll: element.scrollHeight,
      client: element.clientHeight,
    }));
    expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);

    // February is a 4-week page: measure a populated cell, not the empty first cell.
    const frankCell = page.getByTestId('calendar-print-page').nth(1)
      .locator('.calendar-print-cell').filter({ hasText: 'Frank Foster' }).first();
    const frankEntries = frankCell.locator('.calendar-print-entries');
    const roomyGap = await frankEntries
      .evaluate((element) => parseFloat(getComputedStyle(element).rowGap));
    expect(roomyGap).toBeGreaterThan(5);
    const denseGap = await page.getByTestId('calendar-print-page').nth(6)
      .locator('.calendar-print-entries-sm').first()
      .evaluate((element) => parseFloat(getComputedStyle(element).rowGap));
    expect(denseGap).toBeLessThanOrEqual(2);

    const justify = await frankEntries
      .evaluate((element) => getComputedStyle(element).justifyContent);
    expect(justify).toBe('flex-start');

    const frankEntry = frankCell.locator('.calendar-print-entry').first();
    const frankDay = frankCell.locator('.calendar-print-day');
    const entryBox = await frankEntry.boundingBox();
    const dayBox = await frankDay.boundingBox();
    expect(entryBox).not.toBeNull();
    expect(dayBox).not.toBeNull();
    const dateToEntry = entryBox!.y - (dayBox!.y + dayBox!.height);
    expect(dateToEntry).toBeGreaterThan(10);
    expect(dateToEntry).toBeLessThan(24);

    // May has a short two-entry day and a one-entry day, so the gap wins without
    // the long-label dense scale changing the comparison.
    const mayPage = page.getByTestId('calendar-print-page').nth(4);
    const gapTwo = await mayPage.locator('.calendar-print-entries[data-lines="2"]').first()
      .evaluate((element) => parseFloat(getComputedStyle(element).rowGap));
    const gapOne = await mayPage.locator('.calendar-print-entries[data-lines="1"]').first()
      .evaluate((element) => parseFloat(getComputedStyle(element).rowGap));
    expect(gapTwo).toBeGreaterThan(gapOne);

    // Reversal: the label wraps naturally, so no name is bound to another by a non-breaking space.
    const november = page.getByTestId('calendar-print-page').nth(10);
    const couple = november.locator('.calendar-print-entry--anniversary').filter({ hasText: /Carol\s+Clark\s+&\s+Dave\s+Davis/ });
    await expect(couple).toBeVisible();
    const coupleLabel = couple.locator('.calendar-print-entry-label');
    await expect(coupleLabel).toHaveText('Carol Clark & Dave Davis');
    const coupleText = await coupleLabel.textContent();
    expect(coupleText).not.toContain('\u00A0');
    const coupleWrap = await coupleLabel.evaluate((element) => getComputedStyle(element).overflowWrap);
    expect(['anywhere', 'break-word']).toContain(coupleWrap);

    const marchPage = page.getByTestId('calendar-print-page').nth(2);
    const weights = await marchPage.evaluate((element) => {
      const anniversary = element.querySelector('.calendar-print-entry--anniversary');
      const birthday = element.querySelector(
        '.calendar-print-entry:not(.calendar-print-entry--anniversary):not(.calendar-print-entry--holiday)',
      );
      return {
        anniversary: anniversary ? getComputedStyle(anniversary).fontWeight : '',
        birthday: birthday ? getComputedStyle(birthday).fontWeight : '',
      };
    });
    expect(weights.anniversary).not.toBe('');
    expect(weights.birthday).not.toBe('');
    expect(weights.anniversary).toBe(weights.birthday);
  });

  test('22. long anniversary and single names wrap without clipping', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await page.getByTestId('calendar-print-customize').click();
    await page.getByTestId('calendar-print-scope-month').check();
    await page.getByTestId('calendar-print-month').selectOption('3');
    await expect(page.getByTestId('calendar-print-status')).toHaveText('1 page');
    await page.emulateMedia({ media: 'print' });

    const march = page.getByTestId('calendar-print-page');
    await expect(
      march.getByTestId('calendar-print-entry').filter({ hasText: /Alexandria Montgomery & Bartholomew/ }),
    ).toBeVisible();
    await expect(
      march.getByTestId('calendar-print-entry').filter({ hasText: /Clementine\s*&\s*Thaddeus\s+Featherstonehaugh/ }),
    ).toBeVisible();
    // A shared surname is free to wrap below the two first names instead of being bound to the second first name.
    const sharedLabel = march.getByTestId('calendar-print-entry')
      .filter({ hasText: /Clementine\s*&\s*Thaddeus\s+Featherstonehaugh/ })
      .locator('.calendar-print-entry-label');
    await expect(sharedLabel).toHaveText('Clementine & Thaddeus Featherstonehaugh');
    expect(await sharedLabel.textContent()).not.toContain('\u00A0');
    await expect(
      march.getByTestId('calendar-print-entry').filter({ hasText: /Maximiliana Wolfeschlegelsteinhausenbergerdorff/ }),
    ).toBeVisible();

    const cells = await march.locator('.calendar-print-cell').evaluateAll((elements) =>
      elements.map((cell) => ({
        scrollWidth: cell.scrollWidth,
        clientWidth: cell.clientWidth,
      })),
    );
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth + 1);
    }

    const wraps = await march.locator('.calendar-print-entry-label').evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).overflowWrap),
    );
    expect(wraps.length).toBeGreaterThan(0);
    for (const wrap of wraps) {
      expect(['anywhere', 'break-word']).toContain(wrap);
    }
  });

  test('22a. unknown birth years are skipped and a shared-surname couple prints once', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');

    await expect(
      page.getByTestId('calendar-print-entry').filter({ hasText: 'Greta Gonzalez' }),
    ).toHaveCount(0);
    const couple = page
      .getByTestId('calendar-print-entry')
      .filter({ hasText: /Grace\s*&\s*Henry\s+Grant/ });
    await expect(couple).toBeVisible();
    await expect(couple).toHaveCount(1);
  });

  test('21. the printed page stays black on white in dark theme', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    await page.evaluate(() => sessionStorage.setItem('lecoursville.theme.session', 'dark'));
    await page.reload();
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    await page.emulateMedia({ media: 'print' });

    const firstPage = page.getByTestId('calendar-print-page').first();
    expect(await firstPage.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe('rgb(255, 255, 255)');
    const token = page.locator('.calendar-print-entry-token').first();
    await expect(token).toBeVisible();
    expect(await token.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(0, 0, 0)');
  });

  test('9. birthday and anniversary toggles remove their entries', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    await page.getByTestId('calendar-print-customize').click();

    const alice = page.getByTestId('calendar-print-entry').filter({ hasText: 'Alice Anderson' });
    await expect(alice).toBeVisible();
    await page.getByTestId('calendar-print-toggle-birthdays').click();
    await expect(alice).toHaveCount(0);

    const couple = page
      .getByTestId('calendar-print-entry')
      .filter({ hasText: 'Carol Clark & Dave Davis' });
    await expect(couple).toBeVisible();
    await page.getByTestId('calendar-print-toggle-anniversaries').click();
    await expect(couple).toHaveCount(0);
  });

  test('10. each page fits its landscape letter sheet in print media', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');
    await page.emulateMedia({ media: 'print' });

    const measurements = await page.getByTestId('calendar-print-page').evaluateAll((elements) =>
      elements.map((element) => {
        const styles = getComputedStyle(element);
        return {
          fits: element.scrollHeight <= element.clientHeight,
          width: styles.width,
          height: styles.height,
        };
      }),
    );

    expect(measurements).toHaveLength(12);
    for (const measurement of measurements) {
      expect(measurement.fits).toBe(true);
      expect(measurement.width).toBe('1056px');
      expect(measurement.height).toBe('816px');
    }

    const cellFits = await page.getByTestId('calendar-print-page').evaluateAll((pages) =>
      pages.flatMap((page) =>
        Array.from(page.querySelectorAll('.calendar-print-cell')).map((cell) => ({
          fits: cell.scrollHeight <= cell.clientHeight + 1,
          horizontallyFits: cell.scrollWidth <= cell.clientWidth + 1,
        })),
      ),
    );
    expect(cellFits.length).toBeGreaterThan(0);
    for (const cell of cellFits) {
      expect(cell.fits).toBe(true);
      expect(cell.horizontallyFits).toBe(true);
    }

    // The toolbar and controls are screen chrome, never printed.
    const printChrome = await page.evaluate(() => ({
      toolbar: getComputedStyle(document.querySelector('app-page-toolbar')!).display,
      controls: getComputedStyle(document.querySelector('.calendar-print-controls')!).display,
    }));
    expect(printChrome.toolbar).toBe('none');
    expect(printChrome.controls).toBe('none');

    // The named calendar page owns a landscape letter sheet.
    const pageRule = await page.evaluate(() => {
      const rules: string[] = [];
      const walk = (list: any): void => {
        for (const rule of Array.from(list) as any[]) {
          if (rule.cssText.includes('@page calendar')) rules.push(rule.cssText);
          if (rule.cssRules) walk(rule.cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try { walk(sheet.cssRules); } catch { /* cross-origin sheet */ }
      }
      return rules.join('\n');
    });
    expect(pageRule).toMatch(/@page\s+calendar/);
    expect(pageRule).toMatch(/size:\s*letter\s+landscape/);
  });

  test('11. a full year proves twelve pages in every browser and twelve PDF pages in Chromium', async ({ page, browserName }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');

    const pages = page.getByTestId('calendar-print-page');
    await expect(pages).toHaveCount(12);
    await expect(pages.first().getByTestId('calendar-print-month-name')).toHaveText('January');
    await expect(pages.last().getByTestId('calendar-print-month-name')).toHaveText('December');
    const yearLabels = await pages.getByTestId('calendar-print-year-label').evaluateAll(
      elements => elements.map(element => element.textContent?.trim()),
    );
    expect(yearLabels).toEqual(Array(12).fill(String(YEAR)));

    if (browserName === 'chromium') {
      const pdf = await page.pdf({ preferCSSPageSize: true });
      const counts = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/g)]
        .map(match => Number(match[1]));
      expect(Math.max(...counts, 0)).toBe(12);
    }
  });

  test('12. a dense day truncates to seven entries plus a more line', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');

    await expect(page.getByTestId('calendar-print-overflow-warning')).toContainText(
      '4 entries did not fit on July 4',
    );
    const july = page.getByTestId('calendar-print-page').nth(6);
    await expect(july.getByTestId('calendar-print-month-name')).toHaveText('July');
    await expect(july.getByTestId('calendar-print-year-label')).toHaveText(String(YEAR));
    await expect(july.getByTestId('calendar-print-brand')).toHaveText(/^LeCours Family$/i);
    await expect(july.getByTestId('calendar-print-entry')).toHaveCount(7);
    const more = july.locator('.calendar-print-more');
    await expect(more).toHaveText('+4 more');

    await page.emulateMedia({ media: 'print' });
    const moreBox = await more.boundingBox();
    const cellBox = await more.locator('xpath=ancestor::div[contains(@class, "calendar-print-cell")]').boundingBox();
    expect(moreBox).not.toBeNull();
    expect(cellBox).not.toBeNull();
    expect(moreBox!.y + moreBox!.height).toBeLessThanOrEqual(cellBox!.y + cellBox!.height);
  });

  test('18. every page renders only the weeks the month spans, with no trailing empty week', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await expect(page.getByTestId('calendar-print-status')).toHaveText('12 pages');

    const measurements = await page.getByTestId('calendar-print-page').evaluateAll((elements) =>
      elements.map((element) => {
        const cells = Array.from(element.querySelectorAll('.calendar-print-cell'));
        const lastWeek = cells.slice(-7);
        return {
          cellCount: cells.length,
          lastWeekHasDay: lastWeek.some((cell) => cell.querySelector('.calendar-print-day') !== null),
        };
      }),
    );

    expect(measurements).toHaveLength(12);
    for (const measurement of measurements) {
      expect(measurement.cellCount % 7).toBe(0);
      expect(measurement.cellCount).toBeGreaterThanOrEqual(28);
      expect(measurement.cellCount).toBeLessThanOrEqual(42);
      expect(measurement.lastWeekHasDay).toBe(true);
    }
  });

  test('17. December 2026 renders Christmas Day italic and the holiday toggle removes it', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(PRINT_URL);
    await page.getByTestId('calendar-print-customize').click();
    await page.getByTestId('calendar-print-year').fill('2026');
    await page.getByTestId('calendar-print-scope-month').check();
    await page.getByTestId('calendar-print-month').selectOption('12');

    const december = page.getByTestId('calendar-print-page');
    await expect(december.getByTestId('calendar-print-month-name')).toHaveText('December');
    const christmas = december
      .locator('.calendar-print-entry--holiday')
      .filter({ hasText: 'Christmas Day' });
    await expect(christmas).toHaveCount(1);
    await expect(christmas).toHaveCSS('font-style', 'italic');
    await expect(december.getByText('LECOURSVILLE.COM')).toBeVisible();

    const holidays = page.getByRole('checkbox', { name: 'Holidays' });
    await holidays.uncheck();
    await expect(christmas).toHaveCount(0);
  });

  test('13. disabling the calendar flag sends the print route to feature-disabled', async ({ page }) => {
    const original = await readDb<boolean>('features/calendar/enabled');
    await login(page, 'admin');
    try {
      await writeDb('features/calendar/enabled', false);
      await page.goto('/calendar/print');
      await expect(page).toHaveURL(/\/feature-disabled/);
    } finally {
      await writeDb('features/calendar/enabled', original ?? true);
    }
  });

  test('14. flag OFF routes Print to the generated calendar and hides Calendars', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    const print = page.locator('.calendar-print-button');
    await expect(print).toBeEnabled();
    await print.click();

    await expect(page).toHaveURL(/\/calendar\/print/);
    await expect(page.getByTestId('calendar-print-page').first()).toBeVisible();
    await expect(page.getByTestId('calendar-legacy-picker')).toHaveCount(0);

    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-link-people')).toBeAttached();
    await expect(page.getByTestId('admin-nav-link-calendars')).toHaveCount(0);

    await page.goto('/admin/calendars');
    await expect(page.locator('app-admin-calendars')).toBeVisible();
  });

  test('15. flag ON opens the legacy picker and redirects the print route', async ({ page }) => {
    await writeDb('features/legacyCalendarPdf/enabled', true);
    await login(page, 'admin');
    await page.goto('/calendar');
    const print = page.locator('.calendar-print-button');
    await expect(print).toBeEnabled();
    await print.click();

    await expect(page.getByTestId('calendar-legacy-picker')).toBeVisible();
    await expect(page).toHaveURL(/\/calendar(\?|$)/);

    await page.goto('/calendar/print');
    await expect(page).toHaveURL(/\/calendar(\?|$)/);
  });

  test('16. flag ON lists Calendars again in the admin sidebar', async ({ page }) => {
    await writeDb('features/legacyCalendarPdf/enabled', true);
    await login(page, 'admin');
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-link-calendars')).toBeVisible();
  });
});
