import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('expressions', () => {
  test('list renders the 2 seeded expressions', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/expressions');
    await expect(page.getByText('Live long and prosper')).toBeVisible();
    await expect(page.getByText('Make it so')).toBeVisible();
  });

  test('create expression: admin creates one via the edit card', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/expressions');
    await page.getByRole('button', { name: 'Create Expression' }).click();
    await page.getByLabel('Expression').fill('E2E New Expression');
    await page.getByLabel('Attribution').fill('E2E Family');
    await page.getByLabel('Author').fill('E2E Author');
    await page.getByLabel('Year Written').fill('2026');
    await page.getByLabel('Description').fill('Created by the e2e gate.');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('E2E New Expression')).toBeVisible();
  });

  test('edit expression: change attribution/title, appears updated', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/expressions');
    const card = page.locator('.expression-card-wrapper', { hasText: 'Make it so' }).first();
    await card.locator('.expression-actions button').first().click();
    await page.getByLabel('Expression').fill('Make it so — e2e edit');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('Make it so — e2e edit')).toBeVisible();
  });

  test('empty state: nonsense search renders no-results message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/expressions');
    await page.getByLabel('Filter').fill('zzznope');
    await expect(page.getByText('Nothing found')).toBeVisible();
  });
});
