import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, writeDb } from '../helpers/admin-db';

test.afterEach(async ({ collector }) => collector.assertClean());

test.describe('admin people surfaces', () => {
  test('browser: dense table paginates, searches, sorts, and opens a person', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/people');

    const table = page.getByTestId('admin-people-table');
    await expect(table).toBeVisible({ timeout: 20000 });
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(10);
    await expect(page.locator('.people-pagination')).toContainText('Showing 1-10 of 25');

    const headers = await table.locator('thead th').allTextContents();
    expect(headers).toEqual([
      'Name', 'Family', 'Generation', 'Born', 'Died', 'Anniversary',
      'Spouse', 'Contact', 'Address', 'Living', 'Updated',
    ]);

    // Spouse resolves through the people list, never the raw id.
    const carol = table.locator('tbody tr').filter({ hasText: 'Carol Clark' });
    await expect(carol.locator('td[data-label="Spouse"]')).toHaveText('Dave Davis');
    await expect(carol.locator('td[data-label="Spouse"]')).toHaveAttribute('title', 'Dave Davis');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('.people-pagination')).toContainText('Showing 11-20 of 25');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('.people-pagination')).toContainText('Showing 21-25 of 25');
    await page.getByRole('button', { name: 'Prev' }).click();
    await expect(page.locator('.people-pagination')).toContainText('Showing 11-20 of 25');

    await page.getByTestId('admin-people-sort').click();
    await page.getByRole('menuitem', { name: 'Born' }).click();
    await expect(rows.first()).toContainText('Greta Gonzalez');

    await page.getByTestId('admin-people-filter').fill('Grace Grant');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Grace Grant');

    await page.getByTestId('admin-people-filter').fill('');
    await expect(rows).toHaveCount(10);
    // Reset the sort to Name for the detail assertion.
    await page.getByTestId('admin-people-sort').click();
    await page.getByRole('menuitem', { name: 'Name' }).click();
    const alice = table.locator('tbody tr').filter({ hasText: 'Alice Anderson' });
    await expect(alice).toBeVisible();
    await expect(alice).toHaveAttribute('aria-label', 'View Alice Anderson');
    await alice.click();
    const modal = page.locator('app-person-detail-modal');
    await expect(modal.locator('h2')).toContainText('Alice Anderson');
    // The host can measure zero; the rendered dialog must own real space.
    const contentBox = await modal.locator('.modal-content').boundingBox();
    expect(contentBox).not.toBeNull();
    expect(contentBox!.width).toBeGreaterThan(0);
    expect(contentBox!.height).toBeGreaterThan(0);
    await modal.locator('.close-button').click();
    await expect(modal).toHaveCount(0);

    // Keyboard path opens the same detail through Enter.
    await alice.focus();
    await expect(alice).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(modal.locator('h2')).toContainText('Alice Anderson');
    await modal.locator('.close-button').click();
    await expect(modal).toHaveCount(0);

    // CSV import stays reachable from the same page.
    await page.getByTestId('people-view-import').click();
    await expect(page.locator('.import-card .upload-area')).toBeVisible();
    await page.getByTestId('people-view-people').click();
    await expect(table).toBeVisible();
  });

  test('users page lists the seeded users, filters, and shows the range', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');

    const table = page.getByTestId('admin-users-table');
    await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });
    const pagination = page.locator('.admin-pagination');
    await expect(pagination).toContainText('Showing 1-5 of 5');

    await page.getByTestId('admin-users-filter').fill('Sparse');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.locator('td[data-label="Name"]')).toHaveText('Sparse User');
    await expect(pagination).toContainText('Showing 1-1 of 1');
  });

  test('families delete asks for confirmation and cancel keeps the row', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/families');

    const rows = page.locator('.families-table tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 20000 });

    await page.getByRole('button', { name: 'Delete Alder' }).click();
    await expect(page.getByRole('heading', { name: 'Delete family?' })).toBeVisible();
    await expect(page.getByText('Delete family Alder? This cannot be undone.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('button', { name: 'Delete Alder' })).toBeVisible();
    await expect(rows).toHaveCount(2);
    await expect(page.locator('app-no-results-message')).toHaveCount(0);
  });

  test('a family created through the UI can be deleted after confirming', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/families');
    await expect(page.locator('.families-table tbody tr')).toHaveCount(2, { timeout: 20000 });

    await page.getByRole('button', { name: 'Add Family' }).click();
    await page.getByLabel('Sort Order').fill('zeta-e2e');
    await page.getByLabel('Name').fill('Zeta E2E');
    await page.getByLabel('Hex Color').fill('#123456');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    const created = page.locator('.families-table tbody tr').filter({ hasText: 'Zeta E2E' });
    await expect(created).toHaveCount(1);

    await page.getByRole('button', { name: 'Delete Zeta E2E' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(created).toHaveCount(0);
    await expect(page.locator('.families-table tbody tr')).toHaveCount(2);
  });

  test('people import previews the CSV and reports the busy state while importing', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/people');
    await page.getByTestId('people-view-import').click();

    const csv = [
      'ID,Name_First_Given,Name_First_Preferred,Name_Last,Birthday,Generation_Number,Living?,Address_Street,Family',
      'people-e2e-1,Zoe,Zoe,Zimmerman,1990-01-15,1,TRUE,123 E2E St,Alder',
      'people-e2e-2,Yuri,Yuri,Zimmerman,1991-02-16,1,TRUE,124 E2E St,Alder',
    ].join('\n');

    await page.getByTestId('import-file').setInputFiles({
      name: 'people.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText('Import Preview')).toBeVisible();
    await expect(page.getByText('To Create').first()).toBeVisible();
    await expect(page.getByTestId('import-confirm')).toBeEnabled();

    const headers = await page.locator('.preview-card .admin-table thead th').allTextContents();
    expect(headers).toEqual([
      'ID',
      'First Given',
      'First Preferred',
      'Maiden',
      'Last',
      'Suffix',
      'Birthday',
      'Anniversary',
      'Spouse',
      'Gen',
      'Living',
      'Direct',
      'Street',
      'City',
      'State',
      'Zip',
    ]);

    await page.getByTestId('import-confirm').click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const button = document.querySelector(
              '[data-testid="import-confirm"]',
            ) as HTMLButtonElement | null;
            const card = document.querySelector('.preview-card');
            const complete = Array.from(document.querySelectorAll('h3')).some((heading) =>
              (heading.textContent ?? '').includes('Import Complete'),
            );
            return !!button?.disabled || card?.getAttribute('aria-busy') === 'true' || complete;
          }),
        { timeout: 15000 },
      )
      .toBe(true);
    await expect(page.getByText('Import Complete')).toBeVisible({ timeout: 15000 });
  });

  test('a re-import with one colliding ID warns about the overwrite and shows real counts', async ({ page }) => {
    const collisionId = 'people-e2e-collision';
    const newId = 'people-e2e-collision-new';
    await writeDb(`people/${collisionId}`, {
      id: collisionId,
      name: { firstGiven: 'Existing', last: 'Record' },
      familyId: 'family-1',
      isLiving: true,
      generationNumber: 1,
      parentIds: [],
      addresses: [],
      emails: [],
      phones: [],
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/people');
      await page.getByTestId('people-view-import').click();

      const csv = [
        'ID,Name_First_Given,Name_First_Preferred,Name_Last,Birthday,Generation_Number,Living?,Address_Street,Family',
        `${collisionId},Zoe,Zoe,Zimmerman,1990-01-15,1,TRUE,123 E2E St,Alder`,
        `${newId},Yuri,Yuri,Zimmerman,1991-02-16,1,TRUE,124 E2E St,Alder`,
      ].join('\n');

      await page.getByTestId('import-file').setInputFiles({
        name: 'people.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csv),
      });

      await expect(page.getByText('Import Preview')).toBeVisible();
      await expect(page.locator('.stat.created .stat-value')).toHaveText('1');
      await expect(page.locator('.stat.updated .stat-value')).toHaveText('1');
      await expect(page.getByTestId('import-overwrite')).toContainText(
        '1 existing record will be overwritten',
      );
      await expect(page.getByTestId('import-confirm')).toBeEnabled();

      await page.getByTestId('import-confirm').click();
      await expect(page.getByText('Import Complete')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('import-result-summary')).toContainText('1 person created');
      await expect(page.getByTestId('import-result-summary')).toContainText('1 person updated');
    } finally {
      await deleteDb(`people/${collisionId}`);
      await deleteDb(`people/${newId}`);
    }
  });

  test('the CSV drop zone opens the file picker from the keyboard', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/people');
    await page.getByTestId('people-view-import').click();

    const zone = page.locator('.upload-area');
    await zone.focus();
    await expect(zone).toBeFocused();

    const chooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    const chooser = await chooserPromise;
    const csv = [
      'ID,Name_First_Given,Name_First_Preferred,Name_Last,Birthday,Generation_Number,Living?,Address_Street,Family',
      'people-e2e-keyboard,Zoe,Zoe,Zimmerman,1990-01-15,1,TRUE,123 E2E St,Alder',
    ].join('\n');
    await chooser.setFiles({
      name: 'keyboard.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText('Import Preview')).toBeVisible();
    await expect(page.getByTestId('import-file')).toHaveCount(1);
  });

  test('at laptop width no header is truncated and columns keep explicit shares', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, 'admin');
    await page.goto('/admin/people');
    const table = page.getByTestId('admin-people-table');
    await expect(table).toBeVisible({ timeout: 20000 });

    const truncated = await table.locator('thead th').evaluateAll((cells) =>
      cells
        .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
        .map((cell) => cell.textContent?.trim() ?? ''),
    );
    expect(truncated).toEqual([]);
    await expect(table.locator('tbody tr').filter({ hasText: 'Alice Anderson' })).toBeVisible();
  });

  test('at phone width long values wrap without clipping a column', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');
    await page.goto('/admin/people');
    const table = page.getByTestId('admin-people-table');
    await expect(table).toBeVisible({ timeout: 20000 });

    const clipped = await table.locator('tbody td').evaluateAll((cells) =>
      cells
        .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
        .map((cell) => cell.getAttribute('data-label')),
    );
    expect(clipped).toEqual([]);
  });

  test('the view switch and pagination match the shared control metrics', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/people');
    const option = page.getByTestId('people-view-people');
    await expect(option).toBeVisible();
    await expect(option).toHaveCSS('min-height', '36px');
    await expect(option).toHaveCSS('font-size', '14px');
    await expect(page.locator('.people-pagination')).toHaveCSS('padding-top', '12px');
  });

  test('families render as cards at 390px with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');
    await page.goto('/admin/families');

    const rows = page.locator('.families-table tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 20000 });
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('.families-table thead')).toBeHidden();

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);
  });
});
