import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';

const TITLES = ['Amazing Grace', 'Blessed Be the Name', 'Come Thou Fount', 'Noël'];

function cards(page) {
  return page.getByTestId('song-card');
}

function titles(page) {
  return page.getByTestId('song-title');
}

async function openSong(page, id: string) {
  await page.goto(`/songs/${id}`);
  await expect(page.getByTestId('song-body')).toBeVisible();
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
  });

  test('10. the detail body is monospace and preserves stored newlines', async ({ page }) => {
    const stored = (await readDb<Record<string, any>>('songs/song-a'))!;
    await openSong(page, 'song-a');
    const body = page.getByTestId('song-body');
    const fontFamily = await body.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/monospace/i);
    // Segmented spans must not change a single byte of the rendered body.
    expect(await body.textContent()).toBe(stored.body);
    await expect(body.locator('.chord').first()).toBeVisible();
  });

  test('10b. the body scales to 1.2rem on desktop and 0.95rem on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSong(page, 'song-a');
    const body = page.getByTestId('song-body');
    await expect(body).toHaveCSS('font-size', '19.2px');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(body).toHaveCSS('font-size', '15.2px');
    // The 72ch measure still applies; no width regression from the scale bump.
    const measure = await body.evaluate(el => parseFloat(getComputedStyle(el).maxWidth));
    expect(measure).toBeGreaterThan(500);
  });

  test('10c. the preview skips a leading chord-only line and cards stretch to a row', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);

    const blessed = cards(page).filter({ hasText: 'Blessed Be the Name' });
    const excerpt = (await blessed.locator('.song-excerpt').textContent())!.trim();
    expect(excerpt.split('\n')[0]).toBe('Blessed be the name of the Lord');

    const grid = await page.locator('.songs-grid').evaluate(el => getComputedStyle(el).alignItems);
    expect(grid).toBe('stretch');

    const heights = await cards(page).evaluateAll(els =>
      els.slice(0, 3).map(el => Math.round(el.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size).toBe(1);
  });

  test('11. + transposes G to G# and shows the +1 badge', async ({ page }) => {
    await openSong(page, 'song-a');
    await expect(page.locator('.transpose-label')).toHaveText('Transpose');
    await expect(page.getByTestId('song-body')).toContainText('[G]Amazing grace');
    await page.getByTestId('transpose-up').click();
    await expect(page.getByTestId('song-body')).toContainText('[G#]Amazing grace');
    await expect(page.getByTestId('transpose-offset')).toHaveText('+1');
    await expect(page.getByTestId('song-key')).toHaveText('Key: G → G#');
    // The M3 state layer is square inside the pill, so no ink spills over the
    // "+1" divider or the right cap after the click.
    const stateLayer = page
      .getByTestId('transpose-up')
      .locator('.mat-mdc-button-persistent-ripple');
    await expect(stateLayer).toHaveCSS('border-radius', '0px');
    await expect(page.getByTestId('transpose-up')).toHaveCSS('border-radius', '0px');
  });

  test('12. a flat-root bracket plus two renders C', async ({ page }) => {
    await openSong(page, 'song-a');
    await page.getByTestId('transpose-up').click();
    await page.getByTestId('transpose-up').click();
    await expect(page.getByTestId('song-body')).toContainText('[C]I once was lost');
    await expect(page.getByTestId('transpose-offset')).toHaveText('+2');
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
    expect(await page.getByTestId('song-body').textContent()).toBe(stored.body);
  });

  test('14. the chord-over-line song renders no transpose controls', async ({ page }) => {
    const stored = (await readDb<Record<string, any>>('songs/song-b'))!;
    await openSong(page, 'song-b');
    await expect(page.getByTestId('transpose-controls')).toHaveCount(0);
    // Bare chord-over lines are segmented too, still byte-identical.
    await expect(page.locator('.song-body .chord-line').first()).toBeVisible();
    expect(await page.getByTestId('song-body').textContent()).toBe(stored.body);
  });

  test('15. a reload shows the untransposed stored body', async ({ page }) => {
    await openSong(page, 'song-a');
    await page.getByTestId('transpose-up').click();
    await expect(page.getByTestId('song-body')).toContainText('[G#]Amazing grace');

    await page.reload();
    await expect(page.getByTestId('song-body')).toContainText('[G]Amazing grace');
    await expect(page.getByTestId('song-body')).not.toContainText('[G#]');
    await expect(page.getByTestId('transpose-offset')).toHaveText('');
  });

  test('16. print hides the navbar and transpose controls but keeps title and body', async ({ page }) => {
    await openSong(page, 'song-a');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('mat-toolbar').first()).toBeHidden();
    await expect(page.getByTestId('transpose-controls')).toBeHidden();
    await expect(page.getByTestId('song-title')).toBeVisible();
    await expect(page.getByTestId('song-body')).toBeVisible();

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
        sheetPad: getComputedStyle(sheet).paddingLeft,
        sheetLeft: sheetBox.x,
        sheetWidth: sheetBox.width,
        bodyWidth: document.body.getBoundingClientRect().width,
        titleTopFromSheet: title.getBoundingClientRect().y - sheetBox.y,
      };
    });
    expect(print.radius).toBe(0);
    expect(print.ground).toBe('rgb(255, 255, 255)');
    expect(print.bodyGround).toBe('rgb(255, 255, 255)');
    // The sheet owns its own 14mm page box (emulated print ignores @page).
    expect(print.sheetPad).toBe('52.9134px');
    expect(print.sheetLeft).toBe(0);
    // Full width: no centered column and no side gutter (the print capture can
    // still reserve a scrollbar strip, hence the small tolerance).
    expect(print.sheetWidth).toBeGreaterThanOrEqual(print.bodyWidth - 16);
    expect(print.titleTopFromSheet).toBeGreaterThanOrEqual(52);
    expect(print.titleTopFromSheet).toBeLessThan(54);

    // Exactly one 14mm owner: @page contributes no margin, so real paper does
    // not stack a second gutter on top of the sheet's own padding.
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
    const pageBlocks = [...cssText.matchAll(/@page\s*\{([^}]*)\}/g)];
    expect(pageBlocks.length).toBeGreaterThan(0);
    for (const block of pageBlocks) {
      const margin = /margin\s*:\s*([^;]+)/.exec(block[1])?.[1].trim();
      expect(['0', '0mm', '0px']).toContain(margin);
    }
    expect(cssText.match(/14mm/g) || []).toHaveLength(1);
  });

  test('17. disabling the songs flag redirects to feature-disabled', async ({ page }) => {
    await writeDb('features/songs/enabled', false);
    try {
      await page.reload();
      await page.goto('/songs');
      await expect(page).toHaveURL(/\/feature-disabled\?feature=songs/);
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

      await page.getByRole('button', { name: 'Clear search' }).click();
      await expect(page.getByTestId('admin-songs-search')).toHaveValue('');
      await expect(page.getByTestId('admin-songs-search')).toBeFocused();
      await expect(page.getByTestId('admin-song-row')).toHaveCount(4);
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

    test('26. the draft dialog fits the Leaders picker on desktop and scrolls on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openAddPanel(page);
      await page.getByTestId('admin-paste-input').fill('Title: E2E Dialog Fit\n\nA lyric line');
      await page.getByTestId('admin-parse-button').click();
      await expect(page.getByTestId('song-draft-dialog')).toBeVisible();
      const pane = page.locator('.cdk-overlay-pane.song-draft-panel');
      // Desktop keeps the centered 640px dialog.
      await expect(pane).toHaveCSS('width', '640px');

      // Desktop: the label, the search field, and one option are on first paint.
      await expect(page.getByRole('heading', { name: 'Leaders' })).toBeInViewport();
      await expect(page.getByTestId('draft-leader-search')).toBeInViewport();
      await expect(page.getByTestId('draft-leader-option').first()).toBeInViewport();

      // Mobile: the content scrolls; the picker and the actions stay reachable.
      await page.setViewportSize({ width: 390, height: 844 });
      // The pane becomes a full-height, full-width bottom-anchored sheet, so no
      // dimmed strip peeks below and the actions sit on the sheet's bottom.
      await expect(pane).toHaveCSS('width', '390px');
      await expect(pane).toHaveCSS('height', '844px');
      await expect(pane).toHaveCSS('max-height', '844px');
      await expect(pane).toHaveCSS('border-radius', '0px');
      await expect(page.locator('.mat-mdc-dialog-surface')).toHaveCSS('border-radius', '0px');
      // Wait out the entrance transform before measuring the sheet's edges.
      await expect(page.locator('.mat-mdc-dialog-surface')).toHaveCSS('transform', 'none');
      const surfaceBottom = await page
        .locator('.mat-mdc-dialog-surface')
        .evaluate(el => el.getBoundingClientRect().bottom);
      expect(Math.abs(surfaceBottom - 844)).toBeLessThanOrEqual(1);
      await expect(page.locator('mat-dialog-content')).toHaveCSS('overflow-y', 'auto');
      // The tighter title band and 80px body keep the Leaders search whole on
      // first paint instead of slicing it at the content edge.
      await expect(page.getByTestId('draft-body')).toHaveCSS('min-height', '80px');
      await expect(page.getByRole('heading', { name: 'Leaders' })).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId('draft-leader-search')).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId('draft-leader-option').first()).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId('draft-save')).toBeInViewport({ ratio: 1 });
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
  });
});
