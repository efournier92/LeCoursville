import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { logout } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';
import { writeDb } from '../helpers/admin-db';

test.describe('feature flags', () => {
  // Chat is seeded OFF; the mutation test turns it ON, so restore through the
  // Admin SDK regardless of the page state the test ended in.
  test.afterEach(async () => {
    await writeDb('features/chat/enabled', false);
  });

  test('disabled feature: /chat redirects to the feature-disabled page', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/feature-disabled/);
    // mat-card-title is not a heading role; assert the card title text.
    await expect(page.locator('.disabled-card').getByText('Feature Disabled')).toBeVisible();
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

  test('mutation: admin toggles chat ON and the chat page renders', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    await expect(page.getByRole('button', { name: 'New Message' }).first()).toBeVisible();
  });
});

test.describe('photo-albums flag and the photos-legacy fallback', () => {
  test.afterEach(async () => {
    await writeDb('features/enablePhotoAlbums/enabled', true);
  });

  test('flag off hides Photo Albums in the admin nav (visibleAdminNav filter)', async ({ page }) => {
    await writeDb('features/enablePhotoAlbums/enabled', false);
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByTestId('admin-nav')).toBeVisible();
    await expect(page.getByTestId('admin-nav-link-photoAlbums')).toHaveCount(0);
    // The unflagged Contacts entry is unaffected.
    await expect(page.getByTestId('admin-nav-link-contacts')).toBeVisible();
  });

  test('flag off renders photos-legacy with its admin edit controls; album view is read-only', async ({ page }) => {
    await writeDb('features/enablePhotoAlbums/enabled', false);
    await login(page, 'admin');
    await page.goto('/photos');
    // Decision 3 exception made visible: the legacy fallback still routes and
    // still shows its role-gated Add Photos control for admins.
    await expect(page.locator('app-photos-legacy')).toBeVisible();
    await expect(page.locator('.photos-upload-button')).toBeVisible();

    // A member sees the legacy view without the admin controls.
    // The legacy view has no navbar chrome; go to the landing page (navbar
    // present) and then the Account page, the only home of Sign out.
    await page.goto('/');
    await page.getByRole('button', { name: 'Account' }).click();
    await logout(page);
    await login(page, 'user');
    await page.goto('/photos');
    await expect(page.locator('app-photos-legacy')).toBeVisible();
    await expect(page.locator('.photos-upload-button')).toHaveCount(0);
  });

  test('flag on renders the read-only album grid', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/photos');
    await expect(page.locator('app-photo-albums')).toBeVisible();
    await expect(page.locator('app-photos-legacy')).toHaveCount(0);
  });
});
