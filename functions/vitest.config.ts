import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Failure-path specs assert on error handling and log the expected error
    // (for example the missing secret parameters). Keep those logs out of a
    // green run; a failing test still prints them.
    silent: 'passed-only',
  },
});
