import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb, writeDb } from '../helpers/admin-db';

test.describe('admin system surfaces', () => {
  test.afterEach(async ({ collector }) => collector.assertClean());

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

    await expect(page.getByTestId('feature-toggle-chat').locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(page.getByTestId('feature-toggle-contacts').locator('input[type="checkbox"]')).toBeChecked();
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
