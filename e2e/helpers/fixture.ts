import { test as base, Page } from '@playwright/test';
import { collectConsoleErrors, ConsoleCollector } from './console';

/**
 * Base test with a console-error collector attached per test. Every spec
 * imports { test, expect } from this file; afterEach asserts the collected
 * errors are clean (allowlisted messages filtered out).
 */
export const test = base.extend<{ collector: ConsoleCollector }>({
  collector: async ({ page }, use) => {
    const collector = collectConsoleErrors(page);
    await use(collector);
  },
});

export { expect } from '@playwright/test';
export type { Page };
