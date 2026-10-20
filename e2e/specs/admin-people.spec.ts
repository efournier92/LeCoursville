import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.afterEach(async ({ collector }) => collector.assertClean());

test.describe('admin people surfaces', () => {
  test('users page lists the seeded users, filters, and shows the range', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');

    await expect(page.locator('app-user-edit')).toHaveCount(5, { timeout: 20000 });
    const pagination = page.locator('.admin-pagination');
    await expect(pagination).toContainText('Showing 1-5 of 5');

    await page.getByTestId('admin-users-filter').fill('Sparse');
    await expect(page.locator('app-user-edit')).toHaveCount(1);
    await expect(page.locator('input[name="user-name"]')).toHaveValue('Sparse User');
    await expect(pagination).toContainText('Showing 1-1 of 1');
  });

  test('families delete asks for confirmation and cancel keeps the row', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/families');

    const rows = page.locator('.families-table tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 20000 });

    await page.getByRole('button', { name: 'Delete Mignonne' }).click();
    await expect(page.getByRole('heading', { name: 'Delete family?' })).toBeVisible();
    await expect(page.getByText('Delete family Mignonne? This cannot be undone.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('button', { name: 'Delete Mignonne' })).toBeVisible();
    await expect(rows).toHaveCount(2);
    await expect(page.locator('app-no-results-message')).toHaveCount(0);
  });

  test('a family created through the UI can be deleted after confirming', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/families');
    await expect(page.locator('.families-table tbody tr')).toHaveCount(2, { timeout: 20000 });

    await page.getByRole('button', { name: 'Add Family' }).click();
    await page.getByLabel('ID').fill('zeta-e2e');
    await page.getByLabel('Name').fill('Zeta E2E');
    await page.getByLabel('Hex Color').fill('#123456');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    const created = page.locator('.families-table tbody tr').filter({ hasText: 'Zeta E2E' });
    await expect(created).toHaveCount(1);

    await page.getByRole('button', { name: 'Delete Zeta E2E' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(created).toHaveCount(0);
    await expect(page.locator('.families-table tbody tr')).toHaveCount(2);
  });

  test('people import previews the CSV and reports the busy state while importing', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/people');

    const csv = [
      'ID,Name_First_Given,Name_First_Preferred,Name_Last,Birthday,Generation_Number,Living?,Address_Street,Family',
      'people-e2e-1,Zoe,Zoe,Zimmerman,1990-01-15,1,TRUE,123 E2E St,Mignonne',
      'people-e2e-2,Yuri,Yuri,Zimmerman,1991-02-16,1,TRUE,124 E2E St,Mignonne',
    ].join('\n');

    await page.getByTestId('import-file').setInputFiles({
      name: 'people.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText('Import Preview')).toBeVisible();
    await expect(page.getByText('To Create').first()).toBeVisible();

    const headers = await page.locator('.preview-card .admin-table thead th').allTextContents();
    expect(headers).toEqual([
      'ID',
      'First Given',
      'First Preferred',
      'Maiden',
      'Last',
      'Suffix',
      'Birthday',
      'Anniversary',
      'Spouse',
      'Gen',
      'Living',
      'Direct',
      'Street',
      'City',
      'State',
      'Zip',
    ]);

    await page.evaluate(() => {
      (window as any).__sawImportBusy = false;
      const button = document.querySelector('[data-testid="import-confirm"]');
      const card = document.querySelector('.preview-card');
      const observer = new MutationObserver(() => {
        if ((button as HTMLButtonElement)?.disabled || card?.getAttribute('aria-busy') === 'true') {
          (window as any).__sawImportBusy = true;
        }
      });
      observer.observe(button!, { attributes: true, attributeFilter: ['disabled'] });
      observer.observe(card!, { attributes: true, attributeFilter: ['aria-busy'] });
    });

    await page.getByTestId('import-confirm').click();
    await expect(page.getByText('Import Complete')).toBeVisible({ timeout: 15000 });

    expect(await page.evaluate(() => (window as any).__sawImportBusy)).toBe(true);
  });

  test('families render as cards at 390px with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');
    await page.goto('/admin/families');

    const rows = page.locator('.families-table tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 20000 });
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('.families-table thead')).toBeHidden();

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);
  });
});
