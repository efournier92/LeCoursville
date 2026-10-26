import { expect, Locator } from '@playwright/test';

/**
 * Asserts the element itself does not scroll horizontally. Compares the
 * element's scrollWidth to its clientWidth: `.app-container` is the scroll
 * container with overflow-x hidden, so document-level checks are false green.
 */
export async function expectNoHorizontalOverflow(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const { scrollWidth, clientWidth } = await locator.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(
    scrollWidth,
    `Expected no horizontal overflow on ${locator}: scrollWidth ${scrollWidth}px exceeds clientWidth ${clientWidth}px`,
  ).toBeLessThanOrEqual(clientWidth);
}
