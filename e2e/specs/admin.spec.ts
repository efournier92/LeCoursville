import { test, expect } from '../helpers/fixture';
import { login, E2E_USERS } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';

test.describe('admin', () => {
  test('users page lists the seeded users', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('app-user-edit').first()).toBeVisible({ timeout: 20000 });
    const names = await page.locator('input[name="user-name"]').evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value),
    );
    expect(names).toEqual(
      expect.arrayContaining(['Admin User', 'Regular User', 'Other User', 'Staff Admin', 'Sparse User']),
    );
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

  test('admin index redirects a super admin to users', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/users$/);
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
    await expect(page.getByTestId('feature-toggle-chat').locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(page.getByTestId('feature-toggle-contacts').locator('input[type="checkbox"]')).toBeChecked();
    await expect(page.getByTestId('feature-toggle-enablePhotoAlbums').locator('input[type="checkbox"]')).toBeChecked();
  });

  test('features page: toggle chat ON then OFF restores state', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/features');
    const chatToggle = page.getByTestId('feature-toggle-chat');
    const chatInput = chatToggle.locator('input[type="checkbox"]');
    await expect(chatInput).not.toBeChecked();
    await chatToggle.click();
    await expect(chatInput).toBeChecked();
    await chatToggle.click();
    await expect(chatInput).not.toBeChecked();
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
