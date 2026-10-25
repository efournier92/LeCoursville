import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vitest/config';

// calendar-utils publishes a sourcemap whose `sources` point outside the
// package (`../../../../src/date-adapters/...`), so Vite warns that the files
// are missing on every run. Serve the module without the dangling
// sourceMappingURL so Vite never loads a map it cannot resolve.
const DROPPED_SOURCEMAP = /\n?\/\/# sourceMappingURL=[^\n]*\s*$/;

export default defineConfig({
  plugins: [
    {
      name: 'lecoursville:drop-broken-calendar-utils-sourcemap',
      enforce: 'pre',
      async load(id) {
        // Only plain module ids: a query/virtual variant must keep default handling.
        if (id.includes('?') || !id.includes('/calendar-utils/') || !id.endsWith('.js')) {
          return null;
        }
        const code = await readFile(id, 'utf-8');
        return code.replace(DROPPED_SOURCEMAP, '\n');
      },
    },
  ],
  test: {
    // Failure-path specs assert on error handling and log the expected error.
    // Keep those logs out of a green run; a failing test still prints them.
    silent: 'passed-only',
  },
});
