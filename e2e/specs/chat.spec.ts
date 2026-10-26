import { test, expect, Page } from '../helpers/fixture';
import { login, logout } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';

// Chat is seeded OFF (mirrors dev, drives the feature-disabled tests). Tests
// that exercise the chat page enable the flag through the admin UI; afterEach
// restores the messages node and the flag through the Admin SDK, so a failed
// page state can never block cleanup.

async function openChatAs(page: Page, who: 'admin' | 'user' | 'other') {
  await login(page, 'admin');
  await setFeatureFlag(page, 'chat', true);
  if (who === 'admin') {
    return;
  }
  // Sign out only from the Account page; reach it through the SPA link.
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page).toHaveURL('/');
  await logout(page);
  await login(page, who);
}

test.describe('chat', () => {
  let seededMessages: Record<string, any> | null = null;

  test.beforeEach(async () => {
    seededMessages = await readDb<Record<string, any>>('messages');
  });

  test.afterEach(async () => {
    try {
      if (seededMessages) {
        const current = (await readDb<Record<string, any>>('messages')) ?? {};
        for (const [id, message] of Object.entries(seededMessages)) {
          await writeDb(`messages/${id}`, message);
        }
        for (const id of Object.keys(current)) {
          if (!(id in seededMessages)) {
            await deleteDb(`messages/${id}`);
          }
        }
      }
    } finally {
      await writeDb('features/chat/enabled', false);
    }
  });

  test('list renders the 3 seeded messages', async ({ page }) => {
    await openChatAs(page, 'admin');
    await page.goto('/chat');
    await expect(page.getByText('Welcome to E2E')).toBeVisible();
    await expect(page.getByText('Second seed')).toBeVisible();
    await expect(page.getByText('From the user')).toBeVisible();
    await expect(page.getByText('Admin User').first()).toBeVisible();
    await expect(page.getByText('Regular User').first()).toBeVisible();
  });

  test('send message: user creates a message through the UI', async ({ page }) => {
    await openChatAs(page, 'user');
    await page.goto('/chat');
    await page.getByRole('button', { name: 'New Message' }).first().click();
    await page.getByPlaceholder('Title').fill('E2E Sent Title');
    await page.getByTestId('chat-message-input').fill('E2E sent body via UI');
    await page.getByTestId('chat-send').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('E2E Sent Title')).toBeVisible();
    await expect(page.getByText('E2E sent body via UI')).toBeVisible();
  });

  test('edit message: admin edits a seeded message', async ({ page }) => {
    await openChatAs(page, 'admin');
    await page.goto('/chat');
    const card = page.locator('.message-card-container', { hasText: 'Second seed' }).first();
    // The Edit label sits outside the click handler; the icon is the tappable target.
    await card.locator('.message-button', { hasText: 'Edit' }).locator('mat-icon').click();
    await page.getByTestId('chat-message-input').fill('Second seed — edited by e2e');
    await page.getByTestId('chat-send').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('Second seed — edited by e2e')).toBeVisible();
  });

  test('author self-edit: user edits the seeded msg-4 and it persists', async ({ page }) => {
    await openChatAs(page, 'user');
    await page.goto('/chat');
    const card = page.locator('.message-card-container', { hasText: 'Author Editable' }).first();
    await card.locator('.message-button', { hasText: 'Edit' }).locator('mat-icon').click();
    await page.getByTestId('chat-message-input').fill('E2E author editable — edited');
    await page.getByTestId('chat-send').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('E2E author editable — edited')).toBeVisible();
    await page.reload();
    await expect(page.getByText('E2E author editable — edited')).toBeVisible();
  });

  test('author gate: another user sees no Edit control on msg-4', async ({ page }) => {
    await openChatAs(page, 'other');
    await page.goto('/chat');
    const card = page.locator('.message-card-container', { hasText: 'Author Editable' }).first();
    await expect(card.getByText('E2E author editable')).toBeVisible();
    await expect(card.locator('.message-button', { hasText: 'Edit' })).toHaveCount(0);
  });

  test('like: user likes another author\'s message and it persists', async ({ page }) => {
    await openChatAs(page, 'user');
    await page.goto('/chat');
    const card = page.locator('.message-card-container', { hasText: 'Welcome to E2E' }).first();
    await card.locator('.message-like-icon').first().click();
    await page.keyboard.press('Escape');
    await expect(card.locator('.message-likes-container')).toHaveText(/^\s*[1-9]\d*\s*$/);
    await page.reload();
    const reloaded = page.locator('.message-card-container', { hasText: 'Welcome to E2E' }).first();
    await expect(reloaded.locator('.message-likes-container')).toHaveText(/^\s*[1-9]\d*\s*$/);
  });

  test('reply: user replies to another author\'s message and it persists', async ({ page }) => {
    await openChatAs(page, 'user');
    await page.goto('/chat');
    const card = page.locator('.message-card-container', { hasText: 'Welcome to E2E' }).first();
    await card.getByText('Reply').first().click();
    await card.getByTestId('chat-message-input').fill('E2E reply body');
    await card.getByTestId('chat-send').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('E2E reply body')).toBeVisible();
    await page.reload();
    await expect(page.getByText('E2E reply body')).toBeVisible();
  });

  test('cross-user visibility: seeded msg-3 is visible to other', async ({ page }) => {
    await openChatAs(page, 'other');
    await page.goto('/chat');
    await expect(page.getByText('From the user')).toBeVisible();
    await expect(page.getByText('A message from the regular user.')).toBeVisible();
  });

  test('empty state: no messages shows the visitor copy', async ({ page }) => {
    const messages = await readDb<Record<string, any>>('messages');
    try {
      await openChatAs(page, 'admin');
      // Warm the route with data first so the nulled node re-emits [] instead
      // of leaving a cold subscription on the skeleton.
      await page.goto('/chat');
      await expect(page.getByText('Welcome to E2E')).toBeVisible();
      await deleteDb('messages');
      await expect(page.getByText("We couldn't find any messages.")).toBeVisible();
      await expect(page.getByText('Start the conversation.')).toBeVisible();
    } finally {
      await writeDb('messages', messages);
      await writeDb('features/chat/enabled', false);
    }
  });
});
