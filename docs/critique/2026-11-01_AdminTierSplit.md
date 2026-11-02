# Critique Ledger: Admin Tier Split

- Goal: prove the Admin Tier Split implementation on branch `2026-11-01_AdminTierSplit` is correct and complete, fix every evidence-backed finding, leave the branch green and ship-ready
- Started: 2026-11-01
- Branch: 2026-11-01_AdminTierSplit
- Lens set: correctness, security, testing, maintainability

## Fixes Applied

- C-20261101-02 `e2e/specs/admin-roles.spec.ts:133` added a `toHaveAttribute('aria-busy', 'false')` gate before the nav count assertion. Closed by `npm run e2e:gate` 362 passed.
- C-20261101-03 `e2e/specs/admin-roles.spec.ts:31` and `e2e/specs/security.spec.ts:243` added `/admin/songs` to both content-admin sweeps with the table-or-empty readiness selector. Closed by `npm run e2e:gate` 362 passed.
- C-20261101-04 `src/app/components/admin/admin.component.spec.ts:105` new case emits flags before the user, asserts 6 content links and no `admin-nav-link-users`. Closed by `npx ng test` 751 passed.
- C-20261101-05 `src/app/services/super-admin.guard.ts:25` comment reworded to the system-child scope, guard code byte-identical. Closed by `git diff` comment-only.
- Un-ship `e2e/specs/admin-roles.spec.ts:86` extracted `expectExpressionControls` and `expectLegacyPhotoControls`, removing duplicated case bodies while keeping all four spec-named tests. Closed by `npm run e2e:gate` 362 passed.

## Referee Verdict

- VERDICT: CONVERGED
- All 8 findings settled. No HUMAN agenda items.
- Final tree: `npx vitest run` 303 passed, `npx ng test --watch=false` 751 passed, `npx ng build --configuration=e2e` clean, `npm run e2e:gate` 362 passed.

## Findings

- C-20261101-01 | 2026-11-01 | correctness | low | high | rejected | Spec line 205's 5/4 nav counts predate songs, which has no superOnly flag so a content admin gets 6 and 5 | src/app/admin/admin-nav.ts:43
  - rebuttal | rejected | src/app/components/admin/admin.module.ts:45 | songs is a content-group item with no SuperAdminGuard and it landed on trunk after the spec, so navigation-follows-permission holds
- C-20261101-02 | 2026-11-01 | testing | high | high | addressed | The /admin shell case asserts no users link while the nav can still be the pre-load skeleton, so a leak would pass | e2e/specs/admin-roles.spec.ts:106
  - rebuttal | addressed | src/app/components/admin/admin.component.html:2 | gate both assertions on admin-nav aria-busy false so the flags-driven nav table has rendered
- C-20261101-03 | 2026-11-01 | testing | medium | high | addressed | Both content-admin route sweeps omit /admin/songs, a non-super-only content page, so access to it is untested | src/app/components/admin/admin.module.ts:45
  - rebuttal | addressed | src/app/components/admin-songs/admin-songs.component.html:161 | add a songs content entry gated on admin-songs-table or admin-songs-empty and add it to the security sweep
- C-20261101-04 | 2026-11-01 | testing | medium | high | addressed | The latestFlags rebuild path is untested because every admin.component case emits the user before any flags | src/app/components/admin/admin.component.ts:150
  - rebuttal | addressed | src/app/components/admin/admin.component.spec.ts:34 | add a case emitting flags first then a content-admin user, expecting no admin-nav-link-users and the content count
- C-20261101-05 | 2026-11-01 | maintainability | medium | high | addressed | SuperAdminGuard comment says a plain admin never sees the admin shell, which the parent route change makes false | src/app/services/super-admin.guard.ts:25
  - rebuttal | addressed | src/app/app-routing.module.ts:104 | replace the comment with copy stating the system-child guard sends a content admin to the promoted route
- C-20261101-06 | 2026-11-01 | maintainability | medium | high | rejected | isAdmin has no production caller left while it is kept as the documented content-admin predicate | functions/src/helpers.ts:101
  - rebuttal | rejected | docs/specs/2026-11-01_AdminTierSplit.md:129 | the spec explicitly instructs keeping isAdmin as the content-admin predicate, so an unused-but-contracted helper is not a defect
- C-20261101-07 | 2026-11-01 | maintainability | medium | high | rejected | shouldDisplayContentAdminBadge repeats the enclosing predicate and shouldDisplayUserId has a dead disjunct | src/app/components/user-view/user-view.component.ts:39
  - rebuttal | rejected | docs/specs/2026-11-01_AdminTierSplit.md:217 | the spec mandates these exact method names and bodies, so the redundancy is required contract text
- C-20261101-08 | 2026-11-01 | maintainability | low | high | rejected | The admin-analytics-summary comment says the admin area is super-only, which is now imprecise | functions/src/admin-analytics-summary.ts:104
  - rebuttal | rejected | docs/specs/2026-11-01_AdminTierSplit.md:156 | the spec says the analytics callable needs no change and the comment describes the super-only analytics surface it guards
