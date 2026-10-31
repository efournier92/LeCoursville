import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { deleteDb, readDb, writeDb } from '../helpers/admin-db';

const STORAGE_ORIGIN = 'http://127.0.0.1:9199';
const STORAGE_BUCKET = 'lecoursville-dev.appspot.com';
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function putStorageObject(path: string): Promise<void> {
  const res = await fetch(
    `${STORAGE_ORIGIN}/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: TINY_PNG },
  );
  if (!res.ok) {
    throw new Error(`storage seed ${path} -> HTTP ${res.status}`);
  }
}

async function deleteStorageObject(path: string): Promise<void> {
  await fetch(
    `${STORAGE_ORIGIN}/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}`,
    { method: 'DELETE' },
  ).catch(() => undefined);
}

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
    await expect(page.getByTestId('admin-role-history-empty')).toHaveText('No role changes yet.');

    await expect(regular.getByRole('button', { name: 'Edit Regular User' })).toBeVisible();
    await expect(regular.getByRole('button', { name: 'Delete Regular User' })).toBeVisible();
  });

  test('users: role badges compute their member, admin, and super token pairs', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');

    const table = page.getByTestId('admin-users-table');
    await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });

    const badge = (email: string, role: string) =>
      table
        .locator('tbody tr')
        .filter({ hasText: email })
        .locator('.role-badge')
        .filter({ hasText: role });

    const member = badge('user@e2e.local', 'Member');
    await expect(member).toHaveCSS('background-color', 'rgb(236, 239, 241)');
    await expect(member).toHaveCSS('color', 'rgb(55, 71, 79)');

    const admin = badge('staff@e2e.local', 'Admin');
    await expect(admin).toHaveCSS('background-color', 'rgb(232, 234, 246)');
    await expect(admin).toHaveCSS('color', 'rgb(40, 53, 147)');

    const superBadge = badge('admin@e2e.local', 'Super');
    await expect(superBadge).toHaveCSS('background-color', 'rgb(243, 229, 245)');
    await expect(superBadge).toHaveCSS('color', 'rgb(106, 27, 154)');
  });

  test('users: role history shows when, actor, target, and before -> after roles', async ({ page }) => {
    const key = `e2e-audit-${Date.now()}`;
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const adminUid = Object.entries(users).find(([, user]) => user?.email === 'admin@e2e.local')?.[0];
    await writeDb(`roleAudit/${key}`, {
      actorId: adminUid,
      targetId: 'e2e-target-uid',
      targetEmail: 'user@e2e.local',
      before: { admin: false, super: false },
      after: { admin: true, super: false },
      at: Date.now(),
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/users');

      const history = page.getByTestId('admin-role-history');
      await expect(history).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.role-history-card')).toContainText('Most recent 20 changes');
      const row = history.locator('tbody tr').filter({ hasText: 'user@e2e.local' });
      await expect(row).toContainText('Admin User');
      await expect(row).toContainText('Member');
      await expect(row).toContainText('Admin');
    } finally {
      await deleteDb(`roleAudit/${key}`);
    }
  });

  test('users: granting then revoking admin persists the role and writes one audit row per change', async ({ page }) => {
    const startedAt = Date.now();
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const targetEntry = Object.entries(users).find(([, user]) => user?.email === 'user@e2e.local');
    const adminEntry = Object.entries(users).find(([, user]) => user?.email === 'admin@e2e.local');
    expect(targetEntry).toBeTruthy();
    expect(adminEntry).toBeTruthy();
    const [uid, target] = targetEntry!;
    const [adminUid] = adminEntry!;
    const rolesBefore = target.roles;
    expect(rolesBefore.super).not.toBe(true);
    const auditBefore = (await readDb<Record<string, any>>('roleAudit')) ?? {};

    const newAudits = async () =>
      Object.entries((await readDb<Record<string, any>>('roleAudit')) ?? {}).filter(
        ([key]) => !(key in auditBefore),
      );

    try {
      await login(page, 'admin');
      await page.goto('/admin/users');
      const table = page.getByTestId('admin-users-table');
      await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });
      const row = table.locator('tbody tr').filter({ hasText: 'user@e2e.local' });

      await row.getByRole('button', { name: 'Edit Regular User' }).click();
      const editor = page.getByRole('dialog').filter({ hasText: 'Edit user' });
      await expect(editor).toBeVisible();
      await editor.getByRole('checkbox', { name: 'Admin', exact: true }).click();
      await editor.getByRole('button', { name: 'Save' }).click();
      const grantDialog = page.getByRole('dialog').filter({ hasText: 'Change access?' });
      await expect(grantDialog).toContainText('Give Regular User admin access?');
      await grantDialog.getByRole('button', { name: 'Save' }).click();
      await expect(editor).toHaveCount(0);

      await expect
        .poll(async () => (await readDb<Record<string, any>>(`users/${uid}/roles`))?.admin)
        .toBe(true);
      await expect.poll(async () => (await newAudits()).length).toBe(1);
      const grant = (await newAudits())[0][1];
      expect(grant.actorId).toBe(adminUid);
      expect(grant.targetId).toBe(uid);
      expect(grant.targetEmail).toBe('user@e2e.local');
      expect(grant.before).toEqual({ user: true, admin: false, super: false });
      expect(grant.after).toEqual({ user: true, admin: true, super: false });
      expect(grant.at).toBeGreaterThanOrEqual(startedAt);

      await row.getByRole('button', { name: 'Edit Regular User' }).click();
      const reopen = page.getByRole('dialog').filter({ hasText: 'Edit user' });
      await expect(reopen).toBeVisible();
      await reopen.getByRole('checkbox', { name: 'Admin', exact: true }).click();
      await reopen.getByRole('button', { name: 'Save' }).click();
      const revokeDialog = page.getByRole('dialog').filter({ hasText: 'Change access?' });
      await expect(revokeDialog).toContainText('Remove admin access from Regular User?');
      await revokeDialog.getByRole('button', { name: 'Save' }).click();
      await expect(reopen).toHaveCount(0);

      await expect
        .poll(async () => (await readDb<Record<string, any>>(`users/${uid}/roles`))?.admin)
        .toBe(false);
      await expect.poll(async () => (await newAudits()).length).toBe(2);
      const revoke = (await newAudits()).find(
        ([, entry]) => entry?.before?.admin === true && entry?.after?.admin === false,
      )?.[1];
      expect(revoke).toBeTruthy();
      expect(revoke.actorId).toBe(adminUid);
      expect(revoke.targetId).toBe(uid);
      expect(revoke.targetEmail).toBe('user@e2e.local');
      expect(revoke.before).toEqual({ user: true, admin: true, super: false });
      expect(revoke.after).toEqual({ user: true, admin: false, super: false });
    } finally {
      await writeDb(`users/${uid}/roles`, rolesBefore);
      for (const [key] of await newAudits()) {
        await deleteDb(`roleAudit/${key}`);
      }
    }
  });

  test('users: pending uploads referencing the member are named in the delete confirmation', async ({ page }) => {
    const uploadKey = `e2e-pending-upload-${Date.now()}`;
    await writeDb(`userUploads/${uploadKey}`, {
      id: uploadKey,
      status: 'pending',
      uploader: { name: 'Regular User', email: 'user@e2e.local' },
      fileName: 'pending.png',
      fileType: 'image/png',
      fileSize: 68,
      dateAdded: Date.now(),
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/users');

      const table = page.getByTestId('admin-users-table');
      await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });
      const row = table.locator('tbody tr').filter({ hasText: 'user@e2e.local' });

      await row.getByRole('button', { name: 'Delete Regular User' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('2 pending uploads reference this member');
      await expect(dialog).toContainText('Pending uploads stay in the queue after deletion.');

      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(row).toBeVisible();
    } finally {
      await deleteDb(`userUploads/${uploadKey}`);
    }
  });

  test('users: delete confirmation says when pending uploads could not be checked', async ({ page }) => {
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const entry = Object.entries(users).find(([, user]) => user?.email === 'admin@e2e.local');
    expect(entry).toBeTruthy();
    const [uid, adminUser] = entry!;
    const roles = adminUser.roles;

    await login(page, 'admin');
    try {
      // Super without admin: the users list still loads, but userUploads is denied.
      await writeDb(`users/${uid}/roles`, { user: true, admin: false, super: true });
      await page.goto('/admin/users');

      const table = page.getByTestId('admin-users-table');
      await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });
      const row = table.locator('tbody tr').filter({ hasText: 'user@e2e.local' });

      await row.getByRole('button', { name: 'Delete Regular User' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Could not check pending uploads.');
      await expect(dialog).toContainText('Pending uploads stay in the queue after deletion.');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
    } finally {
      await writeDb(`users/${uid}/roles`, roles);
    }
  });

  test('users: Edit opens the editor dialog and Cancel closes it unchanged', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');

    const table = page.getByTestId('admin-users-table');
    await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });
    const row = table.locator('tbody tr').filter({ hasText: 'user@e2e.local' });

    await row.getByRole('button', { name: 'Edit Regular User' }).click();
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

    await row.getByRole('button', { name: 'Delete Regular User' }).click();
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

  test('calendars: editing a year onto an existing year warns before renaming', async ({ page }) => {
    const id = 'e2e-cal-1998';
    const year = '1998';
    const targetYear = new Date().getFullYear().toString();
    await writeDb(`calendars/${id}`, {
      id,
      year,
      url: 'https://example.test/e2e-1998.pdf',
      path: '',
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/calendars');
      const row = page.locator('.admin-table tbody tr').filter({ hasText: year });
      await expect(row).toBeVisible();

      await row.getByRole('button', { name: `Edit ${year}` }).click();
      await page.getByLabel('Year (e.g. 2026)').fill(targetYear);
      await page.getByRole('button', { name: 'Update' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Replace calendar?');
      await expect(dialog).toContainText(targetYear);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);

      await expect.poll(async () => (await readDb<{ year?: string }>(`calendars/${id}`))?.year)
        .toBe(year);
    } finally {
      await deleteDb(`calendars/${id}`);
    }
  });

  test('features: ten grouped toggles with the seeded chat OFF and contacts ON', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/features');

    const ids = ['people', 'contacts', 'calendar', 'songs', 'music', 'videos', 'photos', 'enablePhotoAlbums', 'expressions', 'chat'];
    for (const id of ids) {
      await expect(page.getByTestId(`feature-toggle-${id}`)).toBeVisible();
    }
    for (const label of ['People', 'Content', 'System']) {
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    }

    await expect(page.getByTestId('feature-toggle-chat').locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('feature-toggle-contacts').locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'true');
    // Engine-agnostic stamp check: title-case prefix + digits in the suffix.
    await expect(page.getByTestId('feature-changed-chat')).toContainText(/^\s*Changed\b/);
    await expect(page.getByTestId('feature-changed-chat')).toContainText(/\d/);
  });

  test('features: warns when the stored promoted route belongs to a disabled flag', async ({ page }) => {
    const before = await readDb('promotedRoute');
    await writeDb('promotedRoute', { route: '/chat', updatedAt: Date.now() });
    try {
      await login(page, 'admin');
      await page.goto('/admin/features');

      const warning = page.getByTestId('promoted-route-warning');
      await expect(warning).toBeVisible();
      await expect(warning).toContainText('Chat is currently off');
      await expect(warning).toContainText('feature-disabled page');
    } finally {
      await writeDb('promotedRoute', before);
    }
  });

  test('features: toggles and promoted-route changes write audit rows', async ({ page }) => {
    const startedAt = Date.now();
    const featureBefore = await readDb('features/music');
    const routeBefore = await readDb('promotedRoute');
    const auditBefore = (await readDb<Record<string, any>>('featureFlagAudit')) ?? {};
    try {
      await login(page, 'admin');
      await page.goto('/admin/features');

      const music = page.getByTestId('feature-toggle-music').locator('button[role="switch"]');
      await music.click();
      await expect(music).toHaveAttribute('aria-checked', 'false');

      await page.getByLabel('Default Landing Page').click();
      await page.getByRole('option', { name: /Chat/ }).click();

      await expect
        .poll(async () => {
          const all = (await readDb<Record<string, any>>('featureFlagAudit')) ?? {};
          const rows = Object.values(all).filter(
            (value) => value?.actorEmail === 'admin@e2e.local' && value?.at >= startedAt,
          );
          return rows.some((value) => value?.flagId === 'music' && value?.field === 'enabled' && value?.from === true && value?.to === false)
            && rows.some((value) => value?.flagId === 'promotedRoute' && value?.field === 'promotedRoute' && value?.to === '/chat');
        }, { timeout: 15000 })
        .toBe(true);
    } finally {
      await writeDb('features/music', featureBefore);
      await writeDb('promotedRoute', routeBefore);
      const after = (await readDb<Record<string, any>>('featureFlagAudit')) ?? {};
      for (const key of Object.keys(after)) {
        if (!(key in auditBefore)) {
          await deleteDb(`featureFlagAudit/${key}`);
        }
      }
    }
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

  test('uploads: triage actions share one 32px box and tint only actionable rows', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/uploads');
    await page.getByRole('button', { name: /All \(\d+\)/ }).click();

    const rows = page.locator('.uploads-table tbody tr');
    await expect(rows).toHaveCount(3);
    const approved = rows.filter({ hasText: 'fixture.png' });
    const pending = rows.filter({ hasText: 'pending.png' });
    await expect(approved).toBeVisible();
    await expect(pending).toBeVisible();

    const boxes = await approved
      .locator('.upload-actions .mat-mdc-icon-button')
      .evaluateAll((els) =>
        els.map((el) => {
          const rect = el.getBoundingClientRect();
          return `${rect.width}x${rect.height}`;
        }),
      );
    expect(boxes).toHaveLength(3);
    expect(new Set(boxes).size).toBe(1);
    expect(boxes[0]).toBe('32x32');

    await expect(approved.locator('.approve-btn')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(approved.locator('.approve-btn mat-icon')).toHaveCSS('color', 'rgb(138, 145, 156)');

    await expect(pending.locator('.preview-btn mat-icon')).toHaveCSS('color', 'rgb(91, 100, 112)');
    await expect(pending.locator('.reject-btn mat-icon')).toHaveCSS('color', 'rgb(179, 38, 30)');
    await expect(pending.locator('.approve-btn mat-icon')).toHaveCSS('color', 'rgb(45, 90, 39)');

    const approve = pending.locator('.approve-btn');
    await expect(approve).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await approve.hover();
    await expect(approve).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('uploads at 390px: media rows keep 44px actions and approving the pending row flips its status', async ({ page }) => {
    const originalPending = await readDb('userUploads/upload-pending');
    const flagBefore = await readDb('features/enablePhotoAlbums');
    const photosBefore = (await readDb<Record<string, any>>('photos')) ?? {};
    await putStorageObject('userUploads/e2e/pending.png');
    await writeDb('features/enablePhotoAlbums', { enabled: false, updatedAt: Date.now() });

    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, 'admin');
      await page.goto('/admin/uploads');
      await page.getByRole('button', { name: /All \(\d+\)/ }).click();

      const rows = page.locator('.uploads-table tbody tr');
      await expect(rows).toHaveCount(3);
      await expect(page.locator('.uploads-table thead')).toBeHidden();

      for (const name of ['fixture.png', 'pending.png', 'rejected.png']) {
        await expect(rows.filter({ hasText: name })).toBeVisible();
      }

      const thumbnail = rows.filter({ hasText: 'fixture.png' }).locator('.upload-thumbnail');
      const thumb = await thumbnail.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height, radius: getComputedStyle(el).borderRadius };
      });
      expect(thumb.width).toBe(72);
      expect(thumb.height).toBe(72);
      expect(thumb.radius).toBe('0px');

      const overflow = await page.locator('.uploads-body').evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      for (const name of ['fixture.png', 'pending.png', 'rejected.png']) {
        const row = rows.filter({ hasText: name });
        for (const label of ['Preview', 'Approve', 'Reject']) {
          const action = row.getByRole('button', { name: new RegExp(`^${label} `) });
          await expect(action).toBeVisible();
          const box = await action.boundingBox();
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
      }

      const pending = rows.filter({ hasText: 'pending.png' });
      await pending.getByRole('button', { name: 'Approve pending.png' }).click();
      await expect(pending.locator('.upload-status')).toHaveText('Approved', { timeout: 15000 });
      await expect
        .poll(async () => (await readDb<{ status?: string }>('userUploads/upload-pending'))?.status)
        .toBe('approved');
    } finally {
      await writeDb('userUploads/upload-pending', originalPending);
      await writeDb('features/enablePhotoAlbums', flagBefore);
      const photosAfter = (await readDb<Record<string, any>>('photos')) ?? {};
      for (const [id, photo] of Object.entries(photosAfter)) {
        if (id in photosBefore) {
          continue;
        }
        const path = (photo as { path?: string })?.path;
        if (typeof path === 'string') {
          await deleteStorageObject(path);
        }
        await deleteDb(`photos/${id}`);
      }
      await deleteStorageObject('userUploads/e2e/pending.png');
    }
  });
});
