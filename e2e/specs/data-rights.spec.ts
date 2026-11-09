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
}

async function storedRequests(): Promise<Record<string, StoredRequest>> {
  return (await readDb<Record<string, StoredRequest>>('dataRequests')) ?? {};
}

async function removeRequestsFor(contact: string): Promise<void> {
  const all = await storedRequests();
  for (const [key, request] of Object.entries(all)) {
    if (request.contact === contact) {
      await deleteDb(`dataRequests/${key}`);
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
    await expect(footer).toContainText('Request data removal');
    await expect(footer).toContainText('Request data update');
    await expect(footer).toContainText('final wording is pending legal review');

    await page.emulateMedia({ media: 'print' });
    await expect(footer).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await expect(footer).toBeVisible();

    await login(page, 'admin');
    await page.goto('/admin/data-requests');
    await expect(page.getByTestId('admin-data-requests-list')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('site-footer')).toHaveCount(0);
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

      const granted = (await readDb<StoredRequest & { grantedBy?: string }>('dataRequests/data-request-removal'))!;
      expect(granted.status).toBe('resolved');
      expect(granted.grantedBy).toBeTruthy();
      await expect.poll(async () => {
        const audit = (await readDb<Record<string, { requestId: string }>>('dataRequestAudit')) ?? {};
        return Object.values(audit).some(entry => entry.requestId === 'data-request-removal');
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

  test('footer is keyboard reachable and the form follows in DOM order', async ({ page }) => {
    await page.goto('/');
    const removal = page.getByTestId('data-request-open-removal');
    await removal.focus();
    await expect(removal).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('data-request-form')).toBeVisible();
    await page.getByTestId('data-request-contact').focus();
    await expect(page.getByTestId('data-request-contact')).toBeFocused();
    await page.keyboard.type('keyboard@e2e.local');
    await page.getByTestId('data-request-submit').focus();
    await expect(page.getByTestId('data-request-submit')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('data-request-success')).toBeVisible();
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
    expect(update!.y).toBeGreaterThan(removal!.y);
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
