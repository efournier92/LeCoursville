import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb, writeDb } from '../helpers/admin-db';

test.describe('admin system surfaces', () => {
  test.afterEach(async ({ collector }) => collector.assertClean());

  test('users: the table renders the contract columns and seeded rows', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');

    const table = page.getByTestId('admin-users-table');
    await expect(table).toBeVisible({ timeout: 20000 });
    const headers = await table.locator('thead th').allTextContents();
    expect(headers).toEqual(['Name', 'Email', 'Last Active', 'Registered', 'Roles', '']);

    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(5);
    const regular = rows.filter({ hasText: 'user@e2e.local' });
    await expect(regular).toContainText('Regular User');
    await expect(regular).toContainText('Member');
    await expect(page.locator('.admin-pagination')).toContainText('Showing 1-5 of 5');
  });

  test('users: Edit opens the editor dialog and Cancel closes it unchanged', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');

    const table = page.getByTestId('admin-users-table');
    await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });
    const row = table.locator('tbody tr').filter({ hasText: 'user@e2e.local' });

    await row.getByRole('button', { name: 'Edit' }).click();
    const editor = page.getByRole('dialog').filter({ hasText: 'Edit user' });
    await expect(editor).toBeVisible();
    await expect(editor.locator('input[name="user-name"]')).toHaveValue('Regular User');

    await editor.getByRole('button', { name: 'Cancel' }).click();
    await expect(editor).toHaveCount(0);
    await expect(row).toBeVisible();
  });

  test('users: Delete asks for confirmation and Cancel keeps the row', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');

    const table = page.getByTestId('admin-users-table');
    await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });
    const row = table.locator('tbody tr').filter({ hasText: 'user@e2e.local' });

    await row.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Delete user?');
    await expect(dialog).toContainText('Delete Regular User? This cannot be undone.');

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeVisible();
  });

  test('users: search and sort survive navigating away and back', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');

    const table = page.getByTestId('admin-users-table');
    await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });

    await page.getByTestId('admin-users-filter').fill('Sparse');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(page).toHaveURL(/[?&]q=Sparse/);

    await page.getByTestId('admin-users-sort').click();
    await page.getByRole('menuitem', { name: 'Name' }).click();
    await expect(page).toHaveURL(/[?&]sort=name/);
    await expect(page.getByTestId('admin-users-sort')).toContainText('Sort: Name');

    await page.getByTestId('admin-nav-link-calendars').click();
    await expect(page).toHaveURL(/\/admin\/calendars$/);
    await page.goBack();

    await expect(page).toHaveURL(/\/admin\/users\?/);
    await expect(page.getByTestId('admin-users-filter')).toHaveValue('Sparse');
    await expect(page.getByTestId('admin-users-sort')).toContainText('Sort: Name');
    await expect(table.locator('tbody tr')).toHaveCount(1);
  });

  test('calendars: delete dialog names the year and cancel keeps the row', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/calendars');
    const year = new Date().getFullYear().toString();
    const row = page.locator('.admin-table tbody tr').filter({ hasText: year });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(year);
    await expect(dialog).toContainText('Delete calendar?');

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeVisible();
  });

  test('calendars: a throwaway calendar is deleted after confirming, and the record is cleaned up', async ({ page }) => {
    const id = 'e2e-cal-1999';
    const year = '1999';
    const original = {
      id,
      year,
      url: 'https://example.test/e2e-1999.pdf',
      path: '',
    };
    await writeDb(`calendars/${id}`, original);

    try {
      await login(page, 'admin');
      await page.goto('/admin/calendars');
      const row = page.locator('.admin-table tbody tr').filter({ hasText: year });
      await expect(row).toBeVisible();

      await row.getByRole('button', { name: 'Delete' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Delete calendar?');
      await expect(dialog).toContainText(year);
      await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

      await expect(row).toHaveCount(0);
      await expect.poll(async () => readDb(`calendars/${id}`)).toBeNull();
    } finally {
      await deleteDb(`calendars/${id}`);
    }
  });

  test('features: nine grouped toggles with the seeded chat OFF and contacts ON', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/features');

    const ids = ['people', 'contacts', 'calendar', 'music', 'videos', 'photos', 'enablePhotoAlbums', 'expressions', 'chat'];
    for (const id of ids) {
      await expect(page.getByTestId(`feature-toggle-${id}`)).toBeVisible();
    }
    for (const label of ['People', 'Content', 'System']) {
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    }

    await expect(page.getByTestId('feature-toggle-chat').locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('feature-toggle-contacts').locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'true');
  });

  test('recovery: requests render a row or empty state, and close asks before mutating', async ({ page }) => {
    const key = `admin-system-${Date.now()}`;
    const email = `${key}@e2e.local`;
    await writeDb(`recoveryRequests/${key}`, {
      id: key,
      email,
      name: 'Admin System E2E',
      status: 'open',
      createdAt: Date.now(),
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/recovery');

      const list = page.getByTestId('admin-recovery-list');
      await expect(list).toBeVisible();
      await expect(
        list.locator('.recovery-row').first().or(list.getByText('No recovery requests')),
      ).toBeVisible();

      const row = list.locator('.recovery-row').filter({ hasText: email });
      await expect(row).toBeVisible();

      await row.getByTestId('admin-recovery-close').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Mark Request Closed?');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);

      await expect
        .poll(async () => (await readDb<{ status?: string }>(`recoveryRequests/${key}`))?.status)
        .toBe('open');
      await expect(row).toBeVisible();
    } finally {
      await deleteDb(`recoveryRequests/${key}`);
    }
  });

  test('recovery: closing an open request through the dialog marks it closed, then restores the DB', async ({ page }) => {
    const key = `e2e-close-${Date.now()}`;
    const email = `${key}@e2e.local`;
    await writeDb(`recoveryRequests/${key}`, {
      id: key,
      email,
      name: 'Recovery Close E2E',
      status: 'open',
      createdAt: Date.now(),
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/recovery');

      const row = page
        .getByTestId('admin-recovery-list')
        .locator('.recovery-row')
        .filter({ hasText: email });
      await expect(row).toBeVisible();
      await expect(row.getByTestId('admin-recovery-status')).toHaveText('open');

      await row.getByTestId('admin-recovery-close').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Mark Request Closed?');
      await dialog.getByRole('button', { name: 'Yes' }).click();

      await expect(row.getByTestId('admin-recovery-status')).toHaveText('closed', {
        timeout: 15000,
      });
      await expect
        .poll(async () => (await readDb<{ status?: string }>(`recoveryRequests/${key}`))?.status)
        .toBe('closed');
      await expect
        .poll(async () => {
          const audit = (await readDb<Record<string, any>>('recoveryAudit')) ?? {};
          return Object.values(audit).filter((entry) => entry?.requestId === key).length;
        }, { timeout: 15000 })
        .toBeGreaterThan(0);
    } finally {
      await deleteDb(`recoveryRequests/${key}`);
      const audit = (await readDb<Record<string, any>>('recoveryAudit')) ?? {};
      for (const [id, entry] of Object.entries(audit)) {
        if (entry?.requestId === key) {
          await deleteDb(`recoveryAudit/${id}`);
        }
      }
    }
  });

  test('calendars at 390px: table becomes cards with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');
    await page.goto('/admin/calendars');

    const row = page.locator('.admin-table tbody tr').first();
    await expect(row).toBeVisible();
    await expect(page.locator('.admin-table thead')).toBeHidden();
    await expect(row.locator('td[data-label="Year"]')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
