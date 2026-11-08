# Handoff: Calendar Redteam And Autoship

- Date: 2026-11-07
- Branch: `dynamic-calendar`
- Mode: overnight autonomous redteam, fixes, full gate, autoship to `master`

## Current State

Redteam and fix run complete, gate green on the final tree.

- Five ledgers under `docs/critique/2026-11-07_*.md`: CalendarCore, CalendarPrint, AdminEdits, SongsEdits, SeedHarness.
- 60 findings triaged. All addressed or rejected with evidence, except two deliberate rejections: C-55 duplicate private helpers and C-49 browser header/footer ink.
- Full unit suite: 857 passing (111 files).
- Full gate `npm run e2e:gate`: 419 passed, 0 skipped, 0 flaky, exit 0 on Chromium, WebKit, and Firefox.
- Claim critic found three real gaps that were then fixed: a stale gate after the auth edit, C-04/C-12 warm-empty skeleton marked done while unfixed, and missing rejection rationale. Gate re-run after the fixes.

## Key Decisions

- Feb-29 birthdays and anniversaries clamp to Feb 28 in non-leap years, and month filtering, sorting, and rendering agree on the same date.
- Anniversaries emit once per couple, including a date held only by a `-S` record. Birthdays include all records, deduped only when an `-S` record copies its primary's exact date.
- Warm empty datasets now resolve to the empty state via `eventsLoaded$`, not a permanent skeleton.
- Print drops no unique spouse birthday. It never prints a `-S` anniversary because the primary line already names the couple.
- Print is disabled until data loads, honors all four saved prefs after the async user arrives, announces truncation, and scales down on narrow viewports.
- `legacyCalendarPdf` defaults off, so the Calendars admin nav is hidden until enabled. Flag-on nav and toggle are now e2e-proven.
- Seed dates are absolute, so specs no longer pass only in November 2026.
- Two rejected by design: C-49 (browser chrome ink is not CSS-controllable) and C-55 (private service helpers, extraction not worth the API change).

## Verification

```bash
cd /Users/e/mnt/bnk/cs/lecoursville
CI=true npx ng test --watch=false
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm run e2e:gate
```

Expect 857 unit passing and 419 e2e passing with no skips.

## Open Risks

- Print fidelity at six entries per day is handled in the model and CSS but still has no true 300 DPI printer proof.
- `PeopleService` has no in-place reload; print retry opens a fresh `getPeople()` stream. A future `peopleLoaded$` reset would make retry native.
- The `-S` spouse print rule assumes import copies a unique birthday onto the spouse record. Legacy data with a copied primary birthday is deduped, but a malformed row could still print twice.

## Ship

Autoship was pre-authorized by the user for this run: PR against `master`, squash-merge, then delete the merged branch. No push, PR, or merge was done without that instruction.

## Resume Prompt

```text
Calendar redteam autoship in /Users/e/mnt/bnk/cs/lecoursville was completed on
branch dynamic-calendar. Read docs/handoffs/2026-11-07_CalendarRedteam.md and the
five docs/critique/2026-11-07_*.md ledgers. Confirm the PR merged to master and
that the branch was cleaned up. If anything is still open, report it.
```
