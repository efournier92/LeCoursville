import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { expectNoHorizontalOverflow } from '../helpers/overflow';

// The contacts page is a people-derived directory (people + families in RTDB).
// The legacy `contacts` node is not read by the current UI.

test.describe('contacts', () => {
  test('top bars do not overflow horizontally at 900px and 768px', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    try {
      for (const width of [900, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/contacts');
        await expectNoHorizontalOverflow(page.locator('app-page-toolbar .page-toolbar'));
        await expectNoHorizontalOverflow(page.locator('mat-toolbar'));
      }
    } finally {
      await page.setViewportSize(original);
    }
  });

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
    await expect(
      page.getByText('We couldn\'t find any contacts matching "zzznope".'),
    ).toBeVisible();
  });

  test('family filter narrows the list', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.locator('.family-filter-form-field mat-select').click({ force: true });
    await page.getByRole('option', { name: 'Mignonne' }).click();
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('?clan= alias applies the family filter', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts?clan=Mignonne');
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
