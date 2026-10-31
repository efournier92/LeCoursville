import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, writeDb } from '../helpers/admin-db';

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

  test('5. clearing the search restores the full list', async ({ page }) => {
    await page.goto('/songs');
    await expect(cards(page)).toHaveCount(4);
    await page.getByTestId('song-search').fill('Amazing');
    await expect(cards(page)).toHaveCount(1);
    await page.getByTestId('song-search').fill('');
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
  });

  test('12. a flat-root bracket plus two renders C', async ({ page }) => {
    await openSong(page, 'song-a');
    await page.getByTestId('transpose-up').click();
    await page.getByTestId('transpose-up').click();
    await expect(page.getByTestId('song-body')).toContainText('[C]I once was lost');
    await expect(page.getByTestId('transpose-offset')).toHaveText('+2');
  });

  test('13. Reset restores the stored body and hides the badge', async ({ page }) => {
    const stored = (await readDb<Record<string, any>>('songs/song-a'))!;
    await openSong(page, 'song-a');
    await page.getByTestId('transpose-up').click();
    await page.getByTestId('transpose-up').click();
    await page.getByTestId('transpose-reset').click();
    await expect(page.getByTestId('transpose-offset')).toHaveCount(0);
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
    await expect(page.getByTestId('transpose-offset')).toHaveCount(0);
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
