import { Page, expect } from '@playwright/test';

/**
 * Sets a feature flag through the real admin UI (/admin/features). The caller
 * must be logged in as admin. Used by chat.spec (chat is seeded OFF) and
 * feature-flags.spec (mutation tests). Always restore the flag in afterEach.
 */
export async function setFeatureFlag(page: Page, featureId: string, on: boolean) {
  await page.goto('/admin/features');
  const toggle = page.getByTestId(`feature-toggle-${featureId}`);
  await expect(toggle).toBeVisible();
  const input = toggle.locator('input[type="checkbox"]');
  if ((await input.isChecked()) !== on) {
    await toggle.click();
  }
  await expect(input).toBeChecked({ checked: on });
}
