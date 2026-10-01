import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('public upload', () => {
  test('unauthenticated access: /upload renders without login', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByRole('heading', { name: 'Upload Files' })).toBeVisible();
    await expect(page.getByText('Click To Select Files')).toBeVisible();
  });

  test('happy path: upload creates a pending record visible to admin', async ({ page }) => {
    await page.goto('/upload');
    await page.getByLabel('Event Name').fill('E2E Reunion Upload');
    await page.getByTestId('upload-file-input').setInputFiles({
      name: 'family-photo.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('1 File Selected')).toBeVisible();
    await page.getByRole('button', { name: 'Upload All' }).click();
    await expect(page.getByText('Thanks For Sharing!')).toBeVisible({ timeout: 30000 });

    // Admin sees the new pending upload in the review queue.
    await login(page, 'admin');
    await page.goto('/admin/uploads');
    await expect(page.getByText('family-photo.png').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Pending').first()).toBeVisible();
  });

  test('validation: submit with no file is impossible (no upload button rendered)', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/upload');
    // The file list (and its Upload All button) only renders once files are selected.
    await expect(page.getByRole('button', { name: 'Upload All' })).toHaveCount(0);
    await page.waitForTimeout(500);
    const uploadRequests = requests.filter((u) => u.includes(':9199'));
    expect(uploadRequests).toHaveLength(0);
  });
});
