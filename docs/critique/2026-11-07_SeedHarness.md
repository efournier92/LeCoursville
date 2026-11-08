# Critique Ledger: Seed And Harness

- Goal: Validate the e2e seed expansion and the specs that depend on it, especially date-locking and stale counts.
- Started: 2026-11-07
- Branch: dynamic-calendar
- Lens set: data-integrity, testing

## Findings

- C-20261107-80 | 2026-11-07 | testing | high | high | addressed | Test 12 asserts the whole July page holds 7 entries, but current-month seed birthdays and anniversary add July entries in a July or October run | e2e/specs/calendar-print.spec.ts:437-451, scripts/e2e/seed.mjs:233-236,267-270,296
- C-20261107-81 | 2026-11-07 | testing | high | high | addressed | Test 20 expects the Carol and Dave anniversary on the November page but the seed dates it to the current month, so it matches only in November | e2e/specs/calendar-print.spec.ts:269-284, scripts/e2e/seed.mjs:296
- C-20261107-82 | 2026-11-07 | testing | high | high | addressed | Test 20 requires a 4-week February with row gap above 5px but never pins a year, and from 2027 February has 5 weeks so the assertion fails | e2e/specs/calendar-print.spec.ts:244-247
- C-20261107-83 | 2026-11-07 | testing | low | high | addressed | person-g is seeded to prove the unknown-year rule but year-0 birthdays are skipped by both the service and the print builder, so she never appears | scripts/e2e/seed.mjs:283, src/app/services/calendar.service.ts:54, src/app/components/calendar-print/calendar-print.model.ts:158
- C-20261107-84 | 2026-11-07 | testing | low | high | addressed | The dense fixture comment claims 10 July 4 birthdays render plus 2 more, the model renders 7 and the spec expects plus 4, which holds only because the holiday consumes a slot | scripts/e2e/seed.mjs:301-306, e2e/specs/calendar-print.spec.ts:442-451
- C-20261107-85 | 2026-11-07 | testing | medium | high | addressed | people.spec.ts is named 6 seeded people but the seed now has 24, only the original six are asserted so 18 new rows could vanish undetected | e2e/specs/people.spec.ts:21, scripts/e2e/seed.mjs:283-306
- C-20261107-86 | 2026-11-07 | testing | low | high | addressed | Seed rows person-g and person-i and person-j are never asserted by any e2e spec despite comments claiming unknown-year and shared-surname coverage | scripts/e2e/seed.mjs:282-287
- C-20261107-87 | 2026-11-07 | testing | low | medium | addressed | afterEach writes the legacy flag before restoring calendar prefs, so a throwing write skips the restore and leaks showHolidays false | e2e/specs/calendar.spec.ts:15-22
- C-20261107-88 | 2026-11-07 | testing | low | high | rejected | Duplicate of C-41 and C-80, test 11 early return on webkit and firefox | e2e/specs/calendar-print.spec.ts:427-430
