# Critique Ledger: PiiSanitization

- Goal: Eradicate real-family PII from the working tree while keeping the app functional and confirming prod auth.
- Started: 2026-11-02
- Branch: 2026-11-02_CleanUp
- Lens set: correctness, security, data-integrity, testing

## Findings

- C-20261102-01 | 2026-11-02 | correctness | high | high | addressed | Untracked app-settings means the edit cannot ship and the tracked canary misses it; move non-secret settings to a tracked file | .gitignore:54
  - rebuttal | addressed | `git check-ignore -v src/environments/app-settings.ts` | W1 now moves calendar/messages to a tracked module and deletes the ignored file.
- C-20261102-02 | 2026-11-02 | correctness | high | high | addressed | Injecting FamilyService breaks the admin-contacts RtdbService stub and the contact-edit spec has no mock | src/app/components/admin-contacts/admin-contacts.component.spec.ts:38
  - rebuttal | addressed | stub has only `object` | W1 now mocks FamilyService and extends the spec providers.
- C-20261102-03 | 2026-11-02 | correctness | high | medium | addressed | Gating published familyExplorer reads to approved users would red signed-out specs with no guard planned | e2e/specs/family-explorer.spec.ts:9
  - rebuttal | addressed | both specs are deliberately signed out | W5 escalation now pairs any gating with spec updates.
- C-20261102-04 | 2026-11-02 | correctness | medium | medium | addressed | DB family names can duplicate, so @for track on a name string throws NG0955 | src/app/components/contacts/contact-edit/contact-edit.component.html:22
  - rebuttal | addressed | admin allows duplicate names | W1 now tracks options by family id.
- C-20261102-05 | 2026-11-02 | correctness | medium | high | addressed | families$ is unsorted RTDB Object.values and changes the curated dropdown order | src/app/services/rtdb.service.ts:77
  - rebuttal | addressed | `rtdb.service.ts:71` uses Object.values | W1 now sorts by sortOrder then name.
- C-20261102-06 | 2026-11-02 | correctness | medium | medium | addressed | Plan misses literal slug references in docs/critique and fixture builders | docs/critique/2026-10-28_FamilyExplorerFeedback.md:139
  - rebuttal | addressed | tracked critique still hits | W3/W4 now cover every tracked hit.
- C-20261102-07 | 2026-11-02 | correctness | low | high | rejected | Deleting HeaderAttributionText would break compilation | src/app/constants/expression-constants.ts:4
  - rebuttal | rejected | `expressions.component.ts:18` keeps the reference | W2 replaces the value, never the constant.
- C-20261102-08 | 2026-11-02 | correctness | low | medium | addressed | A failed families$ read leaves the contact dropdown silently empty | src/app/components/contacts/contact-edit/contact-edit.component.ts:22
  - rebuttal | addressed | familiesStatus$ exposes error | W1 now renders loading and error states.
- C-20261102-09 | 2026-11-02 | security | high | high | addressed | Screenshot_Chat.png shows unblurred third-party names and the owner email | src/assets/img/screenshots/Screenshot_Chat.png
  - rebuttal | addressed | visually confirmed names in the image | W2 adds the Chat screenshot and its README embed.
- C-20261102-10 | 2026-11-02 | security | high | high | addressed | messages, photos, and photoAlbums read on auth != null, so pending accounts can read them | database.rules.json:22
  - rebuttal | addressed | verifier confirmed all three rules | W5 now records and escalates the broader gate.
- C-20261102-11 | 2026-11-02 | security | high | high | addressed | media is world-readable and omitted from the auth audit | database.rules.json:149
  - rebuttal | addressed | verifier confirmed `true` | W5 now lists media as a recorded public read.
- C-20261102-12 | 2026-11-02 | security | high | high | addressed | Prod storage serves photos to anyone and allows unauthenticated userUploads create | storage.rules.prod:13
  - rebuttal | addressed | owner decision 2026-11-02 | keep public as deliberate product behavior; recorded in W5; no rule change ships.
- C-20261102-13 | 2026-11-02 | security | high | medium | rejected | W5 schedules no rules change for the published familyExplorer read | docs/specs/2026-11-02_PiiSanitization.md:67
  - rebuttal | rejected | W5 already names it and recommends gating | finding premise is false.
- C-20261102-14 | 2026-11-02 | security | medium | high | addressed | README describes the real family and its size; plan omits it | README.md:28
  - rebuttal | addressed | not owner identity | W2 now redacts the family narrative.
- C-20261102-15 | 2026-11-02 | security | medium | high | addressed | A third-party surname remains in a public commit subject and old blobs | `git log -1 51fd8cdb`
  - rebuttal | addressed | owner decision 2026-11-02 | accept residual; exact leaked locations documented in the History residual section.
- C-20261102-16 | 2026-11-02 | security | medium | high | rejected | Real surname used as an invalid-folder test input | src/app/services/media/media-naming.spec.ts:73
  - rebuttal | rejected | owner surname is the product brand and exempt | no third-party person is referenced.
- C-20261102-17 | 2026-11-02 | data-integrity | high | medium | addressed | Deleting the only family fallback with no preflight; options can vanish | docs/critique/2026-10-26_DevFeedback.md:47
  - rebuttal | addressed | migration is deferred | W1 now adds a read-only preflight and explicit empty state.
- C-20261102-18 | 2026-11-02 | data-integrity | medium | high | addressed | contact.family stores names and the 13 and 14 lists disagree, so values can go unmatched | design_specs/clans-ads.md:334
  - rebuttal | addressed | `contact.ts:14` stores a name | W1 matches case-insensitively and keeps unmatched values.
- C-20261102-19 | 2026-11-02 | data-integrity | medium | high | addressed | Prod archive stays under the real slug; a neutral route would orphan it | src/app/app-routing.module.ts:90
  - rebuttal | addressed | owner decision 2026-11-02 | full data migration planned for next deploy; runbook in docs/specs/2026-11-02_FamilyArchiveKeyMigration.md.
- C-20261102-20 | 2026-11-02 | data-integrity | medium | high | rejected | Empty-state test restores literal archive keys | e2e/specs/admin-family-explorer.spec.ts:145
  - rebuttal | rejected | W3 already updates every spec and fixture | literal restore is covered by that sweep.
- C-20261102-21 | 2026-11-02 | data-integrity | medium | high | rejected | CSV fixture submits the real family name | e2e/specs/admin-people.spec.ts:67
  - rebuttal | rejected | W1 replaces labels in seed and tests | the leftover fixture family is neutral after the rename.
- C-20261102-22 | 2026-11-02 | data-integrity | medium | medium | addressed | Deploy step rewritten to a neutral slug contradicts the production archive path | docs/specs/2026-10-28_FamilyExplorer.md:250
  - rebuttal | addressed | same root as C-19 | W4 now marks rollout docs historical and preserves the prod key.
- C-20261102-23 | 2026-11-02 | data-integrity | low | high | addressed | Dropdown order changes to RTDB key order | src/app/services/rtdb.service.ts:77
  - rebuttal | addressed | duplicate of C-05 | W1 sorts by sortOrder.
- C-20261102-24 | 2026-11-02 | testing | high | high | rejected | Contact-edit family dropdown has no e2e | e2e/specs/contacts.spec.ts:51
  - rebuttal | rejected | W7 already requires that spec | the gap is in the plan.
- C-20261102-25 | 2026-11-02 | testing | high | high | addressed | PII canary is unenforced and unstorable; grep cannot verify a PNG | scripts/e2e/gate.sh:11
  - rebuttal | addressed | gate runs no canary | W7 now commits a hash-only canary, runs it in the gate, and adds a visual check.
- C-20261102-26 | 2026-11-02 | testing | medium | high | addressed | ContactEdit spec has no FamilyService mock or dropdown test | src/app/components/contacts/contact-edit/contact-edit.component.spec.ts:27
  - rebuttal | addressed | real RtdbService is hit | W1 mocks it and W7 adds the assertion.
- C-20261102-27 | 2026-11-02 | testing | medium | high | rejected | The expressions attribution is asserted nowhere | src/app/constants/expression-constants.ts:4
  - rebuttal | rejected | owner decision 2026-11-02 | the attribution is retained, so no regression assertion is required.
- C-20261102-28 | 2026-11-02 | testing | medium | high | rejected | Twelve e2e and four unit or functions files carry the real tokens | `git grep -lniE "<family-label tokens>" -- e2e src functions`
  - rebuttal | rejected | command returns 17 files | the label-asserting files are covered by W1/W3 and one hit is a local variable.
- C-20261102-29 | 2026-11-02 | testing | medium | medium | addressed | Canary scope is undefined against tracked docs | `git grep -ni <legacy-surname-slug> -- docs/critique | wc -l`
  - rebuttal | addressed | 5 hits include the ledger itself | W7 now excludes the ledger and spec explicitly.
- C-20261102-30 | 2026-11-02 | testing | medium | medium | addressed | Contact-edit's new subscribe has no wait, so its spec can pass empty or flake | src/app/services/family.service.ts:13
  - rebuttal | addressed | families$ seeds [] | W7 waits on the ready status and asserts options.
- C-20261102-31 | 2026-11-02 | testing | low | high | rejected | No matrix-skip mode; cheapest proof is a chrome run | scripts/e2e/gate.sh:11
  - rebuttal | rejected | AGENTS.md documents the fast path | the full gate remains the acceptance criterion.

## Verdict

`CONVERGED` after the 2026-11-02 owner walkthrough. All high and medium findings are addressed
or rejected with evidence. The three escalations were settled by owner decision and are recorded
above. Implementation outcome: unit 766, functions 303, e2e 389 on each of Chromium, WebKit, and
Firefox, PII canary clean.

Residuals, by explicit owner decision and documented rather than removed: the family-explorer
production data key and display title migrate at the next deploy; tracked docs are redacted only
after the owner reviews the inventory; git history retains the leaked identifiers.

Post-convergence owner amendment 2026-11-02: the Expressions header attribution is retained
unchanged and is exempt from the canary hash set. C-20261102-27 is rejected on that basis.

Post-convergence completion 2026-11-02: the owner reviewed `/tmp/pii-inventory-2026-11-02.md` and W4 docs redaction was applied. The canary now scans `docs/` and `design_specs/` and reports clean. The live archive slug is gone from code, scripts, seeds, and fixtures. The live key stays admin-managed in the database.
