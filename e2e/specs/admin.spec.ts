import { test, expect } from '../helpers/fixture';
import { login, E2E_USERS } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';

test.afterEach(async ({ collector }) => collector.assertClean());

test.describe('admin', () => {
  test('users page lists the seeded users in a table', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    const table = page.getByTestId('admin-users-table');
    await expect(table).toBeVisible({ timeout: 20000 });
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(5);
    const names = await rows.locator('td[data-label="Name"]').allTextContents();
    expect(names).toEqual(
      expect.arrayContaining(['Admin User', 'Regular User', 'Other User', 'Staff Admin', 'Sparse User']),
    );
  });

  test('super admin sees the Admin link in the navbar', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/calendar');
    const navbar = page.locator('#lecoursville-navbar-links');
    await expect(navbar).toBeVisible();
    const adminLink = navbar.getByTestId('nav-admin-link');
    await expect(adminLink).toBeVisible();
    await expect(adminLink).toContainText('Admin');
    await adminLink.click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test('staff admin does not see the Admin link in the navbar', async ({ page }) => {
    await login(page, 'staff');
    await page.goto('/calendar');
    const navbar = page.locator('#lecoursville-navbar-links');
    await expect(navbar).toBeVisible();
    await expect(navbar.getByTestId('nav-admin-link')).toHaveCount(0);
  });

  test('user edit: a role change prompts for confirmation, and cancel writes nothing', async ({ page }) => {
    const users = (await readDb<Record<string, any>>('users')) ?? {};
    const entry = Object.entries(users).find(([, user]) => user?.email === 'user@e2e.local');
    expect(entry).toBeTruthy();
    const uid = entry![0];

    await login(page, 'admin');
    await page.goto('/admin/users');
    const table = page.getByTestId('admin-users-table');
    await expect(table.locator('tbody tr')).toHaveCount(5, { timeout: 20000 });
    const row = table.locator('tbody tr').filter({ hasText: 'user@e2e.local' });
    await expect(row).toBeVisible();
    const before = await readDb(`users/${uid}`);

    try {
      await row.getByRole('button', { name: 'Edit Regular User' }).click();
      const editor = page.getByRole('dialog').filter({ hasText: 'Edit user' });
      await expect(editor).toBeVisible();
      await editor.getByRole('checkbox', { name: 'Admin', exact: true }).click();
      await editor.getByRole('button', { name: 'Save' }).click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Change access?' });
      await expect(dialog).toContainText('Give Regular User admin access?');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);

      expect(await readDb(`users/${uid}`)).toEqual(before);
      await editor.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      await writeDb(`users/${uid}`, before);
    }
  });

  test('super admin sees the full grouped admin nav', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin');
    const nav = page.getByTestId('admin-nav');
    await expect(nav).toBeVisible();
    const links = [
      { name: 'Users', path: '/admin/users' },
      { name: 'Families', path: '/admin/families' },
      { name: 'People', path: '/admin/people' },
      { name: 'Calendars', path: '/admin/calendars' },
      { name: 'Media', path: '/admin/media' },
      { name: 'Photo Albums', path: '/admin/photo-albums' },
      { name: 'Uploads', path: '/admin/uploads' },
      { name: 'Recovery', path: '/admin/recovery' },
      { name: 'Features', path: '/admin/features' },
    ];
    const navItems = nav.locator('[data-testid^="admin-nav-link-"]');
    await expect(navItems).toHaveCount(links.length);
    for (const { name, path } of links) {
      const link = nav.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('app-page-toolbar').first()).toBeVisible();
    }
  });

  test('admin nav badges count pending uploads and open recovery requests', async ({ page }) => {
    const uploadKey = `badge-upload-${Date.now()}`;
    const recoveryKey = `badge-recovery-${Date.now()}`;
    await writeDb(`userUploads/${uploadKey}`, {
      id: uploadKey,
      path: `userUploads/e2e/${uploadKey}.png`,
      fileName: `${uploadKey}.png`,
      status: 'pending',
      dateAdded: Date.now(),
      uploader: { name: 'Regular User', email: 'user@e2e.local' },
    });
    await writeDb(`recoveryRequests/${recoveryKey}`, {
      id: recoveryKey,
      email: `${recoveryKey}@e2e.local`,
      status: 'open',
      createdAt: Date.now(),
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/users');
      const nav = page.getByTestId('admin-nav');
      const uploadsBadge = nav.getByTestId('admin-nav-badge-uploads');
      const recoveryBadge = nav.getByTestId('admin-nav-badge-recovery');
      await expect(uploadsBadge).toBeVisible();
      await expect(uploadsBadge.locator('[aria-hidden="true"]')).toHaveText('1');
      await expect(uploadsBadge).toContainText('1 pending');
      await expect(recoveryBadge).toBeVisible();
      await expect(recoveryBadge).toContainText('1 open');

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(nav).not.toBeVisible();
      await page.getByTestId('nav-menu-toggle').click();
      await expect(nav).toBeVisible();
      await expect(uploadsBadge).toBeVisible();
      await expect(recoveryBadge).toBeVisible();
      await page.keyboard.press('Escape');

      await deleteDb(`userUploads/${uploadKey}`);
      await deleteDb(`recoveryRequests/${recoveryKey}`);
      await expect(uploadsBadge).toHaveCount(0);
      await expect(recoveryBadge).toHaveCount(0);
    } finally {
      await deleteDb(`userUploads/${uploadKey}`);
      await deleteDb(`recoveryRequests/${recoveryKey}`);
    }
  });

  test('admin index redirects a super admin to users', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test('desktop shell keeps one scroll container and shows the version', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    const nav = page.getByTestId('admin-nav');
    await expect(nav).toBeVisible();
    await expect(page.getByTestId('nav-menu-toggle')).toBeHidden();
    await expect(page.locator('.sidebar-footer .version')).toHaveText(/^v\d+\.\d+\.\d+/);
    const overflow = await page.locator('.app-container').evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
  });

  test('skip link focuses the admin content', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByTestId('admin-nav')).toBeVisible();
    // Focus it directly: WebKit's default tab order only visits form fields,
    // so a Tab-based assertion would test the browser setting, not the link.
    const skip = page.getByTestId('admin-skip-link');
    await skip.focus();
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#admin-content')).toBeFocused();
  });

  test('mobile drawer opens, traps focus, closes with Escape, and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');
    await page.goto('/admin/users');
    const nav = page.getByTestId('admin-nav');
    const toggle = page.getByTestId('nav-menu-toggle');
    await expect(nav).not.toBeVisible();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(nav).toBeVisible();
    await expect(page.getByTestId('admin-nav-link-families')).toBeFocused();
    // The trap now includes the sidebar logo, so one Shift+Tab lands there and
    // the next wraps to the last item.
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.sidebar-header .logo-link')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('admin-nav-link-recovery')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(nav).not.toBeVisible();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.getByTestId('admin-nav-link-features').click();
    await expect(page).toHaveURL(/\/admin\/features$/);
    await expect(nav).not.toBeVisible();
  });

  test('non-super admin is redirected out of admin', async ({ page }) => {
    await login(page, 'staff');
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.locator('app-admin')).toHaveCount(0);
    await expect(page.getByTestId('admin-nav')).toHaveCount(0);
  });

  test('photo albums nav follows its feature flag', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'enablePhotoAlbums', false);
    try {
      await page.goto('/admin');
      const nav = page.getByTestId('admin-nav');
      const navItems = nav.locator('[data-testid^="admin-nav-link-"]');
      await expect(nav.getByRole('link', { name: 'Photo Albums', exact: true })).toHaveCount(0);
      await expect(navItems).toHaveCount(8);
      for (const name of ['Users', 'Families', 'People', 'Calendars', 'Media', 'Uploads', 'Recovery', 'Features']) {
        await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
      }
    } finally {
      await setFeatureFlag(page, 'enablePhotoAlbums', true);
    }
    await page.goto('/admin');
    await expect(
      page
        .getByTestId('admin-nav')
        .getByRole('link', { name: 'Photo Albums', exact: true }),
    ).toBeVisible();
  });

  test('features page renders 9 toggles with chat OFF and others ON', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/features');
    const ids = ['people', 'contacts', 'calendar', 'music', 'videos', 'photos', 'enablePhotoAlbums', 'expressions', 'chat'];
    for (const id of ids) {
      await expect(page.getByTestId(`feature-toggle-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId('feature-toggle-chat').locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('feature-toggle-contacts').locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('feature-toggle-enablePhotoAlbums').locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'true');
  });

  test('features page: toggle chat ON then OFF restores state', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/features');
    const chatToggle = page.getByTestId('feature-toggle-chat');
    const chatSwitch = chatToggle.locator('button[role="switch"]');
    await expect(chatSwitch).toHaveAttribute('aria-checked', 'false');
    try {
      await chatSwitch.click();
      await expect(chatSwitch).toHaveAttribute('aria-checked', 'true');
    } finally {
      await setFeatureFlag(page, 'chat', false);
    }
    await expect(chatSwitch).toHaveAttribute('aria-checked', 'false');
  });

  test('families page lists the 2 seeded families', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/families');
    await expect(page.getByText('Mignonne').first()).toBeVisible();
    await expect(page.getByText('Denis').first()).toBeVisible();
  });

  test('calendars page lists the seeded calendar year', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/calendars');
    const year = new Date().getFullYear().toString();
    await expect(page.getByText(year).first()).toBeVisible();
  });

  test('media library header sits with the list and dates render zero-padded ISO', async ({ page }) => {
    const id = `e2e-media-date-${Date.now()}`;
    await writeDb(`media/${id}`, {
      id,
      title: 'E2E Dated Album',
      artist: 'E2E Artist',
      date: '2026-6-30',
      folderName: '',
      fileName: '',
      isSticky: false,
      isHidden: false,
      listing: [],
      urls: { download: 'https://example.test/album', icon: '' },
      type: 'audio-album',
      format: 'collection/audio',
      dateUpdated: Date.now(),
    });

    try {
      await login(page, 'admin');
      await page.goto('/admin/media');
      await page.getByRole('tab', { name: 'Audio Album' }).click();

      await expect(page.getByText('Library').first()).toBeVisible();
      const item = page.locator('.media-list-item').filter({ hasText: 'E2E Dated Album' });
      await expect(item.locator('.media-details-date')).toHaveText('2026-06-30');
    } finally {
      await deleteDb(`media/${id}`);
    }
  });

  test('uploads page lists the pre-seeded approved upload', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/uploads');
    // The review queue defaults to the pending filter; the seeded upload is approved.
    await page.getByRole('button', { name: /All \(\d+\)/ }).click();
    await expect(page.getByText('fixture.png').first()).toBeVisible();
    await expect(page.getByText('Approved').first()).toBeVisible();
  });

  test('people import: CSV import previews and adds a person', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/people');
    const csv = [
      'ID,Name_First_Given,Name_First_Preferred,Name_Last,Birthday,Generation_Number,Living?,Address_Street,Family',
      'import-1,Zoe,Zoe,Zimmerman,1990-01-15,1,TRUE,123 E2E St,Mignonne',
    ].join('\n');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'people.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText('Import Preview')).toBeVisible();
    await expect(page.getByText('To Create').first()).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Import' }).click();
    await expect(page.getByText('Import Complete')).toBeVisible({ timeout: 15000 });
    await page.goto('/people');
    await expect(page.getByText('Zoe Zimmerman').first()).toBeVisible();
  });

  test('access denial: regular user cannot open /admin', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page).toHaveURL(/\/calendar/);
  });
});
