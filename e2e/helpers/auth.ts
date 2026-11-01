import { Page, expect } from '@playwright/test';

export const E2E_USERS = {
  admin: { email: 'admin@e2e.local', password: 'E2e-pass-2026' },
  user: { email: 'user@e2e.local', password: 'E2e-pass-2026' },
  other: { email: 'other@e2e.local', password: 'E2e-pass-2026' },
  staff: { email: 'staff@e2e.local', password: 'E2e-pass-2026' },
  sparse: { email: 'sparse@e2e.local', password: 'E2e-pass-2026' },
};

/**
 * Signs in through the real auth form (emulator auth). Lands on the promoted
 * route (/calendar) when navigation completes.
 */
export async function login(page: Page, who: 'admin' | 'user' | 'other' | 'sparse' | 'staff' = 'admin') {
  const creds = E2E_USERS[who];
  await page.goto('/');
  await page.getByTestId('auth-email').fill(creds.email);
  await page.getByTestId('auth-password').fill(creds.password);
  await page.getByTestId('auth-submit').click();
  // Successful sign-in navigates to the promoted route. Wait on the address
  // bar, not the desktop-only toolbar links: at mobile widths those links are
  // display:none, so the old wait hung on a phone-sized viewport.
  await page.waitForFunction(() => location.pathname !== '/', null, { timeout: 30000 });
  // The redirect can land before the RTDB user record is cached. Wait for the
  // localStorage record too, otherwise a following goto() can reload before
  // auth persistence completes (seen on WebKit).
  await page.waitForFunction(() => {
    try {
      return !!JSON.parse(localStorage.getItem('user') || 'null')?.id;
    } catch {
      return false;
    }
  }, null, { timeout: 30000 });
  // Let the navbar settle too: navigating away while the first RTDB streams
  // are still opening leaves the next page waiting on a cold connection
  // (reproduced on WebKit). Attached, not visible, so mobile widths work.
  await page.locator('#lecoursville-navbar-links').waitFor({ state: 'attached', timeout: 30000 });
}

/** Signs out through the real UI (confirm dialog included). */
export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByTestId('auth-email')).toBeVisible();
}
