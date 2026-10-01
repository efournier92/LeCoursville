import { test, expect } from '../helpers/fixture';
import { login, logout } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Security pass, emulator scope. Findings that are out of scope (console
// rules, password-reset email delivery) are listed in the morning report, not
// tested here.

test.describe('security', () => {
  test('guard bypass: tampering localStorage roles must NOT open /admin', async ({ page }) => {
    await login(page, 'user');
    await expect(page).toHaveURL(/\/calendar/);
    // Attacker edits their own localStorage user record to claim admin.
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.roles = { user: true, admin: true, super: true };
      localStorage.setItem('user', JSON.stringify(user));
    });
    await page.goto('/admin');
    // Secure behavior: the guard verifies against the real auth/RTDB record and
    // redirects. Vulnerable behavior: it trusts localStorage and renders admin.
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test('XSS: chat message bodies must not execute injected HTML', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'New Message' }).first().click();
    await page.getByPlaceholder('Title').fill('XSS probe');
    await page.getByTestId('chat-message-input').fill('<img src=x onerror="window.__xss=1">');
    await page.getByTestId('chat-send').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    // View as another user (the payload executes for ANY viewer).
    await page.getByRole('button', { name: 'Account' }).click();
    await logout(page);
    await login(page, 'other');
    await page.goto('/chat');
    await expect(page.getByText('XSS probe')).toBeVisible();
    await page.waitForTimeout(1000);
    const xss = await page.evaluate(() => (window as any).__xss ?? 0);
    expect(xss).toBe(0);
  });

  test('XSS: expression bodies must not execute injected HTML', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/expressions');
    await page.getByRole('button', { name: 'Create Expression' }).click();
    await page.getByLabel('Expression').fill('XSS expression');
    await page.getByLabel('Description').fill('<img src=x onerror="window.__xss=2">');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('XSS expression')).toBeVisible();
    await page.waitForTimeout(1000);
    const xss = await page.evaluate(() => (window as any).__xss ?? 0);
    expect(xss).toBe(0);
  });

  test('upload validation: non-image file types are accepted (finding probe)', async ({ page }) => {
    await page.goto('/upload');
    await page.getByTestId('upload-file-input').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    await expect(page.getByText('1 File Selected')).toBeVisible();
    await page.getByRole('button', { name: 'Upload All' }).click();
    // Accepted -> proves there is NO file-type validation on the public upload.
    await expect(page.getByText('Thanks For Sharing!')).toBeVisible({ timeout: 30000 });
  });

  test('outbound requests: a feature walk must not hit external hosts', async ({ page }) => {
    const external: string[] = [];
    await page.route('**/*', (route) => {
      const u = route.request().url();
      const local =
        u.startsWith('http://localhost:5000') ||
        u.startsWith('http://localhost:9099') ||
        u.startsWith('http://localhost:9000') ||
        u.startsWith('http://localhost:9199') ||
        u.startsWith('http://127.0.0.1:9199') ||
        u.startsWith('ws://localhost:9000') ||
        u.startsWith('ws://127.0.0.1');
      if (local) {
        return route.continue();
      }
      external.push(u);
      return route.abort().catch(() => {});
    });

    await login(page, 'admin');
    const walks = ['/contacts', '/calendar', '/expressions', '/photos', '/people', '/media/explorer', '/upload'];
    for (const route of walks) {
      await page.goto(route);
      await page.waitForTimeout(600);
    }
    // Only the seeded Drive video iframe and its Google API loader are known
    // external URLs (aborted, not loaded). The Drive player iframe itself
    // requests apis.google.com/js/api.js from inside the iframe.
    const unexpected = external.filter(
      (u) => !u.includes('drive.google.com') && !u.includes('apis.google.com'),
    );
    expect(unexpected).toEqual([]);
  });
});
