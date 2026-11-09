import { test, expect } from '../helpers/fixture';
import { login, logout, E2E_USERS } from '../helpers/auth';
import { deleteDb, findOutboundEmails, readDb } from '../helpers/admin-db';

const E2E_API_KEY = 'AIzaSyDBhEg8J_knZVdhEWCIbtcKJak3glu_TKA';
const DB_NS = 'ns=lecoursville-dev-default-rtdb';

async function signUpNewAccount(email: string): Promise<{ uid: string; token: string }> {
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'E2e-pass-2026', returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!body.localId || !body.idToken) {
    throw new Error(`signUp failed: ${JSON.stringify(body)}`);
  }
  return { uid: body.localId, token: body.idToken };
}

async function deleteAuthAccount(token: string): Promise<void> {
  await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:delete?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    },
  );
}

/** True when the auth emulator still has an account for this email/password. */
async function accountExists(email: string): Promise<boolean> {
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'E2e-pass-2026', returnSecureToken: true }),
    },
  );
  return res.ok;
}

/** Removes every trace a signup may have left, including audit and rate limits. */
async function cleanupSignup(email: string): Promise<void> {
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'E2e-pass-2026', returnSecureToken: true }),
    },
  );
  const body = await res.json();
  const uid = body.localId as string | undefined;
  if (uid) {
    await deleteDb(`users/${uid}`);
    await deleteDb(`rateLimits/accountCreatedNotify/${uid}`);
  }
  if (body.idToken) {
    await deleteAuthAccount(body.idToken);
  }
  for (const mail of await findOutboundEmails('account_created')) {
    if ((mail.text ?? '').includes(email)) {
      await deleteDb(`outboundEmails/${mail.key}`);
    }
  }
  const audit = (await readDb<Record<string, { email?: string }>>('recoveryAudit')) ?? {};
  for (const [key, entry] of Object.entries(audit)) {
    if (entry?.email === email) {
      await deleteDb(`recoveryAudit/${key}`);
    }
  }
}

test.describe('auth', () => {
  test('anonymous redirect: /contacts lands on the sign-in page', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('anonymous unknown URL still shows the sign-in page', async ({ page }) => {
    await page.goto('/definitely-not-a-route');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('auth-email')).toBeVisible();
  });

  test('signed-in unknown URL shows the not-found card with a route home', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/definitely-not-a-route');
    await expect(page.getByTestId('not-found-card')).toBeVisible();
    await expect(page).toHaveURL('/definitely-not-a-route');
    await page.getByTestId('not-found-cta').click();
    await expect(page).toHaveURL('/calendar');
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

  test('password toggle reveals and re-hides the password', async ({ page }) => {
    await page.goto('/');
    const password = page.getByTestId('auth-password');
    await password.fill('secret-one');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByTestId('auth-password-toggle').click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByTestId('auth-password-toggle').click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('password toggle is inset from the field edge', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByTestId('auth-password-toggle');
    const field = page.locator('.auth-field').filter({ has: page.getByTestId('auth-password') });
    const toggleBox = await toggle.boundingBox();
    const fieldBox = await field.boundingBox();
    expect(toggleBox && fieldBox).toBeTruthy();
    const inset = fieldBox!.x + fieldBox!.width - (toggleBox!.x + toggleBox!.width);
    expect(inset, 'toggle right edge inset from the field box').toBeGreaterThanOrEqual(4);
  });

  test('missing fields shows the validation error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText('Enter your email and password.');
  });

  test('sign out returns to the sign-in page and re-protects routes', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/calendar/);
    // The Sign out button lives on the Account page (route '/account').
    await page.getByRole('link', { name: 'Account' }).click();
    await expect(page).toHaveURL('/account');
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

  test('account action bar spaces the theme toggle evenly and Sign Out is neutral', async ({ page }) => {
    await login(page, 'user');
    await page.getByRole('link', { name: 'Account' }).click();
    const edit = page.getByRole('button', { name: 'Edit profile' });
    const out = page.getByRole('button', { name: 'Sign Out', exact: true });
    await expect(out).toHaveAccessibleName('Sign Out');
    const chip = page.locator('.account-theme-pref');
    const [e, c, o] = await Promise.all([edit.boundingBox(), chip.boundingBox(), out.boundingBox()]);
    expect(e && c && o).toBeTruthy();
    // Same row: vertical centers align.
    const cy = (b: { y: number; height: number }) => b.y + b.height / 2;
    expect(Math.abs(cy(e!) - cy(c!))).toBeLessThanOrEqual(1);
    expect(Math.abs(cy(c!) - cy(o!))).toBeLessThanOrEqual(1);
    // Equal gaps left and right of the whole chip.
    const left = c!.x - (e!.x + e!.width);
    const right = o!.x - (c!.x + c!.width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    // The chip is horizontally centered in the card.
    const card = await page.locator('.auth-card--account').boundingBox();
    expect(Math.abs((c!.x + c!.width / 2) - (card!.x + card!.width / 2))).toBeLessThanOrEqual(2);
    // Sign Out no longer uses brand green in light theme.
    const color = await out.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(91, 100, 112)'); // --color-ink-2 light
  });

  test('signed-in email/password user sees their profile on the account page', async ({ page }) => {
    await login(page, 'user');
    await page.getByRole('link', { name: 'Account' }).click();
    await expect(page).toHaveURL('/account');
    await expect(page.locator('.account-name')).toHaveText('Regular User');
    await expect(page.locator('.account-email')).toHaveText(E2E_USERS.user.email);
    await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.locator('.user-edit-display-field').filter({ hasText: 'Email' }))
      .toContainText(E2E_USERS.user.email);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test('sign-in card orders email above Google and uses the exact copy', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
    await expect(page.getByText('Welcome To LeCoursville', { exact: true })).toBeVisible();
    await expect(page.getByTestId('auth-submit')).toHaveText('Sign In');
    await expect(page.getByTestId('auth-mode-signin')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('auth-mode-create')).toHaveAttribute('aria-selected', 'false');
    const emailBox = (await page.getByTestId('auth-email').boundingBox())!;
    const googleBox = (await page.getByTestId('auth-google').boundingBox())!;
    expect(emailBox.y, 'email field renders above the Google button').toBeLessThan(googleBox.y);
  });

  test('mode tabs expose tab semantics, roving tabindex, and arrow navigation', async ({ page }) => {
    await page.goto('/');
    const signin = page.getByTestId('auth-mode-signin');
    const create = page.getByTestId('auth-mode-create');

    await expect(signin).toHaveAttribute('role', 'tab');
    await expect(signin).toHaveAttribute('aria-controls', 'auth-tabpanel');
    await expect(signin).toHaveAttribute('tabindex', '0');
    await expect(create).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'auth-tab-signin');

    await signin.focus();
    await page.keyboard.press('ArrowRight');
    await expect(create).toHaveAttribute('aria-selected', 'true');
    await expect(create).toBeFocused();
    await expect(create).toHaveAttribute('tabindex', '0');
    await expect(signin).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'auth-tab-create');

    await page.keyboard.press('ArrowLeft');
    await expect(signin).toHaveAttribute('aria-selected', 'true');
    await expect(signin).toBeFocused();
  });

  test('create mode keeps recovery links and shows the pending notice', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-mode-create').click();
    await expect(page.getByTestId('auth-pending-notice')).toContainText('pending until an admin approves');
    await expect(page.getByTestId('auth-forgot')).toBeVisible();
    await expect(page.getByTestId('auth-recovery-open')).toBeVisible();

    await page.getByTestId('auth-mode-signin').click();
    await expect(page.getByTestId('auth-pending-notice')).toHaveCount(0);
  });

  test('form errors are announced by role and associated with the failing field', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-mode-create').click();
    await page.getByTestId('auth-name').fill('Error Probe');
    await page.getByTestId('auth-email').fill(`error-${Date.now()}@e2e.local`);
    await page.getByTestId('auth-password').fill('E2e-pass-2026');
    await page.getByTestId('auth-confirm-password').fill('E2e-pass-2027');
    await page.getByTestId('auth-submit').click();

    const error = page.getByTestId('auth-error');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toContainText('Passwords do not match.');
    await expect(page.getByTestId('auth-confirm-password')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('auth-confirm-password')).toHaveAttribute(
      'aria-describedby',
      'auth-error-message',
    );
    await expect(page.getByTestId('auth-email')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('auth-email')).not.toHaveAttribute('aria-describedby', 'auth-error-message');
  });

  test('confirm password has its own visibility toggle', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-mode-create').click();
    const confirm = page.getByTestId('auth-confirm-password');
    const password = page.getByTestId('auth-password');
    await confirm.fill('E2e-pass-2026');
    await expect(confirm).toHaveAttribute('type', 'password');
    await page.getByTestId('auth-confirm-password-toggle').click();
    await expect(confirm).toHaveAttribute('type', 'text');
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('create account writes the bound profile, stays pending, and survives reload', async ({ page }) => {
    const email = `new-account-${Date.now()}@e2e.local`;
    const name = 'New E2E Person';
    try {
      await page.goto('/');
      await page.getByTestId('auth-mode-create').click();
      await expect(page.getByRole('heading', { name: 'Create Account', exact: true })).toBeVisible();
      await page.getByTestId('auth-name').fill(name);
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-password').fill('E2e-pass-2026');
      await page.getByTestId('auth-confirm-password').fill('E2e-pass-2026');
      await page.getByTestId('auth-submit').click();
      await expect(page).toHaveURL('/photos');
      await expect(page.getByRole('status').filter({ hasText: /pending approval/i })).toBeVisible();
      await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();

      const uid = await page.evaluate(
        () => JSON.parse(localStorage.getItem('user') || 'null')?.id as string | undefined,
      );
      expect(uid, 'signup must cache its uid').toBeTruthy();
      // The profile write must actually land, bound to the auth uid and name.
      expect(await readDb<Record<string, any>>(`users/${uid}`)).toMatchObject({
        id: uid,
        email,
        name,
      });

      // Reload: the session must resolve to the same pending record, with no
      // membership granted behind the banner's back.
      await page.reload();
      await expect(page).toHaveURL('/photos');
      await expect(page.getByRole('status').filter({ hasText: /pending approval/i })).toBeVisible();
      expect(await readDb(`users/${uid}/roles/user`)).not.toBe(true);
      expect(await readDb<Record<string, any>>(`users/${uid}`)).toMatchObject({ id: uid, name });
    } finally {
      await cleanupSignup(email);
    }
  });

  test('mode tabs are disabled while the create request is in flight', async ({ page }) => {
    const email = `inflight-${Date.now()}@e2e.local`;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/accounts:signUp**', async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.goto('/');
      await page.getByTestId('auth-mode-create').click();
      await page.getByTestId('auth-name').fill('In Flight');
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-password').fill('E2e-pass-2026');
      await page.getByTestId('auth-confirm-password').fill('E2e-pass-2026');
      await page.getByTestId('auth-submit').click();

      await expect(page.getByTestId('auth-mode-signin')).toBeDisabled();
      await expect(page.getByTestId('auth-mode-create')).toBeDisabled();

      release();
      await expect(page).toHaveURL('/photos');
    } finally {
      release();
      await cleanupSignup(email);
    }
  });

  test('create account rejects a short password and a mismatch without creating an account', async ({ page }) => {
    const email = `weak-${Date.now()}@e2e.local`;
    try {
      await page.goto('/');
      await page.getByTestId('auth-mode-create').click();
      await page.getByTestId('auth-name').fill('Weak Probe');
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-password').fill('short7');
      await page.getByTestId('auth-confirm-password').fill('short7');
      await page.getByTestId('auth-submit').click();
      await expect(page.getByTestId('auth-error')).toContainText('at least 8 characters');
      // The component never reaches Firebase, so no auth account may exist.
      expect(await accountExists(email)).toBe(false);

      await page.getByTestId('auth-password').fill('E2e-pass-2026');
      await page.getByTestId('auth-confirm-password').fill('E2e-pass-2027');
      await page.getByTestId('auth-submit').click();
      await expect(page.getByTestId('auth-error')).toContainText('Passwords do not match.');
      await expect(page).toHaveURL('/');
      expect(await accountExists(email)).toBe(false);
    } finally {
      await cleanupSignup(email);
    }
  });

  test('create account with an existing email shows a friendly error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-mode-create').click();
    await page.getByTestId('auth-name').fill('Duplicate Probe');
    await page.getByTestId('auth-email').fill(E2E_USERS.user.email);
    await page.getByTestId('auth-password').fill(E2E_USERS.user.password);
    await page.getByTestId('auth-confirm-password').fill(E2E_USERS.user.password);
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText(
      'An account already exists for that email.',
    );
    await expect(page).toHaveURL('/');
  });

  test('new account: signup stays pending and the client cannot write roles', async () => {
    const email = `signup-${Date.now()}@e2e.local`;
    const { uid, token } = await signUpNewAccount(email);
    const userUrl = `http://localhost:9000/users/${uid}.json?${DB_NS}&auth=${token}`;

    try {
      const withRoles = await fetch(userUrl, {
        method: 'PUT',
        body: JSON.stringify({ id: uid, email, name: 'New Signup', roles: { user: true } }),
      });
      expect(withRoles.status).not.toBe(200);
      expect(await readDb(`users/${uid}`)).toBeNull();

      const directRole = await fetch(
        `http://localhost:9000/users/${uid}/roles/user.json?${DB_NS}&auth=${token}`,
        { method: 'PUT', body: 'true' },
      );
      expect(directRole.status).not.toBe(200);
      expect(await readDb(`users/${uid}/roles/user`)).toBeNull();

      const profile = await fetch(userUrl, {
        method: 'PUT',
        body: JSON.stringify({
          id: uid,
          email,
          name: 'New Signup',
          dateRegistered: Date.now(),
          dateLastActive: Date.now(),
        }),
      });
      expect(profile.ok).toBe(true);

      // Wait for the account-created hook to fully process the record, then
      // run the signup callable: neither may grant membership any more.
      await expect
        .poll(
          async () =>
            (await findOutboundEmails('account_created')).some((mail) =>
              (mail.text ?? '').includes(email),
            ),
          { timeout: 20000 },
        )
        .toBe(true);

      const claim = await fetch(
        'http://localhost:5001/lecoursville-dev/us-central1/claimMemberRole',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data: {} }),
        },
      );
      expect(claim.ok).toBe(true);
      expect([null, false]).toContain(await readDb(`users/${uid}/roles/user`));
    } finally {
      await deleteDb(`users/${uid}`);
      await deleteAuthAccount(token);
    }
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
