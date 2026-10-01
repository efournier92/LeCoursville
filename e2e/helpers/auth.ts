import { Page, expect } from '@playwright/test';

export const E2E_USERS = {
  admin: { email: 'admin@e2e.local', password: 'E2e-pass-2026' },
  user: { email: 'user@e2e.local', password: 'E2e-pass-2026' },
  other: { email: 'other@e2e.local', password: 'E2e-pass-2026' },
  sparse: { email: 'sparse@e2e.local', password: 'E2e-pass-2026' },
};

/**
 * Signs in through the real auth form (emulator auth). Lands on the promoted
 * route (/calendar) when navigation completes.
 */
export async function login(page: Page, who: 'admin' | 'user' | 'other' | 'sparse' = 'admin') {
  const creds = E2E_USERS[who];
  await page.goto('/');
  await page.getByTestId('auth-email').fill(creds.email);
  await page.getByTestId('auth-password').fill(creds.password);
  await page.getByTestId('auth-submit').click();
  // Successful sign-in navigates to the promoted route; wait for the toolbar
  // links to appear (user record + flags must load before that).
  await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();
}

/** Signs out through the real UI (confirm dialog included). */
export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByTestId('auth-email')).toBeVisible();
}
