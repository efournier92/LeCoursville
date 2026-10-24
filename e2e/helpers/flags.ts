import { Page, expect } from '@playwright/test';

/**
 * Sets a feature flag through the real admin UI (/admin/features). The caller
 * must be logged in as admin. Used by chat.spec (chat is seeded OFF) and
 * feature-flags.spec (mutation tests). Always restore the flag in afterEach.
 */
export async function setFeatureFlag(page: Page, featureId: string, on: boolean) {
  await page.goto('/admin/features');
  await expect(page.getByTestId('features-loading')).toHaveCount(0);
  const toggle = page.getByTestId(`feature-toggle-${featureId}`);
  await expect(toggle).toBeVisible();
  const switchButton = toggle.locator('button[role="switch"]');
  await expect(switchButton).toBeEnabled();
  const isOn = (await switchButton.getAttribute('aria-checked')) === 'true';
  if (isOn !== on) {
    await switchButton.click();
  }
  await expect(switchButton).toHaveAttribute('aria-checked', on ? 'true' : 'false');
}
