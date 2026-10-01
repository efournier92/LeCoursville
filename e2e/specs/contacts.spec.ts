import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

// The contacts page is a people-derived directory (people + clans in RTDB).
// The legacy `contacts` node is not read by the current UI.

test.describe('contacts', () => {
  test('list renders the seeded people as contact cards', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown').first()).toBeVisible();
    await expect(page.getByText('Carol Clark').first()).toBeVisible();
    await expect(page.getByText('Dave Davis').first()).toBeVisible();
  });

  test('search filters the list by name substring', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.getByLabel('Filter').fill('Alice');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('empty state: nonsense search shows no-results message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.getByLabel('Filter').fill('zzznope');
    await expect(page.getByText('Nothing found')).toBeVisible();
  });

  test('clan filter narrows the list', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.locator('.family-filter-form-field mat-select').click({ force: true });
    await page.getByRole('option', { name: 'Mignonne' }).click();
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('contact detail: clicking a name opens the person modal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    const aliceCard = page.locator('.contact-card', { hasText: 'Alice Anderson' }).first();
    await aliceCard.locator('.clickable-name').first().click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
    await expect(page.locator('app-person-detail-modal')).toContainText('Mignonne');
  });
});
