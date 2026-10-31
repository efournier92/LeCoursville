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
    await expect(page.locator('.no-results-message')).toContainText('zzz-no-match');
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

  test('10. the detail body is monospace and preserves stored newlines', async ({ page }) => {
    const stored = (await readDb<Record<string, any>>('songs/song-a'))!;
    await openSong(page, 'song-a');
    const body = page.getByTestId('song-body');
    const fontFamily = await body.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/monospace/i);
    expect(await body.textContent()).toBe(stored.body);
  });

  test('11. + transposes G to G# and shows the +1 badge', async ({ page }) => {
    await openSong(page, 'song-a');
    await expect(page.getByTestId('song-body')).toContainText('[G]Amazing grace');
    await page.getByTestId('transpose-up').click();
    await expect(page.getByTestId('song-body')).toContainText('[G#]Amazing grace');
    await expect(page.getByTestId('transpose-offset')).toHaveText('+1');
    await expect(page.getByTestId('song-key')).toHaveText('Key: G → G#');
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
    await openSong(page, 'song-b');
    await expect(page.getByTestId('transpose-controls')).toHaveCount(0);
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
        await openAddPanel(page);
        await page.getByTestId('admin-paste-input').fill(headerText(title));
        await expect(page.getByTestId('admin-parse-button')).toBeEnabled();
        await page.getByTestId('admin-parse-button').click();

        const dialog = page.getByTestId('song-draft-dialog');
        await expect(dialog).toBeVisible();
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
        await expect(row.locator('td[data-label="Updated"]')).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
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
  });
});
