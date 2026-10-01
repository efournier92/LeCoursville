import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';

test.describe('feature flags', () => {
  test('disabled feature: /chat redirects to the feature-disabled page', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/feature-disabled/);
    // mat-card-title is not a heading role; assert the card title text.
    await expect(page.locator('.disabled-card').getByText('Feature Disabled')).toBeVisible();
  });

  test('feature-disabled page renders its title and message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/chat');
    await expect(page.getByText(/feature is currently disabled/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go Home' })).toBeVisible();
  });

  test('enabled features render their pages', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await expect(page.locator('.page-toolbar-title', { hasText: 'Contacts' })).toBeVisible();
    await page.goto('/calendar');
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
    // enablePhotoAlbums is seeded true: /photos renders the album grid.
    await page.goto('/photos');
    await expect(page.getByText('E2E Album One')).toBeVisible();
  });

  test('mutation: admin toggles chat ON, chat page renders, state restored', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    await expect(page.getByRole('button', { name: 'New Message' }).first()).toBeVisible();
    // Restore: toggle chat back OFF.
    await setFeatureFlag(page, 'chat', false);
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/feature-disabled/);
  });
});
