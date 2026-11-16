# Handoff: Mobile Overnight Convergence

- Date: 2026-11-14
- Repo: `/Users/e/mnt/bnk/cs/lecoursville`
- Branch: `2026-11-08_UxReview` (all work committed here, nothing pushed)
- Ledger: `docs/critique/2026-11-14_MobileOvernight.md`
- Harness output: `/tmp/mobile-overnight-2026-11-13/` (captures, audit JSON, `results.json`, `dialogs.json`, `dialogs.md`)

## Current State

Done:

- A mobile capture and audit harness: `scripts/mobile/routes.mjs`, `scripts/mobile/screenshots.mjs`, `scripts/mobile/audit.mjs`, `scripts/mobile/dialogs.mjs`. 46 routes, 10 viewports, 3 engines, 11 audit checks plus a 200 percent text-zoom mode.
- User-facing convergence: 210 pass, 0 fail, 0 warns per engine across 22 routes and 10 viewports. Print surface exempt. Text zoom 210 pass.
- Visual convergence: every user-facing page critiqued at four viewports, fixed, re-captured, and re-critiqued. Residual items are listed in the ledger with reasons.
- Engine parity: Chromium scrollbar drift removed with `--hide-scrollbars`, WebKit toolbar stretch fixed, Firefox calendar font-metric delta logged.
- Dialog sweep: 5 surfaces pass at 390x844, chat skipped because its composer is inline.
- Admin convergence: 216 pass, 0 fail, 4 low warns on Chromium. Super routes and the content tier both covered. Reviewed dashboard, users, features, families, people, media, recovery, calendars, uploads, songs.
- Regression gate: unit 946 passed, `theme:check` PASS, and the browser matrix is green at 556 expected per engine with 0 skipped, 0 unexpected, 0 flaky. Run the three `firebase emulators:exec` browser stages individually if a single `npm run e2e:gate` invocation hangs at the functions install step.

In progress: nothing. The loop is closed at the automated bar with the residue below.

Branch state: clean working tree at the final docs commit. Ten commits on the branch, listed in the ledger.

## Key Decisions

- Calendar at 320 and 280 uses a fluid seven-column track. This supersedes the older 44px-column pan contract because a hidden Saturday column is a worse defect than 39px cells that still clear the 24px inline floor. `e2e/specs/calendar.spec.ts` now asserts the fluid contract.
- Primary actions target 44px and inline controls target 24px. Material icon buttons moved to 44px only at touch widths, because a 40px box on desktop is the platform default and widening it there would churn dense toolbars.
- Print surface is exempt from mobile ergonomics. It is checked for print CSS only.
- The theme switcher moved from the app-bar center to the right cluster at touch widths. The desktop centered position and its spec stay intact.
- The account page keeps both the header session toggle and the persisted preference switch. They are different settings per `e2e/specs/dark-mode.spec.ts`.
- Admin tables scroll inside their cards through a shared `.admin-table-scroll` wrapper, never by clipping columns.

## Next Actions

1. Re-run the admin matrix on WebKit and Firefox. The Chromium admin run is clean, but the other two engines were not re-run after the admin fixes:
   `firebase emulators:exec --project lecoursville-dev --only auth,database,storage,hosting,functions "node scripts/e2e/seed.mjs && node scripts/mobile/audit.mjs --engine=webkit --routes=admin"` then the same with `--engine=firefox`. Expect 216 pass, 0 fail; investigate any table-scroll or hit-target failure.
2. Empty-states review with real empty data. The `sparse` account still sees global seeded lists. Extend `scripts/e2e/seed.mjs` with a second archive or family that the sparse user cannot see, then critique `/contacts`, `/people`, `/photos` empty states.
3. Admin residue, in order: `admin/recovery` should lead with Recovery Requests instead of the creations log. `admin/people` and `admin/songs` cards need compact one-line field rows and a phone FAB for add. `admin/calendars` needs an e2e assertion for the new copy control in `e2e/specs/admin-content.spec.ts`.
4. Firefox calendar parity: rows render about 30px taller and the selected-day badge loses its dark fill. Compare computed styles for `.cal-day-control[aria-selected]` between engines.
5. Commit and push when the owner asks, via the `ship-changes` skill. Nothing is pushed.

## Verify Commands

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
cd /Users/e/mnt/bnk/cs/lecoursville
git status --porcelain=v1        # expect clean
git log --oneline -10            # expect the ten commits named in the ledger
npx ng build --configuration=e2e
npm run e2e:gate                 # expect 556 expected per browser, 0 skipped/unexpected/flaky
CI=true npm test -- --watch=false
npm run theme:check
```

## Open Risks

- The last Chromium admin audit ran against the build that includes the admin-calendars table wrapper, and the gate was re-run after it. Any new change needs the gate again.
- One intermittent Firefox failure appeared once in the songs admin edit spec ("the title field received the key value"). It passed in isolation and on the full stage rerun. If it returns, look at focus handling in the admin songs edit form, not at the mobile loop changes.
- The audit treats a classic scrollbar gutter as non-overflow. On a real desktop browser with classic scrollbars an 8 to 10px gutter is expected, but content must not cross it. The Chromium capture now hides scrollbars, so prefer the WebKit and Firefox numbers if a gutter question comes up.
- `--hide-scrollbars` is a Chromium launch flag in the harness only. It does not affect the app or the gate.
