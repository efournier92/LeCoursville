import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';
import { uidForEmail } from '../helpers/rules';
import { FERLAND_ARCHIVE, WOLF_ARCHIVE } from '../../scripts/e2e/seed-fixtures.mjs';

// Two-person blob satisfying parseFamilyPeople; ids are unique to this spec.
const uploadJson = JSON.stringify([
  { id: 'tx-1', given: 'Tessa', surname: 'Transplant', name: 'Tessa Transplant' },
  { id: 'tx-2', given: 'Theo', surname: 'Transplant', name: 'Theo Transplant' },
]);

test.describe('admin family explorer', () => {
  test.afterEach(async () => {
    await deleteDb('familyExplorer/test-family');
    await writeDb('familyExplorer/wolf/published', false);
  });

  test('renders two surfaced cards with the shared 16px stack and Title Case copy', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/family-explorer');
    await expect(page.getByTestId('archive-row-ferland')).toBeVisible();

    const cards = page.locator('.admin-surface');
    await expect(cards).toHaveCount(2);
    const gaps = await page.locator('.admin-surface').evaluateAll((surfaces) => {
      const values: number[] = [];
      for (let i = 0; i < surfaces.length - 1; i += 1) {
        if (surfaces[i].nextElementSibling !== surfaces[i + 1]) continue;
        const above = surfaces[i].getBoundingClientRect();
        const below = surfaces[i + 1].getBoundingClientRect();
        values.push(Math.round(below.top - above.bottom));
      }
      return values;
    });
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap).toBe(16);
    }

    await expect(page.locator('.page-toolbar-title')).toHaveText('Family Explorer');
    await expect(page.locator('.admin-intro')).toContainText('Manage Family Explorer.');
    await expect(page.locator('.admin-intro')).not.toContainText('Family Archives');
    await expect(page.locator('.admin-card-title')).toHaveText(['Archives', 'Upload Archive']);
    await expect(page.getByLabel('Family ID')).toBeVisible();
    await expect(page.getByLabel('Family ID (slug)')).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Family ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Published' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Updated' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Upload' })).toBeVisible();
    await expect(page.getByTestId('archive-confirm')).toHaveText('Confirm Upload');
  });

  test('publish toggle flips the switch and the stored flag', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/family-explorer');

    const toggle = page.getByRole('switch', { name: 'Publish Wolf Family' });
    await expect(page.getByTestId('archive-row-wolf')).toContainText('Not yet updated');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(await readDb('familyExplorer/wolf/published')).toBe(true);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await readDb('familyExplorer/wolf/published')).toBe(false);
  });

  test('upload shows a live status banner and adds the new row', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/family-explorer');

    await page.getByLabel('Family ID').fill('test-family');
    await page.getByLabel('Title').fill('Test');
    await page.getByTestId('archive-json-input').fill(uploadJson);
    await expect(page.getByTestId('archive-preview-count')).toHaveText('2 people');

    await page.getByTestId('archive-confirm').click();

    const banner = page.getByTestId('archive-success');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('role', 'status');
    await expect(banner).toBeFocused();
    await expect(banner).toContainText('Uploaded the Test archive with 2 people.');

    const row = page.getByTestId('archive-row-test-family');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Test');
  });

  test('an invalid slug shows an inline error and blocks the upload', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/family-explorer');

    const before = await readDb('familyExplorer');
    await page.getByLabel('Family ID').fill('Bad Slug!');
    await page.getByLabel('Title').fill('Bad');
    await page.getByTestId('archive-json-input').fill(uploadJson);

    const uploadCard = page.locator('mat-card', { hasText: 'Upload Archive' });
    const error = uploadCard.getByTestId('archive-form-error');
    await expect(error).toContainText(
      'Family ID must be lowercase letters, numbers, and dashes.',
    );
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(page.getByRole('button', { name: 'Confirm Upload' })).toBeDisabled();
    expect(await readDb('familyExplorer')).toEqual(before);
  });

  test('re-uploading a published archive keeps it published', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/family-explorer');
    await expect(page.getByTestId('archive-row-ferland')).toBeVisible();

    const ferland = FERLAND_ARCHIVE(Date.now(), 'seed-fixture');
    await page.getByLabel('Family ID').fill('ferland');
    await page.getByLabel('Title').fill('Ferland Family');
    await expect(page.getByRole('checkbox', { name: 'Published' })).toBeChecked();
    await page
      .getByTestId('archive-json-input')
      .fill(JSON.stringify({ people: Object.values(ferland.people) }));
    await expect(page.getByTestId('archive-preview-count')).toHaveText('9 people');

    await page.getByTestId('archive-confirm').click();
    await expect(page.getByTestId('archive-success')).toBeVisible();

    const toggle = page.getByRole('switch', { name: 'Publish Ferland Family' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('archive-row-ferland')).toContainText('Ferland Family');
  });

  test('shows the empty state inside the Archives card when no archives exist', async ({ page }) => {
    await deleteDb('familyExplorer');
    try {
      await login(page, 'admin');
      await page.goto('/admin/family-explorer');
      const archivesCard = page.locator('mat-card', { hasText: 'Archives' });
      await expect(archivesCard.getByTestId('archive-empty')).toBeVisible();
    } finally {
      // family-explorer.spec.ts runs after this file and needs both archives
      // restored exactly as the seed wrote them (ferland full, wolf sans updatedAt).
      const adminUid = await uidForEmail('admin@e2e.local');
      await writeDb('familyExplorer', {
        ferland: FERLAND_ARCHIVE(Date.now(), adminUid),
        wolf: WOLF_ARCHIVE(adminUid),
      });
    }
  });
});
