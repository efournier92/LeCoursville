import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('people', () => {
  test('list renders the 4 seeded people grouped by family', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown').first()).toBeVisible();
    await expect(page.getByText('Carol Clark').first()).toBeVisible();
    await expect(page.getByText('Dave Davis').first()).toBeVisible();
    await expect(page.getByText(/Mignonne's Family/)).toBeVisible();
    await expect(page.getByText(/Denis's Family/)).toBeVisible();
  });

  test('search narrows the list', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    await page.getByLabel('Filter').fill('Alice');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('person detail modal opens and shows name and clan', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    await page.getByText('Alice Anderson').first().click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
    await expect(page.locator('app-person-detail-modal')).toContainText('Mignonne');
  });
});
