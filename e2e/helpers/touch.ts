import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Asserts every visible match of `selector` renders at least `min` CSS px in
 * both dimensions, capped at `limit` elements. A selector that matches nothing
 * visible is a broken assertion, so it throws instead of passing vacuously.
 */
export async function expectMinTouchTarget(
  page: Page,
  selector: string,
  min = 24,
  opts?: { limit?: number },
): Promise<void> {
  const limit = opts?.limit ?? 12;
  const matches = page.locator(selector);
  const count = await matches.count();
  let checked = 0;
  for (let i = 0; i < count && checked < limit; i++) {
    const el = matches.nth(i);
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (!box || box.width === 0 || box.height === 0) continue;
    checked++;
    expect(box.width, `${selector} width ${box.width}px is below ${min}px`).toBeGreaterThanOrEqual(min);
    expect(box.height, `${selector} height ${box.height}px is below ${min}px`).toBeGreaterThanOrEqual(min);
  }
  if (checked === 0) {
    throw new Error(`expectMinTouchTarget: no visible match for selector "${selector}"`);
  }
}

/** Asserts every visible match of `selector` computes a font-size of at least `min` px. */
export async function expectInputFontSize(page: Page, selector: string, min = 16): Promise<void> {
  const matches = page.locator(selector);
  const count = await matches.count();
  let checked = 0;
  for (let i = 0; i < count; i++) {
    const el = matches.nth(i);
    if (!(await el.isVisible())) continue;
    checked++;
    const size = await el.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
    expect(size, `${selector} font-size ${size}px is below ${min}px`).toBeGreaterThanOrEqual(min);
  }
  if (checked === 0) {
    throw new Error(`expectInputFontSize: no visible match for selector "${selector}"`);
  }
}
