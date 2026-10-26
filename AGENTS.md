# LeCoursville — Agent Rules

## E2E coverage is mandatory with every feature

Every feature, bug fix, or refactor that touches user-visible behavior ships
with Playwright e2e coverage. The gate goes red without it — there is no
exception path.

**The rule:** if your change adds, removes, or alters a route, form, button,
list, upload, or any user-visible state, you add or update a spec under
`e2e/specs/` for it in the same change. New feature work routes to:

| Kind of work | Where the spec goes |
|---|---|
| Auth / guards | `e2e/specs/auth.spec.ts`, `e2e/specs/security.spec.ts` |
| Feature flags / nav | `e2e/specs/feature-flags.spec.ts`, `e2e/specs/nav.spec.ts` |
| Feature domain (contacts, calendar, chat, expressions, photos, people, media, admin, uploads) | the matching spec file, or a new `e2e/specs/<domain>.spec.ts` |
| Edge cases / races / validation | `e2e/specs/edge-cases.spec.ts` |
| Security angles (tampering, XSS, outbound requests) | `e2e/specs/security.spec.ts` |

**Non-negotiables in specs:** deterministic waits only (no arbitrary sleeps,
no `test.skip`, `retries` stay 0 in `playwright.config.ts`), restore any
mutated state (feature flags especially — chat is seeded OFF), and use the
console-error collector from `e2e/helpers/fixture.ts` (import `test` from
there, not from `@playwright/test`).

**Policy:** read `docs/testing/TEST_POLICY.md` before changing behavior.
Every user-visible change adds or updates its e2e spec in the same change.
Record the behavior assertion or red proof in the commit.

## The gate

```bash
npm run e2e:gate
```

Builds the emulator-wired bundle, boots the Firebase Emulator Suite (auth,
database, storage, hosting), seeds deterministic data, and runs the full
Playwright matrix (Chromium + WebKit + Firefox). Fast local iteration:

```bash
npx ng build --configuration=e2e
firebase emulators:exec --project lecoursville-dev --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=chromium"
```

Seed data lives in `scripts/e2e/seed.mjs` — when a spec needs new data,
extend the seed, don't hand-edit the emulator database.

## Deploy sign-off

`scripts/deploy.sh` runs the gate before ANY build/tag/deploy step. A green
gate still requires an explicit human sign-off; a red gate prompts a deliberate
"deploy anyway" override so a reviewed failure can ship.

- Interactive shells approve with any input containing `deploy` or `yes` (any
  casing), or a bare `y`/`d`; Enter aborts.
- Non-interactive shells set `E2E_APPROVED=1` for a green or skipped gate, or
  `E2E_FORCE=1` to deploy over a red gate.
- `npm run deploy:dev:nogate` and `npm run deploy:prod:nogate` (`SKIP_GATE=1`)
  skip the gate for a build whose gate you already ran and passed. Sign-off
  still applies, and the bundle identity check still runs.
- Never bypass the sign-off, and never skip a gate you have not actually run.

## Environment

- Java is required by the emulator suite: `export
  JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
- Never touch the Firebase console, real projects, or production/development
  databases — the gate is emulator-only.
