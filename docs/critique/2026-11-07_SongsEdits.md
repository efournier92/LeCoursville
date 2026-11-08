# Critique Ledger: Songs Edits

- Goal: Validate the songs e2e change that adds an @page calendar assertion and excludes the calendar page from a zero-margin loop.
- Started: 2026-11-07
- Branch: dynamic-calendar
- Lens set: testing

## Findings

- C-20261107-70 | 2026-11-07 | testing | medium | high | addressed | songs.spec now requires the global @page calendar rule, so calendar-only CSS changes turn the songs suite red though songs print behavior is unchanged | e2e/specs/songs.spec.ts:665, src/styles.scss:636-639
- C-20261107-71 | 2026-11-07 | testing | medium | high | addressed | The zero-margin exclusion keys on page name not reachability, so any songs element adopting page calendar prints marginless and the test still passes | e2e/specs/songs.spec.ts:672
- C-20261107-72 | 2026-11-07 | testing | medium | high | addressed | The calendar page-box contract is pinned only in the songs spec and incompletely, size letter landscape is asserted nowhere and the calendar spec has no page assertion | e2e/specs/songs.spec.ts:665, docs/testing/TEST_POLICY.md:102
- C-20261107-73 | 2026-11-07 | testing | low | high | addressed | The comment claims no element stacks a second vertical gutter while the filter now exempts a zero-margin page block with no stated rationale | e2e/specs/songs.spec.ts:669-672
