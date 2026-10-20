import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.afterEach(async ({ collector }) => collector.assertClean());

test.describe('admin content surfaces', () => {
  test('media: only the live tabs render, and a filtered-out tab shows an empty message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/media');

    await expect(page.getByRole('tab', { name: 'Video' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Audio Album' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(2);

    const audioTab = page.getByRole('tab', { name: 'Audio Album' });
    await audioTab.click();
    const activeTab = page.locator('.mat-mdc-tab-body-active');
    await expect(activeTab.locator('.media-list-item').first()).toBeVisible();

    // Filtering everything out must leave an explicit message, never a
    // blank pane.
    await activeTab.getByLabel('Filter').fill('zzz-no-match');
    await expect(activeTab.locator('.no-results-message')).toBeVisible();
    await expect(activeTab.locator('.no-results-message')).toContainText('No media match');

    await activeTab.getByLabel('Filter').fill('');
    await expect(activeTab.locator('.media-list-item').first()).toBeVisible();
  });

  test('photo albums: seeded albums render, and a throwaway album delete can be cancelled then confirmed', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/photo-albums');
    await expect(page.getByText('E2E Album One')).toBeVisible();
    await expect(page.locator('.admin-album-grid')).toBeVisible();

    await page.getByRole('button', { name: 'New Album' }).click();
    const createDialog = page.locator('mat-dialog-container');
    await createDialog.getByLabel('Album title').fill('E2E Throwaway Album');
    await createDialog.getByRole('button', { name: 'Create' }).click();

    const throwaway = page.locator('.admin-album-card', { hasText: 'E2E Throwaway Album' });
    await expect(throwaway).toBeVisible();

    await throwaway.locator('button[matTooltip="Delete"]').click();
    const confirm = page.locator('app-confirm-dialog');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('E2E Throwaway Album');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(throwaway).toBeVisible();

    await throwaway.locator('button[matTooltip="Delete"]').click();
    await page.locator('app-confirm-dialog').getByRole('button', { name: 'Delete album' }).click();
    await expect(throwaway).toBeHidden();
    await expect(page.getByText('E2E Album One')).toBeVisible();
  });

  test('uploads: pending and all filters, and a rejected upload is kept when the confirm is cancelled', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/uploads');

    // The seeded upload is approved, so the default pending queue is empty.
    await expect(page.getByText("You're all caught up")).toBeVisible();

    await page.getByRole('button', { name: /All \(\d+\)/ }).click();
    await expect(page.locator('.admin-table')).toBeVisible();
    await expect(page.getByText('fixture.png').first()).toBeVisible();

    await page.getByRole('button', { name: 'Reject fixture.png' }).click();
    const confirm = page.locator('app-confirm-dialog');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('fixture.png');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();

    await expect(page.getByText('fixture.png').first()).toBeVisible();
    await page.getByRole('button', { name: /Pending \(\d+\)/ }).click();
    await expect(page.getByText("You're all caught up")).toBeVisible();
  });

  test('390x844: the uploads table becomes cards and the album grid is one column without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');

    await page.goto('/admin/uploads');
    await page.getByRole('button', { name: /All \(\d+\)/ }).click();
    await expect(page.getByText('fixture.png').first()).toBeVisible();
    await expect(page.locator('.admin-table thead')).toBeHidden();
    await expect(page.locator('td[data-label="File"]')).toBeVisible();

    const uploadsOverflow = await page.evaluate(() => {
      const content = document.querySelector('.admin-content') as HTMLElement;
      return { scrollWidth: content.scrollWidth, clientWidth: content.clientWidth };
    });
    expect(uploadsOverflow.scrollWidth).toBeLessThanOrEqual(uploadsOverflow.clientWidth + 1);

    await page.goto('/admin/photo-albums');
    await expect(page.getByText('E2E Album One')).toBeVisible();
    const columns = await page
      .locator('.admin-album-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(1);

    const albumsOverflow = await page.evaluate(() => {
      const content = document.querySelector('.admin-content') as HTMLElement;
      return { scrollWidth: content.scrollWidth, clientWidth: content.clientWidth };
    });
    expect(albumsOverflow.scrollWidth).toBeLessThanOrEqual(albumsOverflow.clientWidth + 1);
  });
});
