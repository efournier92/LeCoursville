import { test, expect, Page } from '../helpers/fixture';
import { login, logout, E2E_USERS } from '../helpers/auth';
import {
  readDb,
  writeDb,
  deleteDb,
  setUserPassword,
  findOutboundEmails,
  latestOutboundEmail,
} from '../helpers/admin-db';

const SEEDED_PASSWORD = E2E_USERS.user.password;

// Server-only rows created by these tests. afterEach deletes them so reruns in
// the same browser matrix stay deterministic (the gate re-seeds between
// projects, but not between specs).
let cleanup: string[] = [];

test.beforeEach(() => {
  cleanup = [];
});

test.afterEach(async () => {
  for (const path of cleanup.reverse()) {
    await deleteDb(path);
  }
  cleanup = [];
});

async function requestReset(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-forgot').click();
  await expect(page.getByTestId('auth-reset-info')).toBeVisible();
}

async function waitForResetLink(email: string): Promise<string> {
  await expect
    .poll(async () => (await latestOutboundEmail('password_reset', { to: email }))?.link ?? null, {
      timeout: 15000,
    })
    .not.toBeNull();
  const mail = await latestOutboundEmail('password_reset', { to: email });
  return mail!.link as string;
}

/**
 * The Auth emulator does not support handleCodeInApp: its reset link points at
 * the emulator's own action page, so the app would never run its handler.
 * Rebuild the app's /auth/action URL from the link's oobCode and mode.
 */
function appActionUrlFromResetLink(link: string): string {
  const params = new URL(link).searchParams;
  const mode = params.get('mode') ?? 'resetPassword';
  const code = params.get('oobCode') ?? '';
  return `http://localhost:5000/auth/action?mode=${mode}&oobCode=${code}`;
}

async function completeReset(page: Page, link: string, newPassword: string): Promise<void> {
  await page.goto(appActionUrlFromResetLink(link));
  await expect(page.getByTestId('auth-action-form')).toBeVisible();
  await page.getByTestId('auth-action-password').fill(newPassword);
  const confirm = page.getByTestId('auth-action-password-confirm');
  if (await confirm.count()) {
    await confirm.fill(newPassword);
  }
  await page.getByTestId('auth-action-submit').click();
  await expect(page.getByTestId('auth-action-success')).toBeVisible();
}

/** Deletes every password_reset email the test is about to create for `email`. */
async function trackResets(email: string): Promise<void> {
  for (const mail of await findOutboundEmails('password_reset', { to: email })) {
    cleanup.push(`outboundEmails/${mail.key}`);
  }
}

async function requestsFor(email: string) {
  const all = (await readDb<Record<string, any>>('recoveryRequests')) ?? {};
  return Object.entries(all)
    .filter(([, value]) => value?.email === email)
    .map(([key, value]) => ({ key, ...value }));
}

async function alertsFor(email: string) {
  const all = (await readDb<Record<string, any>>('adminAlerts')) ?? {};
  return Object.entries(all)
    .filter(([, value]) => value?.data?.email === email)
    .map(([key, value]) => ({ key, ...value }));
}

async function trackAlertRows(email: string): Promise<void> {
  for (const alert of await alertsFor(email)) {
    cleanup.push(`adminAlerts/${alert.key}`);
  }
  for (const mail of await findOutboundEmails('admin_alert')) {
    if ((mail.text ?? '').includes(email)) {
      cleanup.push(`outboundEmails/${mail.key}`);
    }
  }
}

async function addRecoveryRequest(page: Page, email: string, name: string, alternateContact?: string) {
  await page.goto('/');
  await page.getByTestId('auth-recovery-open').click();
  await expect(page.getByTestId('recovery-email')).toBeVisible();
  await page.getByTestId('recovery-email').fill(email);
  await page.getByTestId('recovery-name').fill(name);
  if (alternateContact) {
    await page.getByTestId('recovery-alt-contact').fill(alternateContact);
  }
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('recovery-confirmation')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
}

test.describe('account recovery', () => {
  test('login page shows Google, forgot-password, and recovery affordances', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('auth-google')).toBeVisible();
    await expect(page.getByTestId('auth-forgot')).toBeVisible();
    await expect(page.getByTestId('auth-recovery-open')).toBeVisible();
    await expect(page.getByTestId('auth-google')).toContainText('Continue with Google');
    // The recovery backstop is the prominent secondary action, not a buried link.
    await expect(page.getByTestId('auth-recovery-open')).toContainText('Get help signing in');
  });

  test('recovery dialog prefills the email typed on the sign-in form', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-email').fill('prefill-e2e@e2e.local');
    await page.getByTestId('auth-recovery-open').click();
    await expect(page.getByTestId('recovery-email')).toHaveValue('prefill-e2e@e2e.local');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('forgot password writes a reset email and shows the generic banner', async ({ page }) => {
    const email = E2E_USERS.user.email;
    await requestReset(page, email);
    await expect(page.getByTestId('auth-reset-info')).toContainText('If an account exists');
    await expect(page.getByTestId('auth-reset-info')).toContainText('spam');

    await expect
      .poll(async () => (await latestOutboundEmail('password_reset', { to: email }))?.link ?? null, {
        timeout: 15000,
      })
      .toContain('oobCode');
    await trackResets(email);
  });

  test('forgot password for an unknown email shows the same banner, writes no email', async ({ page }) => {
    const unknown = 'nobody-recovery-e2e@e2e.local';
    const before = (await findOutboundEmails()).length;
    await requestReset(page, unknown);
    await expect(page.getByTestId('auth-reset-info')).toContainText('If an account exists');
    expect((await findOutboundEmails()).length).toBe(before);
  });

  test('reset happy path: complete, sign in, then restore the password', async ({ page }) => {
    const email = E2E_USERS.user.email;
    const newPassword = 'E2e-new-2026';
    try {
      await requestReset(page, email);
      const link = await waitForResetLink(email);
      expect(link).toContain('oobCode');
      await completeReset(page, link, newPassword);

      await page.goto('/');
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-password').fill(newPassword);
      await page.getByTestId('auth-submit').click();
      await expect(page).toHaveURL(/\/calendar/);
    } finally {
      await trackResets(email);
      await setUserPassword(email, SEEDED_PASSWORD);
    }
  });

  test('invalid reset code shows the error and resend, with a clean console', async ({ page, collector }) => {
    await page.goto('/auth/action?mode=resetPassword&oobCode=not-a-real-code');
    await expect(page.getByTestId('auth-action-error')).toBeVisible();
    await expect(page.getByTestId('auth-action-resend')).toBeVisible();
    collector.assertClean();
  });

  test('a used reset code cannot be replayed', async ({ page }) => {
    const email = E2E_USERS.other.email;
    const newPassword = 'E2e-reuse-2026';
    try {
      await requestReset(page, email);
      const link = await waitForResetLink(email);
      await completeReset(page, link, newPassword);

      await page.goto(appActionUrlFromResetLink(link));
      await expect(page.getByTestId('auth-action-error')).toBeVisible();
    } finally {
      await trackResets(email);
      await setUserPassword(email, SEEDED_PASSWORD);
    }
  });

  test('expired state can request a fresh link that completes a reset', async ({ page }) => {
    const email = E2E_USERS.sparse.email;
    const newPassword = 'E2e-resend-2026';
    try {
      await page.goto('/auth/action?mode=resetPassword&oobCode=not-a-real-code');
      await page.getByTestId('auth-action-resend').click();
      await expect(page.getByTestId('auth-email')).toBeVisible();

      const before = await latestOutboundEmail('password_reset', { to: email });
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-forgot').click();
      await expect(page.getByTestId('auth-reset-info')).toBeVisible();

      const freshLink = await waitForResetLink(email);
      expect(freshLink).not.toBe(before?.link ?? null);
      await completeReset(page, freshLink, newPassword);
    } finally {
      await trackResets(email);
      await setUserPassword(email, SEEDED_PASSWORD);
    }
  });

  test('recovery request writes a request, an alert, and the alert email', async ({ page }) => {
    const email = 'recovery-eight@e2e.local';
    const alternate = 'recovery-eight-alt@e2e.local';
    await addRecoveryRequest(page, email, 'Recovery Eight', alternate);

    await expect
      .poll(async () => (await requestsFor(email)).length, { timeout: 15000 })
      .toBe(1);
    for (const request of await requestsFor(email)) {
      cleanup.push(`recoveryRequests/${request.key}`);
    }

    await expect.poll(async () => (await alertsFor(email)).length, { timeout: 15000 }).toBe(1);

    await expect
      .poll(
        async () =>
          (await findOutboundEmails('admin_alert', { to: E2E_USERS.admin.email })).some((mail) =>
            (mail.text ?? '').includes(email),
          ),
        { timeout: 15000 },
      )
      .toBe(true);
    await trackAlertRows(email);
  });

  test('recovery validation: required fields, then success without an alternate contact', async ({ page }) => {
    const email = 'recovery-nine@e2e.local';
    const before = (await requestsFor(email)).length;

    await page.goto('/');
    await page.getByTestId('auth-recovery-open').click();
    await page.getByTestId('recovery-submit').click();
    await expect(page.getByTestId('recovery-error')).toBeVisible();
    expect((await requestsFor(email)).length).toBe(before);

    await page.getByTestId('recovery-email').fill(email);
    await page.getByTestId('recovery-name').fill('Recovery Nine');
    await page.getByTestId('recovery-submit').click();
    await expect(page.getByTestId('recovery-confirmation')).toBeVisible();

    await expect.poll(async () => (await requestsFor(email)).length).toBe(1);
    const [request] = await requestsFor(email);
    expect(request.alternateContact ?? null).toBeNull();
    cleanup.push(`recoveryRequests/${request.key}`);
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('admin generates a reset link, emails the alternate, resolves, and audits', async ({ page }) => {
    const accountEmail = E2E_USERS.user.email;
    const alternate = 'recovery-ten-alt@e2e.local';
    const marker = 'Recovery Ten';
    await addRecoveryRequest(page, accountEmail, marker, alternate);

    await expect
      .poll(async () => (await requestsFor(accountEmail)).filter((r) => r.name === marker).length)
      .toBe(1);
    const request = (await requestsFor(accountEmail)).find((r) => r.name === marker)!;
    cleanup.push(`recoveryRequests/${request.key}`);

    await login(page, 'admin');
    await page.goto('/admin/recovery');
    const row = page
      .locator('.recovery-row')
      .filter({ hasText: marker })
      .filter({ hasText: accountEmail });
    await expect(row).toBeVisible();
    await row.getByTestId('admin-recovery-reason').fill('Verified by phone');
    await expect(row.getByTestId('admin-recovery-generate')).toBeEnabled();
    await row.getByTestId('admin-recovery-generate').click();

    const linkEl = row.getByTestId('admin-recovery-link');
    await expect(linkEl).toBeVisible();
    const link = ((await linkEl.textContent()) ?? '').trim();
    expect(link).toContain('oobCode');

    await expect
      .poll(async () => (await findOutboundEmails('recovery_link', { to: alternate })).length, {
        timeout: 15000,
      })
      .toBeGreaterThan(0);
    const mails = await findOutboundEmails('recovery_link', { to: alternate });
    expect(mails[0].link).toBe(link);
    for (const mail of mails) {
      cleanup.push(`outboundEmails/${mail.key}`);
    }

    await expect.poll(async () => (await readDb<any>(`recoveryRequests/${request.key}`))?.status).toBe('resolved');

    const audit = (await readDb<Record<string, any>>('recoveryAudit')) ?? {};
    const entries = Object.entries(audit)
      .filter(([, value]) => value?.requestId === request.key && value?.action === 'generate_reset_link')
      .map(([key]) => key);
    expect(entries.length).toBeGreaterThan(0);
    for (const key of entries) {
      cleanup.push(`recoveryAudit/${key}`);
    }

    await trackAlertRows(accountEmail);

    if (test.info().project.name === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await row.getByTestId('admin-recovery-copy').click();
      await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    } else {
      await expect(linkEl).toBeVisible();
    }
  });

  test('admin marks a recovery request closed after confirming', async ({ page }) => {
    const email = 'recovery-close@e2e.local';
    const marker = 'Recovery Close';
    await addRecoveryRequest(page, email, marker);

    await expect.poll(async () => (await requestsFor(email)).length, { timeout: 15000 }).toBe(1);
    const request = (await requestsFor(email))[0];
    cleanup.push(`recoveryRequests/${request.key}`);

    await login(page, 'admin');
    await page.goto('/admin/recovery');
    const row = page.locator('.recovery-row').filter({ hasText: marker }).filter({ hasText: email });
    await expect(row).toBeVisible();

    await row.getByTestId('admin-recovery-close').click();
    await expect(page.getByText('Mark Request Closed?')).toBeVisible();
    const callable = page.waitForRequest(
      (req) => req.url().includes('/closeRecoveryRequest') && req.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Yes' }).click();
    const sent = await callable;
    expect(sent.postData() ?? '').toContain(request.key);

    // A successful close flips the record to closed, so it leaves the open list.
    await expect
      .poll(async () => (await readDb<any>(`recoveryRequests/${request.key}`))?.status, {
        timeout: 15000,
      })
      .toBe('closed');
    await expect(row.locator('.row-error')).toHaveCount(0);

    await expect.poll(async () => (await alertsFor(email)).length, { timeout: 15000 }).toBeGreaterThan(0);
    await trackAlertRows(email);
  });

  test('admin adds and removes an alert recipient, and the new recipient gets alerts', async ({ page }) => {
    const added = 'recovery-eleven-recipient@e2e.local';
    const triggerEmail = 'recovery-eleven@e2e.local';

    await login(page, 'admin');
    await page.goto('/admin/recovery');
    await expect(page.getByTestId('admin-recipients')).toBeVisible();

    await page.getByTestId('admin-recipient-email').fill(added);
    await page.getByTestId('admin-recipient-add').click();
    await expect(page.locator('.recipient-row', { hasText: added })).toBeVisible();

    const config = await readDb<string[]>('config/adminAlertRecipients');
    expect(config).toContain(added);
    expect(config).toContain(E2E_USERS.admin.email);

    const audit = (await readDb<Record<string, any>>('recoveryAudit')) ?? {};
    const auditKeys = Object.entries(audit)
      .filter(([, value]) => value?.action === 'update_recipients')
      .map(([key]) => key);
    expect(auditKeys.length).toBeGreaterThan(0);
    for (const key of auditKeys) {
      cleanup.push(`recoveryAudit/${key}`);
    }

    // Trigger an alert as an anonymous visitor. `/` redirects a signed-in user
    // to the promoted route, so open the account card via the nav first.
    await page.getByRole('button', { name: 'Account' }).click();
    await logout(page);
    await addRecoveryRequest(page, triggerEmail, 'Recovery Eleven');

    await expect
      .poll(
        async () =>
          (await findOutboundEmails('admin_alert', { to: added })).some((mail) =>
            (mail.text ?? '').includes(triggerEmail),
          ),
        { timeout: 15000 },
      )
      .toBe(true);

    for (const request of await requestsFor(triggerEmail)) {
      cleanup.push(`recoveryRequests/${request.key}`);
    }
    await trackAlertRows(triggerEmail);

    await login(page, 'admin');
    await page.goto('/admin/recovery');
    const row = page.locator('.recipient-row', { hasText: added });
    await expect(row).toBeVisible();
    await row.getByTestId('admin-recipient-remove').click();
    await expect(page.locator('.recipient-row', { hasText: added })).toHaveCount(0);

    const restored = await readDb<string[]>('config/adminAlertRecipients');
    expect(restored).toEqual([E2E_USERS.admin.email]);

    const finalAudit = (await readDb<Record<string, any>>('recoveryAudit')) ?? {};
    for (const [key, value] of Object.entries(finalAudit)) {
      if (value?.action === 'update_recipients') {
        cleanup.push(`recoveryAudit/${key}`);
      }
    }
  });

  test('admin surfacing shows a newly created account and its alert email', async ({ page }) => {
    const stamp = Date.now();
    const uid = `created-e2e-${stamp}`;
    const email = `created-e2e-${stamp}@e2e.local`;
    await writeDb(`users/${uid}`, {
      id: uid,
      name: 'Created E2E',
      email,
      roles: { user: true },
      dateRegistered: Date.now(),
    });
    cleanup.push(`users/${uid}`);

    await expect
      .poll(
        async () =>
          (await findOutboundEmails('account_created')).some((mail) =>
            (mail.text ?? '').includes(email),
          ),
        { timeout: 15000 },
      )
      .toBe(true);
    for (const mail of await findOutboundEmails('account_created')) {
      if ((mail.text ?? '').includes(email)) {
        cleanup.push(`outboundEmails/${mail.key}`);
      }
    }

    await login(page, 'admin');
    await page.goto('/admin/recovery');
    await expect(page.getByTestId('admin-account-creations')).toContainText(email);
  });

  test('admin activity feed surfaces a submitted recovery request', async ({ page }) => {
    const email = `recovery-activity-${Date.now()}@e2e.local`;
    await addRecoveryRequest(page, email, 'Recovery Activity');

    await expect.poll(async () => (await requestsFor(email)).length, { timeout: 15000 }).toBe(1);
    for (const request of await requestsFor(email)) {
      cleanup.push(`recoveryRequests/${request.key}`);
    }

    await login(page, 'admin');
    await page.goto('/admin/recovery');
    const card = page.getByTestId('admin-recovery-activity');
    await expect(card.locator('.activity-row').filter({ hasText: email })).toBeVisible();

    await trackAlertRows(email);
  });

  test('admin sees a recovery attempt the global cap turned away', async ({ page }) => {
    const email = `turned-away-${Date.now()}@e2e.local`;
    const key = `denied-${Date.now()}`;
    await writeDb(`recoveryAudit/${key}`, {
      id: key,
      action: 'recovery_attempt_denied',
      function: 'submitRecoveryRequest',
      layer: 'global',
      targetEmail: email,
      email,
      name: 'Turned Away',
      createdAt: Date.now(),
    });
    cleanup.push(`recoveryAudit/${key}`);

    await login(page, 'admin');
    await page.goto('/admin/recovery');
    await expect(
      page
        .getByTestId('admin-recovery-activity')
        .locator('.activity-row')
        .filter({ hasText: email }),
    ).toBeVisible();
  });

  test('a stale pending request stays visible and closable', async ({ page }) => {
    const key = `stale-pending-${Date.now()}`;
    const email = `recovery-stale-${Date.now()}@e2e.local`;
    const marker = 'Stale Pending E2E';
    await writeDb(`recoveryRequests/${key}`, {
      id: key,
      email,
      name: marker,
      status: 'pending',
      resolvedBy: 'admin-1',
      createdAt: 1,
      updatedAt: Date.now() - 11 * 60 * 1000,
    });
    cleanup.push(`recoveryRequests/${key}`);

    await login(page, 'admin');
    await page.goto('/admin/recovery');
    const row = page.locator('.recovery-row').filter({ hasText: marker }).filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('admin-recovery-status')).toHaveText('pending');
    await expect(row.getByTestId('admin-recovery-close')).toBeEnabled();

    await row.getByTestId('admin-recovery-close').click();
    await expect(page.getByText('Mark Request Closed?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect
      .poll(async () => (await readDb<any>(`recoveryRequests/${key}`))?.status, { timeout: 15000 })
      .toBe('closed');

    const audit = (await readDb<Record<string, any>>('recoveryAudit')) ?? {};
    for (const [auditKey, value] of Object.entries(audit)) {
      if (value?.action === 'close_request' && value?.requestId === key) {
        cleanup.push(`recoveryAudit/${auditKey}`);
      }
    }
  });
});
