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

The tier ladder trades breadth for latency during iteration and never weakens the final gate.

| Tier | Command | When | Cost |
|---|---|---|---|
| 1 | `npm run check` | Every edit that touches `src/`, the theme, or PII strings | Static checks, unit suite, no emulator or browser |
| 2 | `npm run e2e:fast -- <spec or flags>` | One changed behavior, repeated until green | One emulator boot, chromium only |
| 3 | `npm run e2e:pr` | Before pushing a full change set | One emulator boot, rules plus full chromium suite |
| 4 | `npm run e2e:gate` | Mandatory before any push-to-deploy or release | Four emulator boots, chromium, WebKit, Firefox |

`npm run e2e:gate` builds the emulator-wired bundle, runs the theme and PII checks, the unit and functions suites, the prod storage rules pass, and the full browser matrix.

`scripts/deploy.sh` calls it unchanged and a green gate still needs the human sign-off.

Tier 2 passes its arguments straight to `playwright test`. With no arguments it reruns `--last-failed` when a prior run recorded failures, otherwise it runs the full chromium suite.

Seed data lives in `scripts/e2e/seed.mjs`. When a spec needs new data, extend the seed and never hand-edit the emulator database.

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

## Admin UI

Admin cards, tables, and page scss follow `docs/design/ADMIN_SURFACES.md`.

## Environment

- Java is required by the emulator suite: `export
  JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
- Never touch the Firebase console, real projects, or production/development
  databases — the gate is emulator-only.
