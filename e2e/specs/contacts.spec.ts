import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { expectNoHorizontalOverflow } from '../helpers/overflow';
import { readDb, writeDb } from '../helpers/admin-db';

// The contacts page is a people-derived directory (people + families in RTDB).
// The legacy `contacts` node is not read by the current UI.

test.describe('contacts', () => {
  test('top bars do not overflow horizontally at 900px and 768px', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    try {
      for (const width of [900, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/contacts');
        await expectNoHorizontalOverflow(page.locator('app-page-toolbar .page-toolbar'));
        await expectNoHorizontalOverflow(page.locator('mat-toolbar'));
      }
    } finally {
      await page.setViewportSize(original);
    }
  });

  test('list renders the seeded people as contact cards', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown').first()).toBeVisible();
    await expect(page.getByText('Carol Clark').first()).toBeVisible();
    await expect(page.getByText('Dave Davis').first()).toBeVisible();
  });

  test('search filters the list by name substring', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.getByLabel('Filter').fill('Alice');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('empty state: nonsense search shows no-results message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.getByLabel('Filter').fill('zzznope');
    await expect(
      page.getByText('We couldn\'t find any contacts matching "zzznope".'),
    ).toBeVisible();
  });

  test('family filter narrows the list', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.locator('.family-filter-form-field mat-select').click({ force: true });
    await page.getByRole('option', { name: 'Mignonne' }).click();
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('?clan= alias applies the family filter', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts?clan=Mignonne');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('contact detail: clicking a name opens the person modal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    const aliceCard = page.locator('.contact-card', { hasText: 'Alice Anderson' }).first();
    await aliceCard.locator('.clickable-name').first().click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
    await expect(page.locator('app-person-detail-modal')).toContainText('Mignonne');
  });
});

// Read-only boundary + admin fixup surface for the legacy contacts node.
test.describe('contacts read-only + admin fixup', () => {
  test('member contact directory renders no edit surfaces', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/contacts');
    await expect(page.locator('app-contact-edit')).toHaveCount(0);
    await expect(page.locator('mat-card-footer')).toHaveCount(0);
  });

  test('admin contacts list shows seeded contacts and opens the fixup editor', async ({ page }) => {
    const seeded = await readDb<Record<string, any>>('contacts/contact-1');
    try {
      await login(page, 'admin');
      await page.goto('/admin/contacts');
      await expect(page.locator('.admin-contacts-row', { hasText: 'Legacy Contact One' })).toBeVisible();
      await expect(page.locator('.admin-contacts-row', { hasText: 'one@e2e.local' })).toBeVisible();

      await page.locator('.admin-contacts-row', { hasText: 'Legacy Contact One' }).click();
      await expect(page).toHaveURL(/\/admin\/contacts\/contact-1/);
      await expect(page.getByPlaceholder('Name')).toHaveValue('Legacy Contact One');

      // Fixup: rename and save through the reused contact-edit surface
      // (the save control is icon-only).
      await page.getByPlaceholder('Name').fill('Legacy Contact One — fixed');
      await page.locator('mat-card-footer button').filter({ hasText: 'save' }).click();
      await expect
        .poll(async () => (await readDb<Record<string, any>>('contacts/contact-1'))?.name)
        .toBe('Legacy Contact One — fixed');

      // C-20261031-25: the seeded non-editable contact opens through the same
      // admin surface (its isEditable flag is stored data; the editor renders
      // the record either way).
      await page.goto('/admin/contacts/contact-3');
      await expect(page.getByPlaceholder('Name')).toHaveValue('Legacy Contact Three');
    } finally {
      if (seeded) {
        await writeDb('contacts/contact-1', seeded);
      }
    }
  });
});
