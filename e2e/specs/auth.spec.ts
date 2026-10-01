import { test, expect } from '../helpers/fixture';
import { login, logout, E2E_USERS } from '../helpers/auth';

test.describe('auth', () => {
  test('anonymous redirect: /contacts lands on the sign-in page', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('login success (admin) lands on the promoted route /calendar', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-email').fill(E2E_USERS.admin.email);
    await page.getByTestId('auth-password').fill(E2E_USERS.admin.password);
    await page.getByTestId('auth-submit').click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();
  });

  test('login failure shows the error banner', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-email').fill(E2E_USERS.admin.email);
    await page.getByTestId('auth-password').fill('definitely-wrong');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText('Incorrect email or password.');
  });

  test('missing fields shows the validation error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText('Enter your email and password.');
  });

  test('sign out returns to the sign-in page and re-protects routes', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/calendar/);
    // The Sign out button lives on the Account page (route '/').
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page).toHaveURL('/');
    await logout(page);
    await expect(page).toHaveURL('/');
    // Protected route redirects again.
    await page.goto('/contacts');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('auth-email')).toBeVisible();
  });

  test('admin guard negative: non-admin cannot open /admin', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/admin');
    // Guard bounces to sign-in ('/'), which for a signed-in user resolves to
    // the promoted route (/calendar). The point: /admin must never render.
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page).toHaveURL(/\/calendar/);
  });
});
