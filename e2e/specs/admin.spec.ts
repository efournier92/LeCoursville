import { test, expect } from '../helpers/fixture';
import { login, E2E_USERS } from '../helpers/auth';

test.describe('admin', () => {
  test('users page lists the 3 seeded users', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('app-user-edit').first()).toBeVisible({ timeout: 20000 });
    const names = await page.locator('input[name="user-name"]').evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value),
    );
    expect(names).toEqual(expect.arrayContaining(['Admin User', 'Regular User', 'Other User']));
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
