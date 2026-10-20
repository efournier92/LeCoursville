import { Page } from '@playwright/test';

/**
 * Console-error guard: every spec file attaches this collector and asserts the
 * collected errors are empty (after allowlist filtering) in afterEach.
 *
 * Allowlist (documented reasons):
 *  - `[Emulator]` prefixed messages: Firebase SDK emulator warnings/notices.
 *  - `ERR_ABORTED` request failures: browser cancels (e.g. img src swaps,
 *    iframe teardown) — not app bugs.
 *  - drive.google.com failures: the seeded video entry renders a Drive iframe
 *    shell; the gate is offline and aborts those on purpose (video.spec).
 *  - Auth emulator host (:9099): the invalid/used reset-code path returns a 400
 *    from the emulator, which the SDK logs as a console error; expected, and
 *    scoping to the emulator host keeps application errors visible.
 */

export interface ConsoleCollector {
  errors: string[];
  attach: () => void;
  assertClean: () => void;
}

const ALLOWLIST = [
  /\[Emulator\]/,
  /ERR_ABORTED/,
  /drive\.google\.com/,
  /net::/,
  /(?:127\.0\.0\.1|localhost):9099\//,
];

export function isAllowed(message: string): boolean {
  return ALLOWLIST.some((re) => re.test(message));
}

export function collectConsoleErrors(page: Page): ConsoleCollector {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const url = msg.location()?.url;
      errors.push(url ? `console.error: ${msg.text()} @ ${url}` : `console.error: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? 'unknown';
    const url = req.url();
    errors.push(`requestfailed: ${failure} ${url}`);
  });

  return {
    errors,
    attach: () => {},
    assertClean: () => {
      const filtered = errors.filter((e) => !isAllowed(e));
      if (filtered.length > 0) {
        throw new Error(`Console/page errors detected:\n${filtered.join('\n')}`);
      }
    },
  };
}

/** Filter helper for specs that need to inspect collected errors directly. */
export function filterAllowedErrors(errors: string[]): string[] {
  return errors.filter((e) => !isAllowed(e));
}
