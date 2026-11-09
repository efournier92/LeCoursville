import { test, expect, Page } from '../helpers/fixture';
import { deleteDb, findOutboundEmails, readDb, writeDb } from '../helpers/admin-db';

const E2E_API_KEY = 'AIzaSyDBhEg8J_knZVdhEWCIbtcKJak3glu_TKA';
const PASSWORD = 'E2e-pass-2026';

let email: string;
let uid: string;
let token: string;

async function signUpNewAccount(address: string): Promise<{ uid: string; token: string }> {
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address, password: PASSWORD, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!body.localId || !body.idToken) {
    throw new Error(`signUp failed: ${JSON.stringify(body)}`);
  }
  return { uid: body.localId, token: body.idToken };
}

async function deleteAuthAccount(t: string): Promise<void> {
  await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:delete?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: t }),
    },
  );
}

/** Signs in through the real form; the pending account lands on the pending route. */
async function signInAsPending(page: Page, expected = '/photos'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(PASSWORD);
  await page.getByTestId('auth-submit').click();
  await expect(page).toHaveURL(expected);
  await page.locator('#lecoursville-navbar-links').waitFor({ state: 'attached', timeout: 30000 });
}

test.beforeAll(async () => {
  email = `pending-${Date.now()}@e2e.local`;
  const account = await signUpNewAccount(email);
  uid = account.uid;
  token = account.token;
  // Authenticated, but membership has never been granted.
  await writeDb(`users/${uid}`, {
    id: uid,
    name: 'Pending E2E',
    email,
    roles: {},
    dateRegistered: Date.now(),
    dateLastActive: Date.now(),
  });
});

test.afterAll(async () => {
  await deleteDb(`users/${uid}`);
  await deleteAuthAccount(token);
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
});

test.describe('pending membership', () => {
  test('pending user lands on the pending promoted route, not the approved one', async ({ page }) => {
    const before = await readDb('promotedRoutePending');
    await writeDb('promotedRoutePending', { route: '/expressions', updatedAt: Date.now() });
    try {
      await signInAsPending(page, '/expressions');
    } finally {
      await writeDb('promotedRoutePending', before);
    }
  });

  test('pending user at / bounces to the pending route and the logo stays there', async ({ page }) => {
    await signInAsPending(page);

    await page.goto('/');
    await expect(page).toHaveURL('/photos');

    await page.locator('.toolbar-logo').click();
    await expect(page).toHaveURL('/photos');
  });

  test('pending user can open /account without a 404', async ({ page }) => {
    await signInAsPending(page);

    await page.goto('/account');
    await expect(page).toHaveURL('/account');
    await expect(page.locator('.auth-card--account')).toBeVisible();
    await expect(page.getByTestId('not-found-card')).toHaveCount(0);
  });

  test('pending 404 CTA names and opens the pending route', async ({ page }) => {
    await signInAsPending(page);

    await page.goto('/definitely-not-a-route');
    await expect(page.getByTestId('not-found-card')).toBeVisible();
    const cta = page.getByTestId('not-found-cta');
    await expect(cta).toContainText('Go to Photos');
    await cta.click();
    await expect(page).toHaveURL('/photos');
  });

  test('pending user can browse media and sees the pending banner', async ({ page }) => {
    await signInAsPending(page);
    await expect(page.getByRole('status').filter({ hasText: /pending approval/i })).toBeVisible();

    await page.goto('/media/explorer');
    await expect(page).toHaveURL(/\/media\/explorer$/);
    await expect(page.locator('.media-list-item').first()).toBeVisible();
  });

  test('pending user is redirected from People and Contacts to Media', async ({ page }) => {
    await signInAsPending(page);

    await page.goto('/people');
    await expect(page).toHaveURL('/media');

    await page.goto('/contacts');
    await expect(page).toHaveURL('/media');
  });

  test('pending user hitting /admin lands on the pending route, not the approved one', async ({ page }) => {
    await signInAsPending(page);

    await page.goto('/admin');
    await expect(page).toHaveURL('/photos');
  });

  test('pending user cannot reach songs or chat by direct URL', async ({ page }) => {
    await signInAsPending(page);

    await page.goto('/songs');
    await expect(page).toHaveURL('/media');

    await page.goto('/chat');
    await expect(page).toHaveURL('/media');
  });

  test('nav hides People, Contacts, and Calendar for a pending user', async ({ page }) => {
    await signInAsPending(page);
    const nav = page.locator('#lecoursville-navbar-links');
    await expect(nav).toBeVisible();

    await expect(nav.getByRole('button', { name: 'People' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Contacts' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Calendar' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Photos' })).toBeVisible();
  });
});
