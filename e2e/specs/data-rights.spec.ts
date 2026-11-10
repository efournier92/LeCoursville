import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb, writeDb } from '../helpers/admin-db';
import { expectNoHorizontalOverflow } from '../helpers/overflow';

interface StoredRequest {
  id: string;
  kind: string;
  dataClass: string;
  contact: string;
  description: string;
  status: string;
  createdAt: number;
  throttleKey?: string;
  verifiedAt?: number;
  verifiedBy?: string;
  grantedAt?: number;
  grantedBy?: string;
  redactedAt?: number;
}

async function storedRequests(): Promise<Record<string, StoredRequest>> {
  return (await readDb<Record<string, StoredRequest>>('dataRequests')) ?? {};
}

async function removeRequestsFor(contact: string): Promise<void> {
  const all = await storedRequests();
  for (const [key, request] of Object.entries(all)) {
    if (request.contact !== contact) {
      continue;
    }
    await deleteDb(`dataRequests/${key}`);
    if (request.throttleKey) {
      await deleteDb(`dataRequestThrottle/${request.throttleKey}`);
    }
  }
}

async function submitRequest(
  page: import('@playwright/test').Page,
  kind: 'removal' | 'update',
  contact: string,
  description: string,
): Promise<void> {
  await page.getByTestId(`data-request-open-${kind}`).click();
  await expect(page.getByTestId('data-request-form')).toBeVisible();
  await page.getByTestId('data-request-contact').fill(contact);
  await page.getByTestId('data-request-description').fill(description);
  await page.getByTestId('data-request-submit').click();
  await expect(page.getByTestId('data-request-success')).toBeVisible();
}

test.describe('data rights footer', () => {
  test('footer renders on user routes, the signed-out root, and hides on admin and print', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByTestId('site-footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Our family keeps this site, and we want it to be right for all who visit.');
    await expect(footer.getByTestId('data-request-open-update')).toHaveText('Update');
    await expect(footer.getByTestId('data-request-open-removal')).toHaveText('Remove');
    await expect(footer.getByTestId('data-request-open-contact')).toHaveText('Contact');
    await expect(footer.getByTestId('data-request-response')).toHaveText(
      'We review each request and reply to the email or phone you give us.',
    );

    await page.emulateMedia({ media: 'print' });
    await expect(footer).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await expect(footer).toBeVisible();

    // The family explorer uses the bare layout but stays a public user route.
    await page.goto('/family-explorer/archive-1');
    await expect(page.getByTestId('family-chart')).toBeVisible();
    await expect(page.getByTestId('site-footer')).toBeVisible();

    await login(page, 'admin');
    await page.goto('/admin/data-requests');
    await expect(page.getByTestId('admin-data-requests-list')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('site-footer')).toHaveCount(0);
  });

  test('each action opens its own heading and body', async ({ page }) => {
    await page.goto('/');
    const cases = [
      {
        kind: 'update',
        heading: 'Something wrong or out of date?',
        body: 'Tell us what to fix or bring up to date, and the best way to reach you. We will review your request and reply.',
      },
      {
        kind: 'removal',
        heading: 'Something we should stop sharing about you?',
        body: 'Ask us to stop sharing information about you. We will review your request before acting on it, and we reply either way.',
      },
      {
        kind: 'contact',
        heading: 'Something else on your mind?',
        body: 'Send us a note about your information, with details and the way to reach you. We will review it and reply.',
      },
    ] as const;
    for (const item of cases) {
      await page.getByTestId(`data-request-open-${item.kind}`).click();
      const panel = page.getByTestId('data-request-form');
      await expect(panel.getByRole('heading', { name: item.heading })).toBeVisible();
      await expect(panel).toContainText(item.body);
    }
  });

  test('signed-out removal request persists and appears in the admin queue', async ({ page }) => {
    const contact = `footer-removal-${Date.now()}@e2e.local`;
    try {
      await page.goto('/');
      await submitRequest(page, 'removal', contact, 'Remove my public family listing.');

      const stored = Object.values(await storedRequests()).find(request => request.contact === contact);
      expect(stored).toBeTruthy();
      expect(stored!.kind).toBe('removal');
      expect(stored!.status).toBe('open');
      const throttle = await readDb<{ count: number }>(`dataRequestThrottle/${stored!.throttleKey}`);
      expect(throttle?.count).toBe(1);

      await login(page, 'admin');
      await page.goto('/admin/data-requests');
      const row = page.locator('.data-request-row').filter({ hasText: contact });
      await expect(row).toBeVisible({ timeout: 20000 });
      await expect(row).toContainText('removal / people');
      await expect(row).toContainText('Remove my public family listing.');
    } finally {
      await removeRequestsFor(contact);
    }
  });

  test('update request persists with its own kind', async ({ page }) => {
    const contact = `footer-update-${Date.now()}@e2e.local`;
    try {
      await page.goto('/');
      await submitRequest(page, 'update', contact, 'Correct the caption on my photo.');
      const stored = Object.values(await storedRequests()).find(request => request.contact === contact);
      expect(stored?.kind).toBe('update');
      expect(stored?.status).toBe('open');
    } finally {
      await removeRequestsFor(contact);
    }
  });

  test('canceling the form clears the previous visitor contact and details', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('data-request-open-removal').click();
    await page.getByTestId('data-request-contact').fill('shared-device@e2e.local');
    await page.getByTestId('data-request-description').fill('Private details');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('data-request-form')).toHaveCount(0);

    await page.getByTestId('data-request-open-removal').click();
    await expect(page.getByTestId('data-request-contact')).toHaveValue('');
    await expect(page.getByTestId('data-request-description')).toHaveValue('');
  });

  test('labels, aria-invalid, and inline errors are wired to their fields', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('data-request-open-removal').click();

    const contact = page.getByLabel('Email or phone');
    await expect(contact).toHaveAttribute('data-testid', 'data-request-contact');
    await expect(page.getByLabel('What is this about?')).toBeVisible();

    await contact.fill('not a contact');
    await page.getByTestId('data-request-submit').click();

    await expect(contact).toHaveAttribute('aria-invalid', 'true');
    await expect(contact).toHaveAttribute('aria-describedby', 'data-request-contact-error');
    await expect(page.locator('#data-request-contact-error')).toHaveText(/valid email/);
  });

  test('resolve, close, and reopen each require confirmation and persist', async ({ page }) => {
    const seeded = (await readDb<StoredRequest>('dataRequests/data-request-removal'))!;
    try {
      await login(page, 'admin');
      await page.goto('/admin/data-requests');
      const row = page.locator('.data-request-row').filter({ hasText: 'data-removal@e2e.local' });
      await expect(row).toBeVisible({ timeout: 20000 });

      await row.getByTestId('admin-data-request-resolve').click();
      const resolveDialog = page.getByRole('dialog').filter({ hasText: 'Resolve request?' });
      await expect(resolveDialog).toBeVisible();
      await resolveDialog.getByTestId('admin-data-request-resolve-confirm').click();
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('resolved');
      expect((await readDb<StoredRequest>('dataRequests/data-request-removal'))!.status).toBe('resolved');

      await row.getByTestId('admin-data-request-close').click();
      const closeDialog = page.getByRole('dialog').filter({ hasText: 'Close request?' });
      await expect(closeDialog).toBeVisible();
      await closeDialog.getByTestId('admin-data-request-close-confirm').click();
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('closed');
      expect((await readDb<StoredRequest>('dataRequests/data-request-removal'))!.status).toBe('closed');

      await row.getByTestId('admin-data-request-reopen').click();
      const reopenDialog = page.getByRole('dialog').filter({ hasText: 'Reopen request?' });
      await expect(reopenDialog).toBeVisible();
      await reopenDialog.getByTestId('admin-data-request-reopen-confirm').click();
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('open');
      const reopened = (await readDb<StoredRequest>('dataRequests/data-request-removal'))!;
      expect(reopened.status).toBe('open');
      expect(reopened.grantedAt).toBeUndefined();
    } finally {
      await writeDb('dataRequests/data-request-removal', seeded);
    }
  });

  test('an admin records identity verification before the grant control appears', async ({ page }) => {
    const seeded = (await readDb<StoredRequest>('dataRequests/data-request-removal'))!;
    await writeDb('dataRequests/data-request-removal', {
      ...seeded,
      verifiedAt: null,
      verifiedBy: null,
      verificationMethod: null,
    });
    try {
      await login(page, 'admin');
      await page.goto('/admin/data-requests');
      const row = page.locator('.data-request-row').filter({ hasText: 'data-removal@e2e.local' });
      await expect(row).toBeVisible({ timeout: 20000 });
      await expect(row.getByTestId('admin-data-request-grant')).toHaveCount(0);

      await row.getByTestId('admin-data-request-verify').click();
      await expect(row.getByTestId('admin-data-request-verified')).toBeVisible();
      await expect(row.getByTestId('admin-data-request-grant')).toBeVisible();
      await expect.poll(async () =>
        (await readDb<StoredRequest>('dataRequests/data-request-removal'))?.verifiedAt,
      ).toBeTruthy();
      const verified = (await readDb<StoredRequest>('dataRequests/data-request-removal'))!;
      expect(verified.verificationMethod).toBe('admin_review');
    } finally {
      await writeDb('dataRequests/data-request-removal', seeded);
    }
  });

  test('erasing a resolved request clears its stored PII', async ({ page }) => {
    const seeded = (await readDb<StoredRequest>('dataRequests/data-request-update'))!;
    try {
      await login(page, 'admin');
      await page.goto('/admin/data-requests');
      const row = page.locator('.data-request-row').filter({ hasText: 'data-update@e2e.local' });
      await expect(row).toBeVisible({ timeout: 20000 });

      await row.getByTestId('admin-data-request-redact').click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Erase request details?' });
      await dialog.getByTestId('admin-data-request-redact-confirm').click();

      await expect.poll(async () =>
        (await readDb<StoredRequest>('dataRequests/data-request-update'))?.contact,
      ).toBe('[redacted]');
      const redacted = (await readDb<StoredRequest>('dataRequests/data-request-update'))!;
      expect(redacted.description).toBe('');
      expect(redacted.redactedAt).toBeTruthy();
    } finally {
      await writeDb('dataRequests/data-request-update', seeded);
    }
  });

  test('the super grant path asks for confirmation and cancel writes nothing', async ({ page }) => {
    const seeded = (await readDb<StoredRequest>('dataRequests/data-request-removal'))!;
    try {
      await login(page, 'admin');
      await page.goto('/admin/data-requests');
      const row = page.locator('.data-request-row').filter({ hasText: 'data-removal@e2e.local' });
      await expect(row).toBeVisible({ timeout: 20000 });

      await row.getByTestId('admin-data-request-grant').click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Grant data removal?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('open');
      expect((await readDb<StoredRequest>('dataRequests/data-request-removal'))!.status).toBe('open');
    } finally {
      await writeDb('dataRequests/data-request-removal', seeded);
    }
  });

  test('a confirmed super grant resolves the request and writes a minimal audit entry', async ({ page }) => {
    const seeded = (await readDb<StoredRequest>('dataRequests/data-request-removal'))!;
    try {
      await login(page, 'admin');
      await page.goto('/admin/data-requests');
      const row = page.locator('.data-request-row').filter({ hasText: 'data-removal@e2e.local' });
      await expect(row).toBeVisible({ timeout: 20000 });

      await row.getByTestId('admin-data-request-grant').click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Grant data removal?' });
      await expect(dialog).toBeVisible();
      await page.getByTestId('admin-data-request-grant-confirm').click();
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('resolved');

      const granted = (await readDb<StoredRequest>('dataRequests/data-request-removal'))!;
      expect(granted.status).toBe('resolved');
      expect(granted.grantedBy).toBeTruthy();
      expect(granted.grantedAt).toBeTruthy();
      // The grant is a decision only; the operator script performs the hard delete.
      expect(await readDb('people/person-a')).toBeTruthy();
      await expect.poll(async () => {
        const audit = (await readDb<Record<string, { requestId: string; dataClass?: string }>>(
          'dataRequestAudit',
        )) ?? {};
        const entry = Object.values(audit).find(row => row.requestId === 'data-request-removal');
        expect(entry?.dataClass).toBe('people');
        return !!entry;
      }).toBe(true);
    } finally {
      await writeDb('dataRequests/data-request-removal', seeded);
      const allAudit = (await readDb<Record<string, { requestId?: string }>>('dataRequestAudit')) ?? {};
      for (const [key, entry] of Object.entries(allAudit)) {
        if (entry.requestId === 'data-request-removal') {
          await deleteDb(`dataRequestAudit/${key}`);
        }
      }
    }
  });

  test('a content admin sees no grant control', async ({ page }) => {
    await login(page, 'staff');
    await page.goto('/admin/data-requests');
    const row = page.locator('.data-request-row').filter({ hasText: 'data-removal@e2e.local' });
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('admin-data-request-grant')).toHaveCount(0);
    await expect(row.getByTestId('admin-data-request-resolve')).toBeVisible();
  });

  test('footer is Tab reachable, keeps visible focus, and announces success', async ({ page }) => {
    await page.goto('/');
    const removal = page.getByTestId('data-request-open-removal');

    // WebKit follows the macOS default and skips buttons on plain Tab.
    const tab = test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab';
    let reached = false;
    for (let i = 0; i < 80 && !reached; i += 1) {
      await page.keyboard.press(tab);
      reached = await removal.evaluate(el => el === document.activeElement);
    }
    expect(reached).toBe(true);
    await expect(removal).toBeFocused();
    await expect(removal).toHaveCSS('outline-style', 'solid');

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('data-request-form')).toBeVisible();
    // Remaining action buttons, then the data-class select, then the contact field.
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press(tab);
    }
    await expect(page.getByTestId('data-request-contact')).toBeFocused();
    await page.keyboard.type('keyboard@e2e.local');
    await page.keyboard.press(tab);
    await page.keyboard.press(tab);
    await page.keyboard.press(tab);
    await expect(page.getByTestId('data-request-submit')).toBeFocused();
    await page.keyboard.press('Enter');

    const success = page.getByTestId('data-request-success');
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    await expect(page.getByTestId('data-request-status')).toContainText('We will review your request');
    await removeRequestsFor('keyboard@e2e.local');
  });

  test('footer is legible in both themes', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByTestId('site-footer');
    await expect(footer).toBeVisible();
    await expect(footer).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.getByTestId('theme-toggle')).toBeVisible();
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(footer).toHaveCSS('background-color', 'rgb(27, 31, 36)');
    await expect(footer).toHaveCSS('color', 'rgb(230, 233, 237)');
  });

  test('mobile footer stacks without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const footer = page.getByTestId('site-footer');
    await expect(footer).toBeVisible();
    await expectNoHorizontalOverflow(footer);

    const removal = await page.getByTestId('data-request-open-removal').boundingBox();
    const update = await page.getByTestId('data-request-open-update').boundingBox();
    expect(removal).not.toBeNull();
    expect(update).not.toBeNull();
    expect(Math.abs(removal!.x - update!.x)).toBeLessThan(2);
    expect(removal!.y).toBeGreaterThan(update!.y);
  });

  test('request text cannot inject script', async ({ page }) => {
    const contact = `footer-xss-${Date.now()}@e2e.local`;
    const payload = '<img src=x onerror="window.__xss=1">';
    try {
      await page.goto('/');
      await submitRequest(page, 'removal', contact, payload);
      const xss = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
      expect(xss).toBeUndefined();

      const stored = Object.values(await storedRequests()).find(request => request.contact === contact);
      expect(stored?.description).toBe(payload);

      await login(page, 'admin');
      await page.goto('/admin/data-requests');
      const row = page.locator('.data-request-row').filter({ hasText: contact });
      await expect(row).toContainText(payload);
      const handlers = await page.evaluate(() =>
        Array.from(document.querySelectorAll('*')).flatMap(el =>
          Array.from(el.attributes)
            .filter(attr => attr.name.toLowerCase() === 'onerror' && attr.value.includes('__xss'))
            .map(attr => attr.value),
        ),
      );
      expect(handlers).toEqual([]);
    } finally {
      await removeRequestsFor(contact);
    }
  });
});
