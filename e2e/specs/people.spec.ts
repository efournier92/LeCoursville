import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('people', () => {
  test('list renders the 6 seeded people grouped by family', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown').first()).toBeVisible();
    await expect(page.getByText('Carol Clark').first()).toBeVisible();
    await expect(page.getByText('Dave Davis').first()).toBeVisible();
    await expect(page.getByText('Edith Evans').first()).toBeVisible();
    await expect(page.getByText('Frank Foster').first()).toBeVisible();
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

  test('family filter still filters the list', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    await page.locator('.family-filter-form-field mat-select').click({ force: true });
    await page.getByRole('option', { name: 'Mignonne' }).click();
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('?family= applies the family filter', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people?family=Mignonne');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('?clan= alias applies the filter and rewrites the URL to family', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people?clan=Mignonne');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
    await page.waitForFunction(() => {
      const params = new URLSearchParams(location.search);
      return params.get('family') === 'Mignonne' && !params.has('clan');
    });
  });

  test('person detail modal opens and shows name and family', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    await page.getByText('Alice Anderson').first().click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
    await expect(page.locator('app-person-detail-modal')).toContainText('Mignonne');
  });

  test('person modal close glyph is centred in its icon button', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    await page.getByText('Alice Anderson').first().click();
    const button = page.locator('app-person-detail-modal .close-button');
    await expect(button).toBeVisible();

    const offset = await button.evaluate((btn) => {
      const icon = btn.querySelector('.mat-icon')!.getBoundingClientRect();
      const box = btn.getBoundingClientRect();
      return {
        x: icon.x + icon.width / 2 - (box.x + box.width / 2),
        y: icon.y + icon.height / 2 - (box.y + box.height / 2),
      };
    });
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(1);
  });

  test('hovering a tree row underlines the name without a background fill', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    const row = page.locator('.tree-row', { hasText: 'Edith Evans' });
    const name = row.locator('.person-name');
    const before = await row.evaluate(el => getComputedStyle(el).backgroundColor);

    await row.hover();

    await expect(name).toHaveCSS('text-decoration-line', 'underline');
    const after = await row.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(after).toBe(before);
  });

  test('deceased person modal hides Contact and shows the Died row', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/people');
    await page.getByText('Edith Evans').first().click();
    const modal = page.locator('app-person-detail-modal');
    await expect(modal.locator('h2')).toContainText('Edith Evans');
    await expect(modal.getByText('Contact', { exact: true })).toHaveCount(0);
    await expect(modal.getByText('Died', { exact: true })).toBeVisible();
    await expect(modal).toContainText('June 15, 2015');
  });
});
