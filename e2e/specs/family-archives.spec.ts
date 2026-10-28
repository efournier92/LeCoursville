import { test, expect } from '../helpers/fixture';
import { login, logout } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';

const units = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid^="family-unit-"]');

const smallJson = JSON.stringify([
  { id: 't-1', given: 'Tessa', surname: 'Test', name: 'Tessa Test' },
  { id: 't-2', given: 'Tobias', surname: 'Test', name: 'Tobias Test' },
]);

const replaceJson = JSON.stringify([
  { id: 'fa-1', given: 'Ferdinand', surname: 'Fern', name: 'Ferdinand Fern' },
  { id: 'fa-9', given: 'Fresh', surname: 'Data', name: 'Fresh Data' },
  { id: 'fa-10', given: 'Newer', surname: 'Data', name: 'Newer Data' },
]);

test.describe('family archives', () => {
  let seededFerland: unknown;

  test.beforeAll(async () => {
    seededFerland = await readDb('familyArchive/ferland');
  });

  test.afterEach(async () => {
    // Restore every mutated node through the Admin SDK before anything can throw.
    await writeDb('features/families', { enabled: true, updatedAt: Date.now() });
    await writeDb('familyArchive/wolf/published', false);
    await writeDb('familyArchive/ferland', seededFerland);
    await deleteDb('familyArchive/test');
  });

  test('unauthenticated visit shows no family content', async ({ page }) => {
    await page.goto('/families/ferland');
    await expect(page).not.toHaveURL(/\/families\/ferland$/);
    await expect(units(page)).toHaveCount(0);
  });

  test('signed-in user sees the seeded archive with all person units', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/families/ferland');
    await expect(page.getByTestId('family-archive-empty')).toHaveCount(0);
    await expect(page.locator('.family-title')).toHaveText('Ferland Family');
    await expect(units(page)).toHaveCount(8);
    // Two root branches render as separate sections.
    await expect(page.getByTestId('family-branch-fa-1')).toBeVisible();
    await expect(page.getByTestId('family-branch-fb-1')).toBeVisible();
  });

  test('search filters units live and clearing restores them', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/families/ferland');
    await expect(units(page)).toHaveCount(8);
    const search = page.getByTestId('family-search');
    await search.fill('Birch');
    await expect(units(page)).toHaveCount(2);
    await search.fill('');
    await expect(units(page)).toHaveCount(8);
  });

  test('clicking a unit opens the panel and relative links re-select', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/families/ferland');
    await page.getByTestId('family-unit-fa-1').click();
    const panel = page.getByTestId('family-panel');
    await expect(panel.getByText('Ferdinand Fern')).toBeVisible();
    await expect(page.getByTestId('family-panel-birth')).toContainText('1901-01-05');
    await expect(page.getByTestId('family-panel-note')).toContainText('notebook');
    await panel.getByRole('button', { name: 'Felix Fern' }).click();
    await expect(panel.getByText('Felix Fern')).toBeVisible();
  });

  test('keyboard navigation moves focus between units and Enter opens the panel', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/families/ferland');
    const first = page.getByTestId('family-unit-fa-1');
    await first.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('family-unit-fa-2')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('family-panel').getByText('Fabienne Fern')).toBeVisible();
  });

  test('flag off redirects to feature-disabled and hides the navbar link', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'families', false);
    const navLink = () => page.getByRole('button', { name: 'Ferland Family' });
    await expect(navLink()).toHaveCount(0);
    await page.goto('/families/ferland');
    await expect(page).toHaveURL(/\/feature-disabled/);
    await setFeatureFlag(page, 'families', true);
    await page.goto('/contacts');
    await expect(navLink()).toBeVisible();
  });

  test('unpublished family shows the not-available empty state until published', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/families/wolf');
    await expect(page.getByTestId('family-archive-empty')).toBeVisible();
    await expect(page.getByTestId('family-archive-empty')).toHaveText('This family archive is not available');
    // Publish through the admin toggle; it writes only familyArchive/wolf/published.
    // Sign out only from the Account page; reach it through the SPA link.
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page).toHaveURL('/');
    await logout(page);
    await login(page, 'admin');
    await page.goto('/admin/family-archives');
    const toggle = page.getByTestId('archive-published-wolf').locator('button[role="switch"]');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(await readDb('familyArchive/wolf/published')).toBe(true);
    await page.goto('/families/wolf');
    await expect(page.getByTestId('family-archive-empty')).toHaveCount(0);
    await expect(units(page)).toHaveCount(2);
  });

  test('unknown familyId shows the not-available empty state', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/families/nosuch');
    await expect(page.getByTestId('family-archive-empty')).toHaveText('This family archive is not available');
  });

  test('admin upload happy path creates a browsable archive', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/family-archives');
    await expect(page.getByTestId('archive-row-ferland')).toBeVisible();
    await page.getByLabel('Family id (slug)').fill('test');
    await page.getByLabel('Title').fill('Test Family');
    await page.getByLabel('Published').check();
    await page.getByTestId('archive-json-input').fill(smallJson);
    await expect(page.getByTestId('archive-preview-count')).toHaveText('2 people');
    await page.getByTestId('archive-confirm').click();
    await expect(page.getByTestId('archive-success')).toContainText('2 people');
    await page.goto('/families/test');
    await expect(page.locator('.family-title')).toHaveText('Test Family');
    await expect(page.getByTestId('family-unit-t-1')).toBeVisible();
    await expect(page.getByTestId('family-unit-t-2')).toBeVisible();
  });

  test('upload validation errors leave existing data unchanged', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/family-archives');
    const before = await readDb('familyArchive/ferland');
    const cases: Array<[string, string, string]> = [
      ['ferland', 'Ferland Family', '{not json'],
      ['ferland', 'Ferland Family', JSON.stringify([
        { id: 'x-1', name: 'Dup' },
        { id: 'x-1', name: 'Dup' },
      ])],
      ['Test!', 'Ferland Family', smallJson],
      ['ferland', '', smallJson],
    ];
    for (const [familyId, title, json] of cases) {
      await page.getByLabel('Family id (slug)').fill(familyId);
      await page.getByLabel('Title').fill(title);
      await page.getByTestId('archive-json-input').fill(json);
      await expect(page.getByTestId('archive-form-error')).toBeVisible();
      await expect(page.getByTestId('archive-confirm')).toBeDisabled();
    }
    expect(await readDb('familyArchive/ferland')).toEqual(before);
  });

  test('replacing an archive updates the person count', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/families/ferland');
    await expect(units(page)).toHaveCount(8);
    await page.goto('/admin/family-archives');
    await page.getByLabel('Family id (slug)').fill('ferland');
    await page.getByLabel('Title').fill('Ferland Family');
    await page.getByLabel('Published').check();
    await page.getByTestId('archive-json-input').fill(replaceJson);
    await expect(page.getByTestId('archive-preview-count')).toHaveText('3 people');
    await page.getByTestId('archive-confirm').click();
    await expect(page.getByTestId('archive-success')).toContainText('3 people');
    await page.goto('/families/ferland');
    await expect(units(page)).toHaveCount(3);
    await expect(page.getByTestId('family-unit-fa-10')).toBeVisible();
  });

  // Case 12 (no console errors) is enforced by the fixture's shared afterEach
  // collector for every test above.
  test('pages load without console errors', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/families/ferland');
    await expect(units(page).first()).toBeVisible();
    await page.goto('/admin/family-archives');
    await expect(page.getByTestId('archive-row-ferland')).toBeVisible();
  });
});
