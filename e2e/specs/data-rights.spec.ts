import { test, expect, type Page } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb, writeDb } from '../helpers/admin-db';
import { expectNoHorizontalOverflow } from '../helpers/overflow';

interface StoredRequest {
  id: string;
  contact: string;
  description: string;
  status: 'open' | 'closed';
  createdAt: number;
  requesterUid?: string | null;
  throttleKey: string;
  updatedAt?: number;
  updatedBy?: string;
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

async function removeAlertsFor(contact: string): Promise<void> {
  const alerts = (await readDb<Record<string, { data?: { email?: string } }>>('adminAlerts')) ?? {};
  for (const [key, alert] of Object.entries(alerts)) {
    if (alert?.data?.email === contact) {
      await deleteDb(`adminAlerts/${key}`);
    }
  }
  const emails = (await readDb<Record<string, { kind?: string; text?: string }>>('outboundEmails')) ?? {};
  for (const [key, mail] of Object.entries(emails)) {
    if (mail?.kind === 'admin_alert' && String(mail?.text ?? '').includes(contact)) {
      await deleteDb(`outboundEmails/${key}`);
    }
  }
}

async function openDialog(page: Page): Promise<void> {
  await page.getByTestId('data-privacy-link').click();
  await expect(page.getByTestId('data-privacy-dialog')).toBeVisible();
}

async function submitRequest(page: Page, contact: string, description: string): Promise<void> {
  await openDialog(page);
  await expect(page.getByTestId('data-request-form')).toBeVisible();
  await page.getByTestId('data-request-contact').fill(contact);
  await page.getByTestId('data-request-description').fill(description);
  await page.getByTestId('data-request-submit').click();
  await expect(page.getByTestId('data-request-success')).toBeVisible();
}

// Small words stay lowercase inside a heading, the rest capitalize.
const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

function isTitleCase(text: string): boolean {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .every((word, index) => {
      const bare = word.replace(/[^A-Za-z].*$/, '');
      if (!bare) {
        return true;
      }
      const lowercase = bare.toLowerCase();
      if (index > 0 && MINOR_WORDS.has(lowercase)) {
        return bare === lowercase;
      }
      return bare[0] === bare[0].toUpperCase() && bare.slice(1) === bare.slice(1).toLowerCase();
    });
}

test.describe('data and privacy', () => {
  test('footer link reads Data and Privacy, is keyboard reachable with visible focus, and opens the dialog', async ({ page }) => {
    await page.goto('/');
    const link = page.getByTestId('data-privacy-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('Data and Privacy');

    // WebKit follows the macOS default and skips buttons on plain Tab.
    const tab = test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab';
    let reached = false;
    for (let i = 0; i < 80 && !reached; i += 1) {
      await page.keyboard.press(tab);
      reached = await link.evaluate(el => el === document.activeElement);
    }
    expect(reached).toBe(true);
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('data-privacy-dialog')).toBeVisible();
    await expect(page.getByTestId('data-privacy-dialog').getByRole('heading', { name: 'Data and Privacy' })).toBeVisible();
  });

  test('the dialog shows title-case heading, labels, and actions with no legacy controls', async ({ page }) => {
    await page.goto('/');
    await openDialog(page);

    const dialog = page.getByTestId('data-privacy-dialog');
    await expect(dialog.getByRole('heading', { name: 'Data and Privacy' })).toBeVisible();
    const copy = dialog.locator('.dialog-copy');
    await expect(copy).toContainText('Something wrong or out of date?');
    await expect(copy).toContainText('Send us an update.');
    await expect(copy).toContainText('Rather not have your info shared here?');
    await expect(copy).toContainText("We'll take it down.");
    await expect(copy).not.toContainText('Say the word');
    await expect(copy).not.toContainText('Our family keeps this site');
    await expect(dialog.getByLabel('Your Email')).toBeVisible();
    await expect(dialog.getByLabel('How Can We Help?')).toBeVisible();
    await expect(dialog.getByTestId('data-request-submit')).toHaveText('Send Message');
    await expect(dialog.getByTestId('data-privacy-cancel')).toHaveText('Cancel');

    const cancelBox = (await dialog.getByTestId('data-privacy-cancel').boundingBox())!;
    const sendBox = (await dialog.getByTestId('data-request-submit').boundingBox())!;
    const cancelCenter = cancelBox.y + cancelBox.height / 2;
    const sendCenter = sendBox.y + sendBox.height / 2;
    expect(Math.abs(cancelCenter - sendCenter)).toBeLessThan(8);

    await expect(dialog.getByRole('button', { name: /^(Update|Remove|Contact)$/ })).toHaveCount(0);
    await expect(dialog.locator('select, mat-select')).toHaveCount(0);
    await expect(dialog.getByTestId('data-request-class')).toHaveCount(0);

    const titleCaseStrings = await dialog.locator('h2, mat-label, button').allInnerTexts();
    expect(titleCaseStrings.length).toBeGreaterThan(0);
    for (const value of titleCaseStrings) {
      const text = value.trim();
      expect(isTitleCase(text), `Expected title case: ${text}`).toBe(true);
    }
  });

  test('a signed-out message persists, queues in admin, and alerts the configured email', async ({ page }) => {
    const contact = `footer-message-${Date.now()}@e2e.local`;
    const description = 'Please tell me what you store about my family.';
    try {
      await page.goto('/');
      await submitRequest(page, contact, description);

      const stored = Object.values(await storedRequests()).find(request => request.contact === contact);
      expect(stored).toBeTruthy();
      expect(stored!.contact).toBe(contact);
      expect(stored!.description).toBe(description);
      expect(stored!.status).toBe('open');
      const throttle = await readDb<{ count: number }>(`dataRequestThrottle/${stored!.throttleKey}`);
      expect(throttle?.count).toBe(1);

      await expect
        .poll(async () => {
          const alerts = (await readDb<Record<string, { data?: { email?: string }; body?: string }>>('adminAlerts')) ?? {};
          return Object.values(alerts).some(
            alert => alert?.data?.email === contact && String(alert?.body ?? '').includes(description),
          );
        }, { timeout: 20000 })
        .toBe(true);

      await expect
        .poll(async () => {
          const emails = (await readDb<Record<string, { kind?: string; text?: string }>>('outboundEmails')) ?? {};
          return Object.values(emails).some(
            mail =>
              mail?.kind === 'admin_alert'
              && String(mail?.text ?? '').includes(contact)
              && String(mail?.text ?? '').includes(description),
          );
        }, { timeout: 20000 })
        .toBe(true);

      await login(page, 'admin');
      await page.goto('/admin/support');
      const row = page.locator('.data-request-row').filter({ hasText: contact });
      await expect(row).toBeVisible({ timeout: 20000 });
      await expect(row).toContainText(description);
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('open');
    } finally {
      await removeRequestsFor(contact);
      await removeAlertsFor(contact);
    }
  });

  test('validation flags an invalid email and a missing about text without writing a request', async ({ page }) => {
    const contact = `footer-invalid-${Date.now()}@e2e.local`;
    await page.goto('/');
    await openDialog(page);

    const contactField = page.getByTestId('data-request-contact');
    const descriptionField = page.getByTestId('data-request-description');
    const submit = page.getByTestId('data-request-submit');

    await contactField.fill('not an email');
    await descriptionField.fill('Something about my information.');
    await submit.click();
    await expect(contactField).toHaveAttribute('aria-invalid', 'true');
    await expect(contactField).toHaveAttribute('aria-describedby', 'data-request-contact-error');
    await expect(page.locator('#data-request-contact-error')).toHaveText(/valid email/);

    await contactField.fill(contact);
    await descriptionField.fill('');
    await submit.click();
    await expect(descriptionField).toHaveAttribute('aria-invalid', 'true');
    await expect(descriptionField).toHaveAttribute('aria-describedby', 'data-request-description-error');
    await expect(page.locator('#data-request-description-error')).toHaveText(/Tell us what this is about/);

    const stored = Object.values(await storedRequests()).find(request => request.contact === contact);
    expect(stored).toBeUndefined();
    const alerts = (await readDb<Record<string, { data?: { email?: string } }>>('adminAlerts')) ?? {};
    expect(Object.values(alerts).some(alert => alert?.data?.email === contact)).toBe(false);
  });

  test('Cancel closes the dialog and a reopened dialog starts empty', async ({ page }) => {
    await page.goto('/');
    await openDialog(page);
    await page.getByTestId('data-request-contact').fill('shared-device@e2e.local');
    await page.getByTestId('data-request-description').fill('Private details');
    await page.getByTestId('data-privacy-cancel').click();
    await expect(page.getByTestId('data-privacy-dialog')).toHaveCount(0);

    await openDialog(page);
    await expect(page.getByTestId('data-request-contact')).toHaveValue('');
    await expect(page.getByTestId('data-request-description')).toHaveValue('');
  });

  test('signed-in visitor gets their email prefilled and can still change it', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/calendar');
    await openDialog(page);
    const contact = page.getByTestId('data-request-contact');
    await expect(contact).toHaveValue('user@e2e.local');
    await contact.fill('other-address@e2e.local');
    await expect(contact).toHaveValue('other-address@e2e.local');
  });

  test('Close and Reopen each require confirmation and persist the new status', async ({ page }) => {
    const seeded = (await readDb<StoredRequest>('dataRequests/data-request-open'))!;
    try {
      await login(page, 'admin');
      await page.goto('/admin/support');
      const row = page.locator('.data-request-row').filter({ hasText: 'data-open@e2e.local' });
      await expect(row).toBeVisible({ timeout: 20000 });
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('open');

      await row.getByTestId('admin-data-request-close').click();
      const closeDialog = page.getByRole('dialog').filter({ hasText: 'Close Request?' });
      await expect(closeDialog).toBeVisible();
      await closeDialog.getByTestId('admin-data-request-close-confirm').click();
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('closed');
      expect((await readDb<StoredRequest>('dataRequests/data-request-open'))!.status).toBe('closed');

      await row.getByTestId('admin-data-request-reopen').click();
      const reopenDialog = page.getByRole('dialog').filter({ hasText: 'Reopen Request?' });
      await expect(reopenDialog).toBeVisible();
      await reopenDialog.getByTestId('admin-data-request-reopen-confirm').click();
      await expect(row.getByTestId('admin-data-request-status')).toHaveText('open');
      expect((await readDb<StoredRequest>('dataRequests/data-request-open'))!.status).toBe('open');
    } finally {
      await writeDb('dataRequests/data-request-open', seeded);
    }
  });

  test('request text cannot inject script', async ({ page }) => {
    const contact = `footer-xss-${Date.now()}@e2e.local`;
    const payload = '<img src=x onerror="window.__xss=1">';
    try {
      await page.goto('/');
      await submitRequest(page, contact, payload);
      const xss = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
      expect(xss).toBeUndefined();

      const stored = Object.values(await storedRequests()).find(request => request.contact === contact);
      expect(stored?.description).toBe(payload);

      await login(page, 'admin');
      await page.goto('/admin/support');
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
      await removeAlertsFor(contact);
    }
  });

  test('mobile footer and dialog stay usable without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const footer = page.getByTestId('site-footer');
    await expect(footer).toBeVisible();
    await expectNoHorizontalOverflow(footer);

    const link = (await page.getByTestId('data-privacy-link').boundingBox())!;
    expect(link.x).toBeGreaterThanOrEqual(0);
    expect(link.x + link.width).toBeLessThanOrEqual(390);

    await openDialog(page);
    const dialog = page.getByTestId('data-privacy-dialog');
    await expectNoHorizontalOverflow(dialog);
    // Each intro scenario is its own block so it wraps as a unit on a phone.
    await expect(dialog.locator('.dialog-copy p')).toHaveCount(2);
    await expect(page.getByTestId('data-request-contact')).toBeVisible();
    await expect(page.getByTestId('data-request-description')).toBeVisible();
    await expect(page.getByTestId('data-request-submit')).toBeVisible();
    await expect(page.getByTestId('data-privacy-cancel')).toBeVisible();
    await page.getByTestId('data-request-contact').fill('mobile@e2e.local');
    await page.getByTestId('data-request-description').fill('Checking the mobile dialog.');
    await expect(page.getByTestId('data-request-submit')).toBeEnabled();;
  });
});
