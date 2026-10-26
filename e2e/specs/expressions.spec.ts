import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';

const CREATED_TITLE = 'E2E New Expression';
const EDITED_TITLE = 'Make it so — e2e edit';

async function findExpressionId(title: string): Promise<string | null> {
  const messages = (await readDb<Record<string, any>>('messages')) ?? {};
  const found = Object.entries(messages).find(([, message]) => message?.title === title);
  return found?.[0] ?? null;
}

test.describe('expressions', () => {
  test('list renders the 2 seeded expressions', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/expressions');
    await expect(page.getByText('Live long and prosper')).toBeVisible();
    await expect(page.getByText('Make it so')).toBeVisible();
  });

  test('create expression: admin creates one via the edit card', async ({ page }) => {
    try {
      await login(page, 'admin');
      await page.goto('/expressions');
      await page.getByRole('button', { name: 'Create Expression' }).click();
      await page.getByLabel('Expression').fill(CREATED_TITLE);
      await page.getByLabel('Attribution').fill('E2E Family');
      await page.getByLabel('Author').fill('E2E Author');
      await page.getByLabel('Year Written').fill('2026');
      await page.getByLabel('Description').fill('Created by the e2e gate.');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('button', { name: 'Yes' }).click();
      // Wait for the server write before reloading: the in-place card text
      // comes from the local ngModel, so only the stored record proves it.
      await expect.poll(() => findExpressionId(CREATED_TITLE)).not.toBeNull();
      await page.reload();
      await expect(page.getByText(CREATED_TITLE)).toBeVisible();
    } finally {
      const createdId = await findExpressionId(CREATED_TITLE);
      if (createdId) {
        await deleteDb(`messages/${createdId}`);
      }
    }
  });

  test('edit expression: change attribution/title, appears updated', async ({ page }) => {
    const seeded = await readDb<Record<string, any>>('messages/expr-2');
    try {
      await login(page, 'admin');
      await page.goto('/expressions');
      const card = page.locator('.expression-card-wrapper', { hasText: 'Make it so' }).first();
      await card.locator('.expression-actions button').first().click();
      await page.getByLabel('Expression').fill(EDITED_TITLE);
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('button', { name: 'Yes' }).click();
      await expect
        .poll(async () => (await readDb<Record<string, any>>('messages/expr-2'))?.title)
        .toBe(EDITED_TITLE);
      await page.reload();
      await expect(page.getByText(EDITED_TITLE)).toBeVisible();
    } finally {
      // Restore the whole seeded record: the update payload rewrites the
      // content fields and the isSaved/isEditable flags together.
      if (seeded) {
        await writeDb('messages/expr-2', seeded);
      }
    }
  });

  test('empty state: nonsense search renders no-results message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/expressions');
    await page.getByLabel('Filter').fill('zzznope');
    await expect(
      page.getByText('We couldn\'t find any expressions matching "zzznope".'),
    ).toBeVisible();
  });
});
