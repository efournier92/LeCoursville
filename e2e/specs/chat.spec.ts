import { test, expect } from '../helpers/fixture';
import { login, logout } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';

// Chat is seeded OFF (mirrors dev, drives the feature-disabled tests). Tests
// that exercise the chat page enable the flag first and restore it after.

async function ensureAdmin(page: import('@playwright/test').Page) {
  // A fresh load of '/' auto-redirects signed-in users to the promoted route,
  // so the auth page is only reachable via the SPA Account link.
  const nav = page.locator('#lecoursville-navbar-links');
  const signedIn = await nav.isVisible().catch(() => false);
  if (signedIn) {
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page).toHaveURL('/');
    await logout(page);
  }
  await login(page, 'admin');
}

test.describe('chat', () => {
  test.afterEach(async ({ page }) => {
    await ensureAdmin(page);
    await setFeatureFlag(page, 'chat', false);
  });

  test('list renders the 3 seeded messages', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    await expect(page.getByText('Welcome to E2E')).toBeVisible();
    await expect(page.getByText('Second seed')).toBeVisible();
    await expect(page.getByText('From the user')).toBeVisible();
    await expect(page.getByText('Admin User').first()).toBeVisible();
    await expect(page.getByText('Regular User').first()).toBeVisible();
  });

  test('send message: user creates a message through the UI', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    // The Sign out button only exists on the Account page; reach it via the SPA link.
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page).toHaveURL('/');
    await logout(page);
    await login(page, 'user');
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
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    const card = page.locator('.message-card-container', { hasText: 'Second seed' }).first();
    await card.getByText('Edit').first().click();
    await page.getByTestId('chat-message-input').fill('Second seed — edited by e2e');
    await page.getByTestId('chat-send').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('Second seed — edited by e2e')).toBeVisible();
  });

  test('cross-user visibility: message sent by user is visible to other', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page).toHaveURL('/');
    await logout(page);
    await login(page, 'other');
    await page.goto('/chat');
    // The message created in the earlier 'send message' test (serial run, shared DB).
    await expect(page.getByText('E2E Sent Title')).toBeVisible();
    await expect(page.getByText('E2E sent body via UI')).toBeVisible();
  });
});
