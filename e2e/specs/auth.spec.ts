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

  test('returning user at the base page never sees the login form', async ({ page }) => {
    await login(page, 'user');
    // Hold RTDB so the reload boots with a cached session whose record
    // cannot land: the sign-in page must hold its interstitial instead of
    // flashing the login form (or the account card) before redirecting.
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    await page.routeWebSocket(/ws:\/\/[^/]*:9000\/.*/, async ws => {
      await gate;
      ws.connectToServer();
    });

    await page.goto('/');
    await expect(page.getByTestId('auth-email')).toHaveCount(0);
    await expect(page.getByTestId('session-interstitial')).toBeVisible();

    release();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.getByTestId('session-interstitial')).toHaveCount(0);
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

  test('login page shows a labelled Google button', async ({ page }) => {
    await page.goto('/');
    const google = page.getByTestId('auth-google');
    await expect(google).toBeVisible();
    await expect(google).toContainText('Continue with Google');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });

  test('signed-in email/password user sees Connect Google on the account page', async ({ page }) => {
    await login(page, 'user');
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('account-connect-google')).toBeVisible();
    await expect(page.getByTestId('account-connect-google')).toContainText('Connect Google');
  });
});

// The Auth emulator cannot complete a real Google OAuth handshake, but it can
// prove the fallback choice: when the popup cannot open, or the browser is a
// known in-app browser, the SDK must navigate to the redirect handler instead
// of surfacing an error. The handler navigation is stubbed so the redirect
// stays parked and observable.
test.describe('google redirect fallback', () => {
  async function stubHandler(page: import('@playwright/test').Page) {
    await page.route('**/emulator/auth/handler**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html>handler</html>' }),
    );
  }

  test('popup-blocked falls back to signInWithRedirect', async ({ page }) => {
    await stubHandler(page);
    await page.addInitScript(() => {
      window.open = () => null;
    });
    await page.goto('/');
    await page.getByTestId('auth-google').click();
    await expect.poll(() => page.url()).toContain('/emulator/auth/handler');
  });

  test.describe('mobile in-app browser', () => {
    test.use({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/400.0.0.0.0]',
    });

    test('skips the popup and uses signInWithRedirect', async ({ page }) => {
      await stubHandler(page);
      await page.goto('/');
      await page.getByTestId('auth-google').click();
      await expect.poll(() => page.url()).toContain('/emulator/auth/handler');
    });
  });
});
