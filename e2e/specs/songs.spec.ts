import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';
import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';

const TITLES = ['Amazing Grace', 'Blessed Be the Name', 'Come Thou Fount', 'Noël'];

/**
 * Inflate every FlateDecode stream in a PDF and concatenate its operators, so
 * a test can assert what the renderer actually painted (colors, fills).
 */
function pdfContent(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const chunks: string[] = [];
  let index = 0;
  while (true) {
    const start = raw.indexOf('stream', index);
    if (start === -1) break;
    const bodyStart = raw.indexOf('\n', start) + 1;
    const end = raw.indexOf('endstream', bodyStart);
    if (end === -1) break;
    try {
      chunks.push(zlib.inflateSync(Buffer.from(raw.slice(bodyStart, end), 'latin1')).toString('latin1'));
    } catch {
      // Not a Flate stream (XObject/image/font payload): nothing to inspect.
    }
    index = end + 'endstream'.length;
  }
  return chunks.join('\n');
}

function cards(page) {
  return page.getByTestId('song-card');
}

function titles(page) {
  return page.getByTestId('song-title');
}

// What the inline and chord-over views display: bracket chords lose brackets.
function chordFree(body: string): string {
  return body.replace(/[\[\]]/g, '');
}

async function openSong(page, id: string) {
  await page.goto(`/songs/${id}`);
  await expect(page.getByTestId('song-body')).toBeVisible();
}

// WebKit reports computed lengths with subpixel drift, so compare numerically.
async function expectCssNumber(locator, prop: string, expected: number, precision = 1) {
  const actual = await locator.evaluate(
    (el: Element, p: string) => Number.parseFloat(getComputedStyle(el).getPropertyValue(p)),
    prop,
  );
  expect(actual).toBeCloseTo(expected, precision);
}

// Vertical distance between the search magnifier's center and the input text
// line's center. The icon is a `matTextPrefix`, which rode ~6px above the
// value once the field was filled.
async function searchIconCenterDelta(page, testId: string): Promise<number> {
  return page.evaluate((id) => {
    const input = document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    const icon = input
      .closest('mat-form-field')!
      .querySelector('.mat-mdc-form-field-text-prefix mat-icon')!;
    const inputBox = input.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    return Math.abs(
      inputBox.top + inputBox.height / 2 - (iconBox.top + iconBox.height / 2),
    );
  }, testId);
}

test.describe('songs', () => {
  test.describe('member', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user');
  });

  test('1. lists the four seeded songs sorted by title', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);
    expect(await titles(page).allTextContents()).toEqual(TITLES);

    // One mobile-visible main landmark and a real h2 per card, so heading
    // navigation lands on each title while the anchor keeps its testid.
    await expect(page.getByRole('main')).toHaveCount(1);
    const first = cards(page).first();
    await expect(first.getByRole('heading', { level: 2, name: 'Amazing Grace' })).toBeVisible();
    await expect(first.getByTestId('song-title')).toHaveAttribute('href', '/songs/song-a');
  });

  test('2. search by title narrows to the matching song', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);
    await page.getByTestId('song-search').fill('Amazing');
    await expect(cards(page)).toHaveCount(1);
    await expect(titles(page)).toHaveText(['Amazing Grace']);
  });

  test('3. search by a lyric substring narrows to that song', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);
    await page.getByTestId('song-search').fill('wretch like me');
    await expect(cards(page)).toHaveCount(1);
    await expect(titles(page)).toHaveText(['Amazing Grace']);
  });

  test('4. accented search finds Noël without the accent', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);
    await page.getByTestId('song-search').fill('noel');
    await expect(cards(page)).toHaveCount(1);
    await expect(titles(page)).toHaveText(['Noël']);
  });

  test('5. clearing the search restores the full list and refocuses the field', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);
    await page.getByTestId('song-search').fill('Amazing');
    await expect(cards(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByTestId('song-search')).toHaveValue('');
    await expect(page.getByTestId('song-search')).toBeFocused();
    await expect(cards(page)).toHaveCount(4);
  });

  test('5b. the search icon stays on the input text line empty and filled', async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/songs');
      await expect(cards(page)).toHaveCount(4);
      expect(await searchIconCenterDelta(page, 'song-search')).toBeLessThanOrEqual(2);

      await page.getByTestId('song-search').fill('Amazing');
      await expect(cards(page)).toHaveCount(1);
      await page.getByTestId('song-search').blur();
      // The filled field is where the floating label and the value exposed the
      // icon riding high.
      expect(await searchIconCenterDelta(page, 'song-search')).toBeLessThanOrEqual(2);
    }
  });

  test('6. a no-match search shows the no-results message with the query', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);
    await page.getByTestId('song-search').fill('zzz-no-match');
    await expect(cards(page)).toHaveCount(0);
    const noResults = page.locator('.no-results-message');
    await expect(noResults.locator('.no-results-title')).toHaveText('No results');
    await expect(noResults).toContainText('zzz-no-match');

    // The state is vertically centered in the content area on roomy screens.
    const centered = await page.locator('.songs-empty-region').evaluate(el => {
      const region = el.getBoundingClientRect();
      const message = el.querySelector('.no-results-message')!.getBoundingClientRect();
      return {
        minHeight: Number.parseFloat(getComputedStyle(el).minHeight),
        centerDelta: Math.abs(
          message.top + message.height / 2 - (region.top + region.height / 2),
        ),
      };
    });
    expect(centered.minHeight).toBeGreaterThan(300);
    expect(centered.centerDelta).toBeLessThan(2);
  });

  test('6b. a non-admin empty library greets the viewer without an admin CTA', async ({ page }) => {
    const original = await readDb<Record<string, any>>('songs');
    try {
      await deleteDb('songs');
      await page.goto('/songs');
      const empty = page.getByTestId('songs-empty');
      await expect(empty).toContainText('No songs yet');
      await expect(empty).toContainText("Once songs are added, they'll show up here.");
      await expect(empty.getByRole('link')).toHaveCount(0);

      // Room-sized empty state fills and centers in the content area.
      const layout = await empty.evaluate(el => ({
        minHeight: Number.parseFloat(getComputedStyle(el).minHeight),
        justify: getComputedStyle(el).justifyContent,
      }));
      expect(layout.minHeight).toBeGreaterThan(300);
      expect(layout.justify).toBe('center');

      // The medallion is tinted brand, so it separates from the page ground.
      const medallion = await page.locator('.songs-empty-icon').evaluate(el => ({
        background: getComputedStyle(el).backgroundColor,
        border: Number.parseFloat(getComputedStyle(el).borderTopWidth),
        ground: getComputedStyle(document.body).backgroundColor,
      }));
      expect(medallion.background).not.toBe(medallion.ground);
      expect(medallion.background).not.toBe('rgba(0, 0, 0, 0)');
      expect(medallion.border).toBeCloseTo(1, 1);
    } finally {
      await writeDb('songs', original);
    }
  });

  test('6c. an unknown song id shows the not-found copy without a retry action', async ({ page }) => {
    await page.goto('/songs/e2e-missing-song');
    const alert = page.locator('app-load-error');
    await expect(alert).toContainText(
      "This song couldn't be found. It may have been removed. Head back to the songs list to find another.",
    );
    await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  });

  test('7. cards show leader chips and the detail adds last names', async ({ page }) => {
    await page.goto('/songs');
    const card = cards(page).filter({ hasText: 'Amazing Grace' });
    await expect(card.getByTestId('leader-chip')).toHaveText(['Alice', 'Ben']);
    await expect(card.getByRole('group', { name: 'Leaders' })).toBeVisible();
    await expect(card.getByTestId('leader-chip').first()).toHaveAttribute('aria-label', 'Leader: Alice Anderson');

    await card.getByTestId('song-title').click();
    await expect(page).toHaveURL(/\/songs\/song-a/);
    await expect(page.getByTestId('leader-chip')).toHaveText(['Alice Anderson', 'Ben Brown']);
  });

  test('8. a leader chip opens that person in People', async ({ page }) => {
    await openSong(page, 'song-a');
    await page.getByTestId('leader-chip').filter({ hasText: 'Alice' }).click();
    await expect(page).toHaveURL(/\/people\?selected=person-a/);
  });

  test('9. the no-leader song renders no leader chips on card or detail', async ({ page }) => {
    await page.goto('/songs');
    const card = cards(page).filter({ hasText: 'Come Thou Fount' });
    await expect(card.getByTestId('leader-chip')).toHaveCount(0);

    await openSong(page, 'song-c');
    await expect(page.getByTestId('leader-chip')).toHaveCount(0);
    await expect(page.getByTestId('song-leaders')).toHaveCount(0);
    // The member detail page exposes exactly one main landmark.
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('main')).toContainText('Come Thou Fount');
  });

  test('9b. the detail labels its leaders "Led by" and prints them as one line', async ({ page }) => {
    await openSong(page, 'song-a');
    const leaders = page.getByTestId('song-leaders');
    await expect(leaders.locator('.song-leaders-label')).toHaveText('Led by');
    await expect(leaders.getByTestId('leader-chip')).toHaveText(['Alice Anderson', 'Ben Brown']);

    await page.emulateMedia({ media: 'print' });
    const print = await leaders.evaluate(el => {
      const label = el.querySelector('.song-leaders-label') as HTMLElement;
      const chips = Array.from(
        el.querySelectorAll('[data-testid="leader-chip"]'),
      ) as HTMLElement[];
      return {
        label: label.textContent,
        spaced: label.getBoundingClientRect().right <= chips[0].getBoundingClientRect().left,
        border: getComputedStyle(chips[0]).borderTopWidth,
        comma: getComputedStyle(chips[0], '::after').content,
      };
    });
    expect(print.label).toBe('Led by');
    expect(print.spaced).toBe(true);
    expect(print.border).toBe('0px');
    expect(print.comma).toContain(',');
  });

  test('9c. at 320px leader chips wrap in a column under the label', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await openSong(page, 'song-a');
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect();
      return {
        sheetLeft: rect('.song-sheet').left,
        label: rect('.song-leaders-label'),
        chips: rect('.song-leaders-chips'),
        firstChip: rect('[data-testid="leader-chip"]'),
      };
    });
    // The chips column starts after the label, indented from the card edge, and
    // a wrapped continuation shares the first chip's left edge.
    expect(geometry.label.right).toBeLessThanOrEqual(geometry.chips.left);
    expect(geometry.chips.left).toBeGreaterThan(geometry.sheetLeft + 50);
    expect(Math.abs(geometry.chips.left - geometry.firstChip.left)).toBeLessThanOrEqual(0.5);
    await expect(page.locator('.song-leaders-chips')).toHaveCSS('flex-wrap', 'wrap');
    // "Led by" pins to the first chip row instead of floating between rows.
    await expect(page.locator('.song-leaders')).toHaveCSS('align-items', 'flex-start');
    expect(Math.abs(geometry.label.top - geometry.firstChip.top)).toBeLessThanOrEqual(1);
  });

  test('9d. an unresolved leader prints "Unknown" with the card\'s not-found label', async ({ page }) => {
    const id = `e2e-orphan-${Date.now()}`;
    await writeDb(`songs/${id}`, {
      id,
      title: 'E2E Orphan Leader',
      body: 'A lyric line without a known leader',
      source: null,
      musicalKey: null,
      leaderIds: ['missing-person'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    try {
      await openSong(page, id);
      const chip = page.getByTestId('leader-chip');
      await expect(chip).toHaveText('Unknown');
      await expect(chip).toHaveAttribute('aria-label', 'Leader not found');
    } finally {
      await deleteDb(`songs/${id}`);
    }
  });

  test('10. the detail body is monospace and preserves stored newlines', async ({ page }) => {
    const stored = (await readDb<Record<string, any>>('songs/song-a'))!;
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSong(page, 'song-a');
    const inline = page.getByTestId('song-body-inline');
    const chordOver = page.getByTestId('song-body-chord-over');

    // Desktop derives the chord-over view and hides the inline brackets.
    await expect(chordOver).toBeVisible();
    await expect(inline).toBeHidden();
    const fontFamily = await inline.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/monospace/i);
    // Segmented spans preserve the body except for chord brackets, which are
    // display-only; the stored body keeps them.
    expect(await inline.textContent()).toBe(chordFree(stored.body));
    await expect(inline.locator('.chord').first()).toHaveText('G');
    expect(await inline.textContent()).not.toContain('[G]');
    expect(stored.body).toContain('[G]');

    // The chord line sits above its lyric and never carries brackets.
    await expect(chordOver.locator('.chord-line').first()).toHaveText('G');
    const lines = (await chordOver.textContent())!.split('\n');
    expect(lines[0]).toBe('G');
    expect(lines[1]).toBe('Amazing grace how sweet the sound');
    expect(lines.join('\n')).not.toMatch(/[[\]]/);

    // Phones keep the inline bracket view.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(inline).toBeVisible();
    await expect(chordOver).toBeHidden();
  });

  test('10b. the body scales to 1.2rem on desktop and 0.95rem on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSong(page, 'song-a');
    const body = page.getByTestId('song-body-inline');
    await expectCssNumber(body, 'font-size', 19.2, 0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectCssNumber(body, 'font-size', 15.2, 0);
    // The 72ch measure still applies; no width regression from the scale bump.
    const measure = await body.evaluate(el => parseFloat(getComputedStyle(el).maxWidth));
    expect(measure).toBeGreaterThan(500);
  });

  test('10c. the preview skips a leading chord-only line and cards stretch to a row', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);

    const blessed = cards(page).filter({ hasText: 'Blessed Be the Name' });
    const lines = (await blessed.locator('.song-excerpt').textContent())!.trim().split('\n');
    expect(lines[0]).toBe('Blessed be the name of the Lord');
    // Every chord-only line is filtered from the pool, not just a leading one:
    // the second preview line is the next lyric, not the "A          E" run.
    expect(lines[1]).toBe('Blessed be the name of the Lord');
    expect(lines).toHaveLength(2);

    const grid = await page.locator('.songs-grid').evaluate(el => getComputedStyle(el).alignItems);
    expect(grid).toBe('stretch');

    const heights = await cards(page).evaluateAll(els =>
      els.slice(0, 3).map(el => Math.round(el.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size).toBe(1);
  });

  test('11. + transposes G to G# and shows the +1 badge', async ({ page }) => {
    const inline = page.getByTestId('song-body-inline');
    await openSong(page, 'song-a');
    await expect(page.locator('.transpose-label')).toHaveText('Transpose');
    await expect(inline.locator('.chord').first()).toHaveText('G');
    await expect(inline).not.toContainText('[G]');
    await page.getByTestId('transpose-up').click();
    await expect(inline.locator('.chord').first()).toHaveText('G#');
    await expect(inline).toContainText('Amazing grace');
    await expect(inline).not.toContainText('[G#]');
    await expect(page.getByTestId('song-body-chord-over').locator('.chord-tag').first()).toHaveText('G#');
    await expect(page.getByTestId('song-body-chord-over').locator('.chord-line').first()).toHaveText('G#');
    await expect(page.getByTestId('song-body-chord-over')).not.toContainText('[');
    await expect(page.getByTestId('song-body-chord-over')).not.toContainText(']');
    await expect(page.getByTestId('transpose-offset')).toHaveText('+1');
    await expect(page.getByTestId('song-key')).toHaveText('Key: G → G#');
    // The visible badge stays "+1"; the live region carries the sentence.
    const live = page.getByTestId('transpose-announcement');
    await expect(live).toHaveAttribute('role', 'status');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveText('Transposed up 1 semitone; key G → G#');
    // The M3 state layer is square inside the pill, so no ink spills over the
    // "+1" divider or the right cap after the click.
    const stateLayer = page
      .getByTestId('transpose-up')
      .locator('.mat-mdc-button-persistent-ripple');
    await expect(stateLayer).toHaveCSS('border-radius', '0px');
    await expect(page.getByTestId('transpose-up')).toHaveCSS('border-radius', '0px');

    // The state layer tints instead of flashing a hard gray fill.
    const layerOpacity = await page.getByTestId('transpose-up').evaluate(el => {
      const style = getComputedStyle(el);
      return {
        hover: Number(style.getPropertyValue('--mat-icon-button-hover-state-layer-opacity')),
        focus: Number(style.getPropertyValue('--mat-icon-button-focus-state-layer-opacity')),
      };
    });
    expect(layerOpacity).toEqual({ hover: 0.06, focus: 0.06 });
  });

  test('12. a flat-root bracket plus two renders C', async ({ page }) => {
    await openSong(page, 'song-a');
    await page.getByTestId('transpose-up').click();
    await page.getByTestId('transpose-up').click();
    await expect(page.getByTestId('song-body-inline')).toContainText('I once was lost');
    await expect(page.getByTestId('song-body-inline').locator('.chord').nth(1)).toHaveText('C');
    await expect(page.getByTestId('song-body-inline')).not.toContainText('[C]');
    await expect(page.getByTestId('song-body-chord-over')).toContainText('C');
    await expect(page.getByTestId('song-body-chord-over')).not.toContainText('[');
    await expect(page.getByTestId('transpose-offset')).toHaveText('+2');
    await expect(page.getByTestId('transpose-announcement')).toHaveText(
      'Transposed up 2 semitones; key G → A',
    );
  });

  test('13. Reset restores the stored body and empties the badge', async ({ page }) => {
    const stored = (await readDb<Record<string, any>>('songs/song-a'))!;
    await openSong(page, 'song-a');
    await page.getByTestId('transpose-up').click();
    await page.getByTestId('transpose-up').click();
    await page.getByTestId('transpose-reset').click();
    await expect(page.getByTestId('transpose-offset')).toHaveCount(1);
    await expect(page.getByTestId('transpose-offset')).toHaveText('');
    await expect(page.getByTestId('song-key')).toHaveText('Key: G');
    await expect(page.getByTestId('transpose-announcement')).toHaveText('Transpose reset; key G');
    expect(await page.getByTestId('song-body-inline').textContent()).toBe(chordFree(stored.body));

    // Down spells flats, and the announcement names the direction and keys.
    await page.getByTestId('transpose-down').click();
    await expect(page.getByTestId('transpose-offset')).toHaveText('-1');
    await expect(page.getByTestId('transpose-announcement')).toHaveText(
      'Transposed down 1 semitone; key G → Gb',
    );
  });

  test('14. the chord-over-line song renders no transpose controls', async ({ page }) => {
    const stored = (await readDb<Record<string, any>>('songs/song-b'))!;
    await openSong(page, 'song-b');
    await expect(page.getByTestId('transpose-controls')).toHaveCount(0);
    // Bare chord-over input renders verbatim: chord lines stay above lyrics.
    const chordOver = page.getByTestId('song-body-chord-over');
    await expect(chordOver.locator('.chord-line').first()).toHaveText('A          D');
    await expect(chordOver.locator('.chord-line').first()).toBeVisible();
    await expect(chordOver).not.toContainText('[');
    await expect(chordOver).not.toContainText(']');
    // The inline view keeps the stored bytes, braces and all.
    expect(await page.getByTestId('song-body-inline').textContent()).toBe(stored.body);
  });

  test('15. a reload shows the untransposed stored body', async ({ page }) => {
    const stored = (await readDb<Record<string, any>>('songs/song-a'))!;
    const inline = page.getByTestId('song-body-inline');
    await openSong(page, 'song-a');
    await page.getByTestId('transpose-up').click();
    await expect(inline.locator('.chord').first()).toHaveText('G#');

    await page.reload();
    await expect(page.getByTestId('song-body-inline')).toBeAttached();
    expect(await inline.textContent()).toBe(chordFree(stored.body));
    await expect(inline.locator('.chord').first()).toHaveText('G');
    await expect(inline).not.toContainText('[G#]');
    await expect(page.getByTestId('song-body-chord-over').locator('.chord-line').first()).toHaveText('G');
    await expect(page.getByTestId('song-body-chord-over')).not.toContainText('[');
    await expect(page.getByTestId('transpose-offset')).toHaveText('');
  });

  test('15b. chord tags are faint gray tags with a fill on desktop and mobile', async ({ page }) => {
    const tagStyle = (locator) => locator.evaluate(el => {
      const probe = document.createElement('span');
      probe.style.background = 'var(--color-surface-muted)';
      document.body.appendChild(probe);
      const muted = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, muted, color: style.color };
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await openSong(page, 'song-a');
    const desktopTag = page.getByTestId('song-body-chord-over').locator('.chord-tag').first();
    await expect(desktopTag).toHaveText('G');
    const desktop = await tagStyle(desktopTag);
    expect(desktop.background).toBe(desktop.muted);
    expect(desktop.background).not.toBe('rgba(0, 0, 0, 0)');

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileTag = page.getByTestId('song-body-inline').locator('.chord').first();
    await expect(mobileTag).toHaveText('G');
    const mobile = await tagStyle(mobileTag);
    expect(mobile.background).toBe(mobile.muted);
    expect(mobile.background).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('15c. the lyrics-only toggle hides chords for bracket and chord-over songs', async ({ page }) => {
    await openSong(page, 'song-a');
    const toggle = page.getByTestId('toggle-chords');
    await expect(toggle).toHaveText(/Lyrics only/);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveText(/Show chords/);
    await expect(page.getByTestId('transpose-controls')).toHaveCount(0);
    const lyrics = page.getByTestId('song-body-lyrics');
    await expect(lyrics).toBeVisible();
    await expect(lyrics).toContainText('Amazing grace how sweet the sound');
    await expect(lyrics).not.toContainText('[G]');
    await expect(page.locator('.chord, .chord-tag')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('transpose-controls')).toHaveCount(1);
    await expect(page.getByTestId('song-body-inline')).toBeAttached();

    await openSong(page, 'song-b');
    await page.getByTestId('toggle-chords').click();
    expect(await page.getByTestId('song-body-lyrics').textContent()).toBe(
      'Blessed be the name of the Lord\nBlessed be the name of the Lord',
    );
    await page.getByTestId('toggle-chords').click();
    await expect(page.getByTestId('song-body-chord-over').locator('.chord-line').first()).toBeVisible();

    await openSong(page, 'song-c');
    await expect(page.getByTestId('toggle-chords')).toHaveCount(0);
  });

  test('15d. Print / PDF is offered for every song and restores the title', async ({ page }) => {
    const pageTitle = await page.title();
    for (const id of ['song-a', 'song-b', 'song-c']) {
      await openSong(page, id);
      const title = await page.getByTestId('song-title').textContent();
      await page.evaluate(() => {
        (window as any).__printed = 0;
        (window as any).__printTitle = '';
        window.print = () => {
          (window as any).__printed++;
          (window as any).__printTitle = document.title;
        };
      });
      const button = page.getByTestId('print-song');
      await expect(button).toBeVisible();
      await expect(button).toContainText('Print / PDF');
      await button.click();
      expect(await page.evaluate(() => (window as any).__printed)).toBe(1);
      expect(await page.evaluate(() => (window as any).__printTitle)).toBe(title);
      expect(await page.title()).toBe(pageTitle);
    }
  });

  test('15e. lyrics-only print shows the lyrics sheet with no chord tags', async ({ page }) => {
    await openSong(page, 'song-a');
    await page.getByTestId('toggle-chords').click();
    await expect(page.getByTestId('song-body-lyrics')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('song-body-lyrics')).toBeVisible();
    await expect(page.getByTestId('song-body-lyrics')).toContainText('Amazing grace how sweet the sound');
    await expect(page.getByTestId('song-body-lyrics')).not.toContainText('[G]');
    await expect(page.locator('.chord, .chord-tag')).toHaveCount(0);
    await expect(page.getByTestId('song-body-chord-over')).toHaveCount(0);
    await expect(page.getByTestId('song-body-inline')).toHaveCount(0);
    await expect(page.getByTestId('toggle-chords')).toBeHidden();
    await expect(page.getByTestId('print-song')).toBeHidden();
  });

  test('16. print hides the navbar and transpose controls but keeps title and body', async ({ page }) => {
    await openSong(page, 'song-a');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('mat-toolbar').first()).toBeHidden();
    await expect(page.getByTestId('transpose-controls')).toBeHidden();
    await expect(page.getByTestId('song-title')).toBeVisible();
    await expect(page.getByTestId('song-body-chord-over')).toBeVisible();
    await expect(page.getByTestId('song-body-inline')).toBeHidden();
    await expect(page.getByTestId('song-body-chord-over')).toContainText('Amazing grace how sweet the sound');

    // The sheet prints on the page ground, not as a rounded card over gray.
    const print = await page.evaluate(() => {
      const sheet = document.querySelector('.song-sheet')!;
      const ground = document.querySelector('.song-detail')!;
      const title = document.querySelector('.song-title')!;
      const sheetBox = sheet.getBoundingClientRect();
      return {
        radius: parseFloat(getComputedStyle(sheet).borderTopLeftRadius),
        ground: getComputedStyle(ground).backgroundColor,
        bodyGround: getComputedStyle(document.body).backgroundColor,
        sheetPadLeft: Number.parseFloat(getComputedStyle(sheet).paddingLeft),
        sheetPadRight: Number.parseFloat(getComputedStyle(sheet).paddingRight),
        sheetPadTop: Number.parseFloat(getComputedStyle(sheet).paddingTop),
        sheetPadBottom: Number.parseFloat(getComputedStyle(sheet).paddingBottom),
        sheetLeft: sheetBox.x,
        sheetWidth: sheetBox.width,
        bodyWidth: document.body.getBoundingClientRect().width,
        titleTopFromSheet: title.getBoundingClientRect().y - sheetBox.y,
      };
    });
    expect(print.radius).toBe(0);
    expect(print.ground).toBe('rgb(255, 255, 255)');
    expect(print.bodyGround).toBe('rgb(255, 255, 255)');
    // The element owns the horizontal 14mm gutter only (measurable even though
    // print emulation ignores @page boxes).
    expect(print.sheetPadLeft).toBeCloseTo(52.9134, 0);
    expect(print.sheetPadRight).toBeCloseTo(52.9134, 0);
    // Vertical gutter belongs to the `song` page box so page 2+ keeps it; the
    // sheet adds no top/bottom padding (a fragment's padding only lands on the
    // first and last printed page).
    expect(print.sheetPadTop).toBeCloseTo(0, 1);
    expect(print.sheetPadBottom).toBeCloseTo(0, 1);
    expect(print.sheetLeft).toBe(0);
    // Full width: no centered column and no side gutter (the print capture can
    // still reserve a scrollbar strip, hence the small tolerance).
    expect(print.sheetWidth).toBeGreaterThanOrEqual(print.bodyWidth - 16);
    // No padding above the title; paper gains its 14mm from the page box.
    expect(print.titleTopFromSheet).toBeLessThan(1);

    // The vertical gutter repeats every printed page because it lives on the
    // named `song` page box, not on the (fragmenting) sheet element.
    const cssText = await page.evaluate(async () => {
      const chunks: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const owner = sheet.ownerNode as HTMLStyleElement | HTMLLinkElement | null;
          if (owner?.textContent) {
            chunks.push(owner.textContent);
          } else if (sheet.href) {
            chunks.push(await (await fetch(sheet.href)).text());
          }
        } catch {
          // Cross-origin sheets cannot be read; every app sheet is same-origin.
        }
      }
      return chunks.join('\n');
    });
    // index.html links the same stylesheet twice (eager + print-media onload),
    // so collapse identical page rules before asserting.
    const pageBlocks = [...new Map(
      [...cssText.matchAll(/@page\s*([\w-]*)\s*\{([^}]*)\}/g)].map(block => {
        const name = block[1];
        const margin = /margin\s*:\s*([^;]+)/.exec(block[2])?.[1].trim();
        return [`${name}:${margin}`, { name, margin }];
      }),
    ).values()];
    // A 14mm default page box for every other route, plus the named song page
    // whose vertical margins repeat on every printed page.
    expect(pageBlocks).toEqual(
      expect.arrayContaining([
        { name: '', margin: '14mm' },
        { name: 'song', margin: '14mm 0' },
      ]),
    );
    expect(cssText).toMatch(/\.song-sheet[^{]*\{[^}]*page:\s*song/);
    // The default page owns all four gutters on other routes; on songs the
    // named page owns the vertical pair and the sheet the horizontal pair, so
    // no element stacks a second vertical gutter.
    expect(pageBlocks.filter(block => block.margin === '0')).toEqual([]);
    expect(cssText).toMatch(
      /\.song-sheet[^{]*\{[^}]*padding:\s*0\s+14mm\s*!important/,
    );

    // Screen chrome is not paper content.
    await expect(page.locator('.pending-banner')).toBeHidden();
    await expect(page.locator('.app-skip-link')).toBeHidden();
  });

  test('16b. a dark-theme print renders dark ink on white paper', async ({ page, browserName }) => {
    const users = (await readDb<Record<string, { email?: string }>>('users')) ?? {};
    const userUid = Object.keys(users).find(id => users[id]?.email === 'user@e2e.local');
    expect(userUid, 'seeded user@e2e.local must resolve to a uid').toBeTruthy();
    try {
      // The member beforeEach already signed in as user@e2e.local.
      await page.getByTestId('theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      // Let the preference write land before the finally deletes it.
      await expect
        .poll(() => readDb(`users/${userUid}/prefs/theme`), { timeout: 10000 })
        .toBe('dark');

      await openSong(page, 'song-a');
      await page.emulateMedia({ media: 'print' });
      const print = await page.evaluate(() => ({
        ink: getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim(),
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        title: getComputedStyle(document.querySelector('.song-title')!).color,
        body: getComputedStyle(document.querySelector('[data-testid="song-body-chord-over"]')!).color,
        meta: getComputedStyle(document.querySelector('[data-testid="song-key"]')!).color,
        ground: getComputedStyle(document.body).backgroundColor,
      }));
      // Print re-declares the light ink tokens; the dark theme's light ink
      // would be white-on-white once the grounds are forced to #fff.
      expect(print.ink).toBe('#232A32');
      expect(print.title).toBe('rgb(35, 42, 50)');
      expect(print.body).toBe('rgb(35, 42, 50)');
      expect(print.meta).toBe('rgb(91, 100, 112)');
      expect(print.ground).toBe('rgb(255, 255, 255)');
      // Blink paints the page canvas — the @page margin band — from the
      // document's color-scheme. Dark would fill every margin with #121212.
      expect(print.colorScheme).toBe('light');

      // Chromium is the only engine that can emit a PDF. With printBackground
      // the canvas is painted, so a dark color-scheme shows up as a #121212
      // fill operator (.0706 .0706 .0706 rg) covering the sheet. Paper margins
      // are white when that fill is absent and the ground paints white.
      if (browserName === 'chromium') {
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        const content = pdfContent(pdf);
        expect(content).not.toMatch(/\.0706\s+\.0706\s+\.0706\s+rg/);
        expect(content).toMatch(/1\s+1\s+1\s+rg/);
      }
    } finally {
      await deleteDb(`users/${userUid}/prefs`);
    }
  });

  test('16c. a long song prints across multiple sheets', async ({ page, browserName }) => {
    const id = `e2e-long-${Date.now()}`;
    const body = Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of a long printed song`).join('\n');
    await writeDb(`songs/${id}`, {
      id,
      title: 'E2E Long Print',
      body,
      source: null,
      musicalKey: null,
      leaderIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    try {
      await page.goto(`/songs/${id}`);
      await expect(page.getByTestId('song-body')).toBeVisible();
      await page.emulateMedia({ media: 'print' });

      // page.pdf exists only in Chromium; test 16's CSSOM assertions cover the
      // page-box contract on the other engines.
      if (browserName !== 'chromium') {
        return;
      }
      const pdf = await page.pdf({ format: 'A4' });
      const counts = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/g)]
        .map(match => Number(match[1]));
      // The named `song` page must still paginate: >= 2 sheets for 120 lines.
      // Vertical margin values are asserted through the CSSOM in test 16; the
      // PDF check proves the page box does not clip the song to one sheet.
      expect(Math.max(...counts, 0)).toBeGreaterThanOrEqual(2);
    } finally {
      await deleteDb(`songs/${id}`);
    }
  });

  test('16d. non-song routes keep their screen layout when printed', async ({ page }) => {
    await page.goto('/songs');
    await expect(page.getByTestId('song-card').first()).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const print = await page.evaluate(() => {
      const ground = document.querySelector('.songs-page')!;
      return {
        background: getComputedStyle(ground).backgroundColor,
        paddingLeft: Number.parseFloat(getComputedStyle(ground).paddingLeft),
        paddingRight: Number.parseFloat(getComputedStyle(ground).paddingRight),
        maxWidth: getComputedStyle(ground).maxWidth,
        width: ground.getBoundingClientRect().width,
        bodyWidth: document.body.getBoundingClientRect().width,
      };
    });
    // The white-paper reset is scoped to the song detail, so a non-song route
    // keeps its warm ground, centered column, and screen side gutters.
    expect(print.background).toBe('rgb(243, 244, 246)');
    expect(print.paddingLeft).toBeCloseTo(16, 0);
    expect(print.paddingRight).toBeCloseTo(16, 0);
    expect(print.maxWidth).toBe('1200px');
    expect(print.width).toBeCloseTo(Math.min(1200, print.bodyWidth), 0);
  });

  test('17. disabling the songs flag redirects to feature-disabled', async ({ page }) => {
    await writeDb('features/songs/enabled', false);
    try {
      await page.reload();
      await page.goto('/songs');
      await expect(page).toHaveURL(/\/feature-disabled\?feature=songs/);
      // The page names itself for assistive tech, without borrowing a
      // feature-specific string.
      await expect(page.getByRole('heading', { level: 1, name: 'Feature unavailable' })).toBeVisible();
      await expect(page.locator('.disabled-card .disabled-icon')).toHaveText('power_settings_new');
      // The disabled page is the route's content: it exposes one main landmark.
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('main')).toContainText('Feature Disabled');
    } finally {
      await writeDb('features/songs/enabled', true);
    }
  });
  });

  test.describe('admin', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'admin');
    });

    function headerText(title: string): string {
      return [
        `Title: ${title}`,
        'Source: E2E Hymnal',
        'Key: D',
        'Leader: Alice',
        'Leader: Mallory',
        '',
        '[D]First line of the song',
        'Second line',
      ].join('\n');
    }

    async function storedSongByTitle(title: string): Promise<[string, Record<string, any>] | undefined> {
      const songs = (await readDb<Record<string, any>>('songs')) ?? {};
      return Object.entries(songs).find(([, song]) => song.title === title);
    }

    async function openAddPanel(page) {
      await page.goto('/admin/songs');
      await expect(page.getByTestId('admin-songs-table')).toBeVisible();
      await page.getByTestId('admin-add-song').click();
      await expect(page.getByTestId('admin-paste-input')).toBeVisible();
    }

    test('18. paste flow parses a header block, flags an unmatched leader, and saves', async ({ page }) => {
      const title = `E2E Paste ${Date.now()}`;
      let createdId: string | null = null;
      try {
        await page.goto('/admin/songs');
        await expect(page.getByTestId('admin-songs-table')).toBeVisible();
        await expect(page.getByTestId('admin-add-song')).toContainText('Add song');
        await page.getByTestId('admin-add-song').click();
        await expect(page.getByTestId('admin-paste-input')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Add song' })).toBeVisible();
        await page.getByTestId('admin-paste-input').fill(headerText(title));
        await expect(page.getByTestId('admin-parse-button')).toBeEnabled();
        await page.getByTestId('admin-parse-button').click();

        const dialog = page.getByTestId('song-draft-dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveText('Add song');
        await expect(page.getByTestId('draft-title')).toHaveValue(title);
        await expect(page.getByTestId('draft-source')).toHaveValue('E2E Hymnal');
        await expect(page.getByTestId('draft-key')).toHaveValue('D');
        await expect(page.getByTestId('draft-body')).toHaveValue('[D]First line of the song\nSecond line');
        await expect(page.getByTestId('draft-unmatched')).toContainText('Mallory');
        await expect(page.getByTestId('draft-leader-chip')).toHaveCount(1);

        await page.getByTestId('draft-leader-search').fill('Ben');
        await page.getByTestId('draft-leader-option').filter({ hasText: 'Ben' }).click();
        await expect(page.getByTestId('draft-leader-chip')).toHaveCount(2);
        await page.getByTestId('draft-save').click();
        await expect(dialog).toHaveCount(0);

        const entry = await storedSongByTitle(title);
        expect(entry).toBeTruthy();
        createdId = entry![0];
        expect(entry![1]).toMatchObject({
          title,
          source: 'E2E Hymnal',
          musicalKey: 'D',
          leaderIds: ['person-a', 'person-b'],
        });

        await page.goto('/songs');
        await expect(page.getByTestId('song-card').filter({ hasText: title })).toBeVisible();
        await page.reload();
        const card = page.getByTestId('song-card').filter({ hasText: title });
        await expect(card).toBeVisible();
        await expect(card.getByTestId('leader-chip')).toHaveText(['Alice', 'Ben']);
      } finally {
        if (createdId) {
          await deleteDb(`songs/${createdId}`);
        }
      }
    });

    test('19. a .txt upload opens the identical draft and saves the same fields', async ({ page }) => {
      const title = `E2E File ${Date.now()}`;
      let createdId: string | null = null;
      try {
        await openAddPanel(page);
        await expect(page.locator('.file-import .admin-muted')).toContainText(
          'Each file can be up to 2 MB and opens as an editable draft. Files are never uploaded or kept.',
        );
        await expect(page.getByRole('button', { name: 'Choose .txt files' })).toBeVisible();
        await page.getByTestId('admin-file-input').setInputFiles({
          name: 'e2e-song.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from(headerText(title)),
        });
        await expect(page.locator('.file-import .admin-muted')).toContainText('1 file selected.');

        const dialog = page.getByTestId('song-draft-dialog');
        await expect(dialog).toBeVisible();
        await expect(page.getByTestId('draft-title')).toHaveValue(title);
        await expect(page.getByTestId('draft-source')).toHaveValue('E2E Hymnal');
        await expect(page.getByTestId('draft-key')).toHaveValue('D');
        await expect(page.getByTestId('draft-body')).toHaveValue('[D]First line of the song\nSecond line');
        await expect(page.getByTestId('draft-unmatched')).toContainText('Mallory');
        await page.getByTestId('draft-save').click();
        await expect(dialog).toHaveCount(0);

        const entry = await storedSongByTitle(title);
        expect(entry).toBeTruthy();
        createdId = entry![0];
        expect(entry![1]).toMatchObject({
          title,
          source: 'E2E Hymnal',
          musicalKey: 'D',
          body: '[D]First line of the song\nSecond line',
          leaderIds: ['person-a'],
        });

        await page.goto('/songs');
        await expect(page.getByTestId('song-card').filter({ hasText: title })).toBeVisible();
        await page.reload();
        await expect(page.getByTestId('song-card').filter({ hasText: title })).toBeVisible();
      } finally {
        if (createdId) {
          await deleteDb(`songs/${createdId}`);
        }
      }
    });

    test('20. a header-less file takes the first non-empty line as title and the rest as body', async ({ page }) => {
      const title = `E2E Headerless ${Date.now()}`;
      let createdId: string | null = null;
      try {
        await openAddPanel(page);
        await page.getByTestId('admin-file-input').setInputFiles({
          name: 'headerless.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from(`${title}\nLine one\nLine two`),
        });

        await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
        await expect(page.getByTestId('draft-title')).toHaveValue(title);
        await expect(page.getByTestId('draft-body')).toHaveValue('Line one\nLine two');
        await page.getByTestId('draft-save').click();
        await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);

        const entry = await storedSongByTitle(title);
        expect(entry).toBeTruthy();
        createdId = entry![0];
        expect(entry![1]).toMatchObject({ title, body: 'Line one\nLine two' });

        await page.goto('/songs');
        await page.reload();
        await expect(page.getByTestId('song-title').filter({ hasText: title })).toBeVisible();
      } finally {
        if (createdId) {
          await deleteDb(`songs/${createdId}`);
        }
      }
    });

    test('21. saving with a cleared title is blocked with the exact message', async ({ page }) => {
      await openAddPanel(page);
      await page.getByTestId('admin-paste-input').fill('Title: E2E Validation\n\nA lyric line');
      await page.getByTestId('admin-parse-button').click();
      await expect(page.getByTestId('song-draft-dialog')).toBeVisible();

      await page.getByTestId('draft-title').fill('');
      await page.getByTestId('draft-save').click();
      await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Title is required.');
      await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
      // The active error is wired to the field it belongs to, and to no other.
      const titleField = page.getByTestId('draft-title');
      await expect(titleField).toHaveAttribute('aria-invalid', 'true');
      await expect(titleField).toHaveAttribute('aria-describedby', 'draft-error');
      await expect(page.getByTestId('draft-body')).not.toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByTestId('draft-body')).not.toHaveAttribute('aria-describedby', /.+/);
      await expect(page.locator('#draft-error')).toHaveText('Title is required.');
      // A lyrics error moves the wiring to the body field.
      await titleField.fill('E2E Validation');
      await page.getByTestId('draft-body').fill('');
      await page.getByTestId('draft-save').click();
      await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Lyrics are required.');
      await expect(page.getByTestId('draft-body')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByTestId('draft-body')).toHaveAttribute('aria-describedby', 'draft-error');
      await expect(titleField).not.toHaveAttribute('aria-invalid', 'true');
      await expect(titleField).not.toHaveAttribute('aria-describedby', /.+/);

      await page.getByTestId('draft-cancel').click();
      await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
      expect(await storedSongByTitle('E2E Validation')).toBeUndefined();
    });

    test('22. editing a published song updates the member detail after reload', async ({ page }) => {
      const original = await readDb<Record<string, any>>('songs/song-c');
      expect(original).toBeTruthy();
      const newTitle = `Come Thou Fount (E2E) ${Date.now()}`;
      try {
        await page.goto('/admin/songs');
        const row = page.getByTestId('admin-song-row').filter({ hasText: 'Come Thou Fount' });
        await expect(row).toBeVisible();
        await expect(row.locator('td[data-label="Updated"]')).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
        await row.getByTestId('admin-edit-song').click();

        await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
        await expect(page.getByTestId('draft-title')).toHaveValue('Come Thou Fount');
        await page.getByTestId('draft-title').fill(newTitle);
        await page.getByTestId('draft-key').fill('Eb');
        await page.getByTestId('draft-save').click();
        await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);

        const stored = (await readDb<Record<string, any>>('songs/song-c'))!;
        expect(stored.title).toBe(newTitle);
        expect(stored.musicalKey).toBe('Eb');

        await page.goto('/songs/song-c');
        await expect(page.getByTestId('song-title')).toHaveText(newTitle);
        await expect(page.getByTestId('song-key')).toHaveText('Key: Eb');
        await page.reload();
        await expect(page.getByTestId('song-title')).toHaveText(newTitle);
        await expect(page.getByTestId('song-key')).toHaveText('Key: Eb');
      } finally {
        await writeDb('songs/song-c', original);
      }
    });

    test('23. delete confirmation names the song and removes it from both lists', async ({ page }) => {
      const original = await readDb<Record<string, any>>('songs/song-d');
      expect(original).toBeTruthy();
      try {
        await page.goto('/admin/songs');
        const row = page.getByTestId('admin-song-row').filter({ hasText: 'Noël' });
        await expect(row).toBeVisible();
        await row.getByTestId('admin-delete-song').click();

        const confirm = page.getByRole('dialog').filter({ hasText: 'Delete song?' });
        await expect(confirm).toContainText('Delete Noël? This cannot be undone.');
        await confirm.getByTestId('admin-delete-confirm').click();
        await expect(row).toHaveCount(0);
        expect(await readDb('songs/song-d')).toBeNull();

        await page.goto('/songs');
        await expect(page.getByTestId('song-title').filter({ hasText: 'Noël' })).toHaveCount(0);
        await page.reload();
        await expect(page.getByTestId('song-title').filter({ hasText: 'Noël' })).toHaveCount(0);
        expect(await readDb('songs/song-d')).toBeNull();
      } finally {
        await writeDb('songs/song-d', original);
      }
    });

    test('24. clearing the admin search restores the rows and refocuses the field', async ({ page }) => {
      await page.goto('/admin/songs');
      await expect(page.getByTestId('admin-songs-table')).toBeVisible();
      await page.getByTestId('admin-songs-search').fill('Amazing');
      await expect(page.getByTestId('admin-song-row')).toHaveCount(1);

      await page.getByTestId('admin-songs-search').fill('zzz-no-match');
      await expect(page.getByTestId('admin-song-row')).toHaveCount(0);
      const noResults = page.locator('.no-results-message');
      await expect(noResults.locator('.no-results-title')).toHaveText('No results');
      await expect(noResults).toContainText('zzz-no-match');

      // Desktop centers the state in the area below the toolbar (the member
      // songs list's pattern) instead of pinning it under the filter bar.
      const centered = await page.evaluate(() => {
        const message = document.querySelector('.no-results-message')!.getBoundingClientRect();
        const filter = document.querySelector('.admin-filter-bar')!.getBoundingClientRect();
        const content = document.querySelector('.admin-content')!.getBoundingClientRect();
        return {
          messageCenter: message.top + message.height / 2,
          areaCenter: (filter.bottom + content.bottom) / 2,
        };
      });
      expect(Math.abs(centered.messageCenter - centered.areaCenter)).toBeLessThan(40);

      await page.getByRole('button', { name: 'Clear search' }).click();
      await expect(page.getByTestId('admin-songs-search')).toHaveValue('');
      await expect(page.getByTestId('admin-songs-search')).toBeFocused();
      await expect(page.getByTestId('admin-song-row')).toHaveCount(4);
    });

    test('24b. the admin search icon stays on the input text line empty and filled', async ({ page }) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/admin/songs');
        await expect(page.getByTestId('admin-songs-table')).toBeVisible();
        expect(await searchIconCenterDelta(page, 'admin-songs-search')).toBeLessThanOrEqual(2);

        await page.getByTestId('admin-songs-search').fill('Amazing');
        await expect(page.getByTestId('admin-song-row')).toHaveCount(1);
        await page.getByTestId('admin-songs-search').blur();
        expect(await searchIconCenterDelta(page, 'admin-songs-search')).toBeLessThanOrEqual(2);
      }
    });

    test('25. the empty library renders the empty state and the admin CTA', async ({ page }) => {
      const original = await readDb<Record<string, any>>('songs');
      try {
        await deleteDb('songs');
        await page.goto('/songs');
        const empty = page.getByTestId('songs-empty');
        await expect(empty).toContainText('No songs yet');
        await expect(empty).toContainText('Paste lyrics or import .txt files on the admin Songs page.');
        await expect(empty.getByRole('link', { name: 'Add songs' })).toHaveAttribute('href', '/admin/songs');
        await expect(page.getByTestId('song-card')).toHaveCount(0);
      } finally {
        await writeDb('songs', original);
      }
    });

    test('25b. the admin empty library shows the centered medallion state', async ({ page }) => {
      const original = await readDb<Record<string, any>>('songs');
      try {
        await deleteDb('songs');
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/admin/songs');
        const empty = page.getByTestId('admin-songs-empty');
        await expect(empty).toContainText('No songs yet');
        await expect(page.getByTestId('admin-song-row')).toHaveCount(0);

        // The medallion is the member empty state's tinted circle, not a bare
        // text block: visible, round, and carrying the music glyph.
        const medallion = page.locator('.admin-empty-icon');
        await expect(medallion).toBeVisible();
        await expect(medallion.locator('mat-icon')).toHaveText('music_note');
        const mark = await medallion.evaluate(el => {
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          return {
            background: style.backgroundColor,
            border: Number.parseFloat(style.borderTopWidth),
            width: box.width,
            height: box.height,
            radius: style.borderTopLeftRadius,
            ground: getComputedStyle(document.body).backgroundColor,
          };
        });
        expect(mark.background).not.toBe(mark.ground);
        expect(mark.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(mark.border).toBeCloseTo(1, 1);
        expect(mark.radius).toBe('50%');
        expect(mark.width).toBeCloseTo(mark.height, 0);

        // Room-sized state fills and centers in the content area.
        const layout = await page.locator('.admin-empty-region').evaluate(el => {
          const region = el.getBoundingClientRect();
          const inner = el.querySelector('.admin-empty')!.getBoundingClientRect();
          return {
            minHeight: Number.parseFloat(getComputedStyle(el).minHeight),
            centerDelta: Math.abs(
              inner.top + inner.height / 2 - (region.top + region.height / 2),
            ),
          };
        });
        expect(layout.minHeight).toBeGreaterThan(300);
        expect(layout.centerDelta).toBeLessThan(2);

        // Mobile stays compact: no forced content-area height.
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(empty).toBeVisible();
        const mobileMin = await page.locator('.admin-empty-region').evaluate(el => {
          const value = Number.parseFloat(getComputedStyle(el).minHeight);
          return Number.isFinite(value) ? value : 0;
        });
        expect(mobileMin).toBeLessThan(300);
      } finally {
        await writeDb('songs', original);
      }
    });

    test('25c. the paste and lyrics textareas have no resize grip but scroll', async ({ page }) => {
      await openAddPanel(page);
      const paste = page.getByTestId('admin-paste-input');
      await expect(paste).toHaveCSS('resize', 'none');
      await expect(paste).toHaveCSS('overflow-y', 'auto');

      await paste.fill('Title: E2E Resize\n\nA lyric line');
      await page.getByTestId('admin-parse-button').click();
      const body = page.getByTestId('draft-body');
      await expect(body).toBeVisible();
      await expect(body).toHaveCSS('resize', 'none');
      await expect(body).toHaveCSS('overflow-y', 'auto');
      await page.getByTestId('draft-cancel').click();
    });

    test('25d. the Add song guide links a parseable sample download', async ({ page }) => {
      await page.goto('/admin/songs');
      await expect(page.getByTestId('admin-songs-table')).toBeVisible();
      await page.getByTestId('admin-add-song').click();
      await expect(page.getByTestId('admin-paste-input')).toBeVisible();
      await expect(page.locator('.format-guide')).toContainText(
        'One song per .txt file. Start with Title:, Source:, Key:, and optional Leader: lines, then a blank line, then lyrics with [G] chords inline.',
      );

      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('admin-download-sample').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('songs-sample.txt');

      const text = readFileSync((await download.path())!, 'utf8');
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).toContain('Title: Amazing Grace');
      expect(text).toContain('Source: John Newton');
      expect(text).toContain('Key: G');
      expect(text).toMatch(/Key: G\n\n\[G\]/);
      expect(text).toContain('[G]Amazing [D]grace');
      expect(text).toContain('[Bb]I once was lost');
      expect(text).not.toMatch(/<(!doctype|html|body)/i);
    });

    test('26. the draft dialog fits the Leaders picker on desktop and scrolls on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openAddPanel(page);
      await page.getByTestId('admin-paste-input').fill('Title: E2E Dialog Fit\n\nA lyric line');
      await page.getByTestId('admin-parse-button').click();
      await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
      const pane = page.locator('.cdk-overlay-pane.song-draft-panel');
      // Desktop keeps the centered 640px dialog (engine layout rounds a hair).
      await expectCssNumber(pane, 'width', 640, 0);
      // The thumb-sized title-row close is mobile-only.
      await expect(page.getByTestId('draft-close')).toBeHidden();

      // Desktop: the label, the search field, and one option are on first paint.
      await expect(page.getByRole('heading', { name: 'Leaders' })).toBeInViewport();
      await expect(page.getByTestId('draft-leader-search')).toBeInViewport();
      await expect(page.getByTestId('draft-leader-option').first()).toBeInViewport();

      // Mobile: the content scrolls; the picker and the actions stay reachable.
      await page.setViewportSize({ width: 390, height: 844 });
      // The pane becomes a full-height, full-width bottom-anchored sheet, so no
      // dimmed strip peeks below and the actions sit on the sheet's bottom.
      await expectCssNumber(pane, 'width', 390, 0);
      await expectCssNumber(pane, 'height', 844, 0);
      await expectCssNumber(pane, 'max-height', 844, 0);
      await expectCssNumber(pane, 'border-radius', 0);
      await expectCssNumber(page.locator('.mat-mdc-dialog-surface'), 'border-radius', 0);
      // Wait out the entrance transform before measuring the sheet's edges.
      await expect(page.locator('.mat-mdc-dialog-surface')).toHaveCSS('transform', 'none');
      const surfaceBottom = await page
        .locator('.mat-mdc-dialog-surface')
        .evaluate(el => el.getBoundingClientRect().bottom);
      expect(Math.abs(surfaceBottom - 844)).toBeLessThanOrEqual(1);
      await expect(page.locator('mat-dialog-content')).toHaveCSS('overflow-y', 'auto');
      // The title row carries a right-aligned close on phones.
      const close = page.getByTestId('draft-close');
      await expect(close).toBeVisible();
      await expect(close).toBeInViewport({ ratio: 0.95 });
      await expect(page.locator('.draft-title-row')).toHaveCSS('display', 'flex');
      const closeBox = (await close.boundingBox())!;
      const surface = (await page.locator('.mat-mdc-dialog-surface').boundingBox())!;
      expect(closeBox.x + closeBox.width / 2).toBeGreaterThan(surface.x + surface.width / 2);
      // The tighter title band and 80px body keep the Leaders search whole on
      // first paint instead of slicing it at the content edge.
      await expectCssNumber(page.getByTestId('draft-body'), 'min-height', 80);
      await expect(page.getByRole('heading', { name: 'Leaders' })).toBeInViewport({ ratio: 0.95 });
      await expect(page.getByTestId('draft-leader-search')).toBeInViewport({ ratio: 0.95 });
      await expect(page.getByTestId('draft-leader-option').first()).toBeInViewport({ ratio: 0.95 });
      await expect(page.getByTestId('draft-save')).toBeInViewport({ ratio: 0.95 });
      // Cancel/Save read as the sheet's footer: hairline divider above, the
      // sheet surface behind, and bottom padding clear of the safe area.
      const footer = await page.locator('.song-draft-panel .mat-mdc-dialog-actions').evaluate(el => {
        const style = getComputedStyle(el);
        // Resolve the token in-place so the check follows the active theme.
        const probe = document.createElement('span');
        probe.style.color = 'var(--color-border)';
        document.body.appendChild(probe);
        const borderToken = getComputedStyle(probe).color;
        probe.remove();
        return {
          borderTopWidth: Number.parseFloat(style.borderTopWidth),
          borderTopColor: style.borderTopColor,
          borderToken,
          background: style.backgroundColor,
          surface: getComputedStyle(el.closest('.mat-mdc-dialog-surface')!).backgroundColor,
          paddingBottom: Number.parseFloat(style.paddingBottom),
        };
      });
      expect(footer.borderTopWidth).toBeCloseTo(1, 1);
      expect(footer.borderTopColor).toBe(footer.borderToken);
      expect(footer.background).toBe(footer.surface);
      expect(footer.paddingBottom).toBeGreaterThanOrEqual(16);
      // At first paint the first option must clear the actions row, not sit 22px
      // behind it at scrollTop 0.
      const overlap = await page.evaluate(() => {
        const content = document.querySelector('mat-dialog-content')!;
        content.scrollTop = 0;
        const option = document.querySelector('[data-testid="draft-leader-option"]')!;
        const actions = document.querySelector('mat-dialog-actions')!;
        return option.getBoundingClientRect().bottom - actions.getBoundingClientRect().top;
      });
      expect(overlap).toBeLessThanOrEqual(0);
      await page.getByTestId('draft-leader-search').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('draft-leader-search')).toBeInViewport();
      await page.getByTestId('draft-leader-option').first().click();
      await expect(page.getByTestId('draft-leader-chip')).toHaveCount(1);
      await page.getByTestId('draft-cancel').click();
      await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
      expect(await storedSongByTitle('E2E Dialog Fit')).toBeUndefined();
    });

    test('27. saving a draft whose song was deleted reports it and never recreates the node', async ({ page }) => {
      const id = `e2e-ghost-${Date.now()}`;
      const title = `E2E Ghost ${Date.now()}`;
      await writeDb(`songs/${id}`, {
        id,
        title,
        body: 'Ghost lyric line',
        source: null,
        musicalKey: null,
        leaderIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      try {
        await page.goto('/admin/songs');
        const row = page.getByTestId('admin-song-row').filter({ hasText: title });
        await expect(row).toBeVisible();
        await row.getByTestId('admin-edit-song').click();
        await expect(page.getByTestId('draft-title')).toHaveValue(title);

        await deleteDb(`songs/${id}`);
        // The live list drops the row; the open draft keeps its snapshot.
        await expect(row).toHaveCount(0);
        await page.getByTestId('draft-title').fill(`${title} edited`);
        await page.getByTestId('draft-save').click();

        await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Song no longer exists.');
        await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
        expect(await readDb(`songs/${id}`)).toBeNull();

        await page.getByTestId('draft-cancel').click();
        await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
      } finally {
        await deleteDb(`songs/${id}`);
      }
    });

    test('28. empty and oversized files are rejected by name without a draft', async ({ page }) => {
      await openAddPanel(page);

      await page.getByTestId('admin-file-input').setInputFiles({
        name: 'empty.txt',
        mimeType: 'text/plain',
        buffer: Buffer.alloc(0),
      });
      await expect(page.locator('.admin-error')).toContainText('empty.txt');
      await expect(page.locator('.admin-error')).toContainText('is empty');
      await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);

      await page.getByTestId('admin-file-input').setInputFiles({
        name: 'blank.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('   \n\n'),
      });
      await expect(page.locator('.admin-error')).toContainText('blank.txt');
      await expect(page.locator('.admin-error')).toContainText('is empty');
      await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);

      await page.getByTestId('admin-file-input').setInputFiles({
        name: 'huge.txt',
        mimeType: 'text/plain',
        buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 97),
      });
      await expect(page.locator('.admin-error')).toContainText('huge.txt');
      await expect(page.locator('.admin-error')).toContainText('larger than 2 MB');
      await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
    });

    test('28b. failures across one pick collapse into one line and survive a later success', async ({ page }) => {
      const title = `E2E Mixed ${Date.now()}`;
      try {
        await openAddPanel(page);

        // Two bad files: one aggregate line, no per-file detail.
        await page.getByTestId('admin-file-input').setInputFiles([
          { name: 'first-empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) },
          { name: 'second-empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) },
        ]);
        await expect(page.locator('.admin-error')).toHaveText(
          "We couldn't import 2 of 2 files. Check that each one is a .txt file under 2 MB, then try again.",
        );
        await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);

        // One bad file then a good one: the specific line is not overwritten by
        // the draft the good file opens.
        await page.getByTestId('admin-file-input').setInputFiles([
          { name: 'short.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) },
          { name: 'mixed.txt', mimeType: 'text/plain', buffer: Buffer.from(headerText(title)) },
        ]);
        await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
        await page.getByTestId('draft-cancel').click();
        await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
        await expect(page.locator('.admin-error')).toHaveText('"short.txt" is empty.');
        expect(await storedSongByTitle(title)).toBeUndefined();
      } finally {
        const entry = await storedSongByTitle(title);
        if (entry) {
          await deleteDb(`songs/${entry[0]}`);
        }
      }
    });

    test('29. Escape never discards a typed draft; Cancel is the discard path', async ({ page }) => {
      await openAddPanel(page);
      await page.getByTestId('admin-paste-input').fill('Title: E2E Escape\n\nA lyric line');
      await page.getByTestId('admin-parse-button').click();
      await expect(page.getByTestId('song-draft-dialog')).toBeVisible();

      await page.getByTestId('draft-title').fill('E2E Escape kept');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
      await expect(page.getByTestId('draft-title')).toHaveValue('E2E Escape kept');

      await page.getByTestId('draft-cancel').click();
      await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
      expect(await storedSongByTitle('E2E Escape kept')).toBeUndefined();
    });

    test('29b. the mobile title-row close discards the draft like Cancel', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openAddPanel(page);
      await page.getByTestId('admin-paste-input').fill('Title: E2E Close\n\nA lyric line');
      await page.getByTestId('admin-parse-button').click();
      await expect(page.getByTestId('song-draft-dialog')).toBeVisible();

      await page.getByTestId('draft-title').fill('E2E Close kept');
      await page.getByTestId('draft-close').click();
      await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
      expect(await storedSongByTitle('E2E Close kept')).toBeUndefined();
    });

    test('29c. opening the draft dialog focuses Title, not the mobile close', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openAddPanel(page);
      await page.getByTestId('admin-paste-input').fill('Title: E2E Focus\n\nA lyric line');
      await page.getByTestId('admin-parse-button').click();
      await expect(page.getByTestId('song-draft-dialog')).toBeVisible();

      // The mobile close sits earlier in the DOM; the dialog must land on the
      // first field instead of the title-row button.
      await expect(page.getByTestId('draft-title')).toBeFocused();
      await expect(page.getByTestId('draft-close')).not.toBeFocused();

      await page.getByTestId('draft-cancel').click();
      await expect(page.getByTestId('song-draft-dialog')).toHaveCount(0);
    });

    for (const width of [320, 390]) {
      test(`30. at ${width}px the toolbar shares one row and the filter bar collapses`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/admin/songs');
        await expect(page.getByTestId('admin-songs-table')).toBeVisible();

        const titleBox = (await page.locator('.page-toolbar-title').boundingBox())!;
        const ctaBox = (await page.getByTestId('admin-add-song').boundingBox())!;
        // Same row: the CTA's vertical span overlaps the title's.
        expect(ctaBox.y).toBeLessThan(titleBox.y + titleBox.height);
        expect(titleBox.y).toBeLessThan(ctaBox.y + ctaBox.height);
        // CTA right-aligned, title left.
        expect(ctaBox.x).toBeGreaterThan(titleBox.x);

        const filterHeight = await page
          .locator('.admin-filter-bar')
          .evaluate(el => el.getBoundingClientRect().height);
        expect(filterHeight).toBeLessThan(60);
        await expect(page.locator('.admin-filter-actions')).toHaveCSS('display', 'none');
      });
    }

    test('31. the Add song toggle reports its panel and the hidden picker leaves the tab order', async ({ page }) => {
      await page.goto('/admin/songs');
      await expect(page.getByTestId('admin-songs-table')).toBeVisible();
      const toggle = page.getByTestId('admin-add-song');
      // Collapsed: no dangling reference to a panel that is not in the DOM.
      await expect(toggle).not.toHaveAttribute('aria-controls', /.+/);
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(toggle).toHaveAttribute('aria-controls', 'add-song-panel');
      await expect(page.locator('#add-song-panel')).toBeVisible();

      // Only the visible Choose .txt files button reaches the picker; the
      // visually-hidden input must not be a tab stop.
      const fileInput = page.getByTestId('admin-file-input');
      await expect(fileInput).toHaveAttribute('tabindex', '-1');
      await page.getByTestId('admin-paste-input').focus();
      const visited: (string | null)[] = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        visited.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')));
      }
      expect(visited).not.toContain('admin-file-input');

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).not.toHaveAttribute('aria-controls', /.+/);
      await expect(page.locator('#add-song-panel')).toHaveCount(0);
    });

    test('32. stacked leader chips align with the value column and use link ink', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/admin/songs');
      await expect(page.getByTestId('admin-songs-table')).toBeVisible();
      const row = page.getByTestId('admin-song-row').filter({ hasText: 'Amazing Grace' });
      const chips = row.locator('td[data-label="Leaders"] .leader-chip');
      await expect(chips).toHaveText(['Alice Anderson', 'Ben Brown']);

      const geometry = await page.evaluate(() => {
        const rowEl = document.querySelector('[data-testid="admin-song-row"]')!;
        const leadersTd = rowEl.querySelector('td[data-label="Leaders"]')!;
        const chip = leadersTd.querySelector('.leader-chip') as HTMLElement;
        const titleTd = rowEl.querySelector('td[data-label="Title"]')!;
        const range = document.createRange();
        range.selectNodeContents(titleTd);
        const probe = document.createElement('span');
        probe.style.color = 'var(--color-link)';
        document.body.appendChild(probe);
        const linkToken = getComputedStyle(probe).color;
        probe.remove();
        return {
          chipLeft: chip.getBoundingClientRect().left,
          valueLeft: range.getBoundingClientRect().left,
          chipRight: chip.getBoundingClientRect().right,
          cellRight: leadersTd.getBoundingClientRect().right,
          chipColor: getComputedStyle(chip).color,
          linkToken,
        };
      });
      // Same value column as every other stacked row: not the lone full-bleed
      // outlier, and the chips still wrap inside the cell.
      expect(Math.abs(geometry.chipLeft - geometry.valueLeft)).toBeLessThanOrEqual(1);
      expect(geometry.chipRight).toBeLessThanOrEqual(geometry.cellRight + 1);
      expect(geometry.chipColor).toBe(geometry.linkToken);
    });
  });
});
