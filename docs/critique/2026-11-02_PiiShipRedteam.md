# Critique Ledger: PiiShipRedteam

- Goal: Ship the PII sanitization branch without breakage, with residual PII and gate risk converged.
- Started: 2026-11-02
- Branch: 2026-11-02_CleanUp
- Lens set: correctness, security, testing, data-integrity

## Findings

- C-20261102-32 | 2026-11-02 | security | high | high | addressed | The retained 1984 Expressions attribution ships in the bundle; it is a real third-party name under an owner retention decision | src/app/constants/expression-constants.ts:4
  - rebuttal | addressed | owner decision at the 2026-11-02 walkthrough: keep the retained attribution | risk recorded in docs/specs/2026-11-02_PiiSanitization.md:21 and the canary comment.
- C-20261102-33 | 2026-11-02 | security | medium | high | addressed | Canary tokenized only whitespace, so punctuation and hyphen forms evaded it | scripts/check-pii-canary.mjs:64
  - rebuttal | addressed | normalized non-alphanumerics to spaces and added normalized-phrase hashes | canary now catches a bolded label token and hyphen forms.
- C-20261102-34 | 2026-11-02 | security | medium | high | addressed | Canary skipped dist, root config, and NUL files while the spec claimed tracked-tree coverage | scripts/check-pii-canary.mjs:29
  - rebuttal | addressed | added angular, firebase, rules, package, tsconfig, and playwright config | dist stays skipped as generated output.
- C-20261102-35 | 2026-11-02 | security | medium | high | addressed | No hashes existed for the three removed single-word labels, so they could return undetected | scripts/check-pii-canary.mjs:9
  - rebuttal | addressed | added hashes for the removed single-word and multi-word forms | the retained attribution stays unhashed.
- C-20261102-36 | 2026-11-02 | security | medium | medium | rejected | Nine major dependency and runtime bumps ride the PII ship and are unproven in production | package.json:6
  - rebuttal | rejected | owner chose the entire working tree and the full gate is green | production Cloud Functions and Resend delivery still need deploy-time sign-off.
- C-20261102-37 | 2026-11-02 | security | low | high | addressed | Spec W7 claimed the ledger and spec were excluded, but only self-exclusion existed | docs/specs/2026-11-02_PiiSanitization.md:113
  - rebuttal | addressed | doc now says only the canary file is excluded | the ledger and spec are actually scanned and clean.
- C-20261102-38 | 2026-11-02 | correctness | medium | high | addressed | Legacy contact.family rendered blank without a synthetic option or case-insensitive match | src/app/components/contacts/contact-edit/contact-edit.component.html:22
  - rebuttal | addressed | added `legacyFamily` option and `compareWith` | unit tests cover unmatched and case-insensitive values.
- C-20261102-39 | 2026-11-02 | correctness | medium | medium | addressed | Family sort mutated the service array and lacked the specified name tie-break | src/app/components/contacts/contact-edit/contact-edit.component.ts:73
  - rebuttal | addressed | sort now copies and compares sortOrder then name | unit test asserts no mutation and ordering.
- C-20261102-40 | 2026-11-02 | correctness | medium | medium | rejected | Historical doc claims a feature-config familyExplorer entry that never existed | docs/specs/2026-10-28_FamilyExplorerFeedbackBatch.md:38
  - rebuttal | rejected | route and admin nav are present and spec marks the doc historical | the claim is stale documentation, not a broken feature.
- C-20261102-41 | 2026-11-02 | testing | high | high | addressed | Handoff claimed a full gate after the final edits but artifacts predated them | docs/handoffs/2026-11-02_PiiSanitization.md:22
  - rebuttal | addressed | fresh gate ran 17:11 to 17:31 on the current tree | unit 769, functions 303, e2e 389 each on chromium, webkit, firefox.
- C-20261102-42 | 2026-11-02 | testing | medium | medium | addressed | Unit counts disagreed across docs and artifacts | docs/specs/2026-11-02_PiiSanitization.md:155
  - rebuttal | addressed | current suite is 769 after four new contact-editor tests | docs and handoff reconciled to 769.
- C-20261102-43 | 2026-11-02 | testing | medium | high | addressed | Contact editor loading, error, and empty states had no assertions | src/app/components/contacts/contact-edit/contact-edit.component.spec.ts:64
  - rebuttal | addressed | four unit tests added for states, sorting, unmatched, and case-insensitive match | full gate green.
- C-20261102-44 | 2026-11-02 | testing | low | high | addressed | Re-upload e2e left archive-1 mutated and relied on a later test's finally | e2e/specs/admin-family-explorer.spec.ts:112
  - rebuttal | addressed | mutation now restores archive-1 in its own finally | listed and gate-tested.
- C-20261102-45 | 2026-11-02 | data-integrity | low | medium | rejected | Spec claimed a literal preflight script that does not exist | docs/specs/2026-11-02_PiiSanitization.md:38
  - rebuttal | rejected | FamilyService read plus familiesStatus empty state is the preflight behavior | empty state is rendered and tested.
- C-20261102-46 | 2026-11-02 | data-integrity | medium | high | addressed | Admin rename or delete could orphan stored contact.family values, which rendered invisible | src/app/components/contacts/contact-edit/contact-edit.component.html:24
  - rebuttal | addressed | unmatched stored value now renders as a selectable synthetic option | name-based storage remains pre-existing design.
- C-20261102-47 | 2026-11-02 | data-integrity | low | high | addressed | Runbook added a route alias that the app never implemented | docs/specs/2026-11-02_FamilyArchiveKeyMigration.md:24
  - rebuttal | addressed | step replaced with hosting redirect or keep-old-key guidance | runbook remains optional and out of this ship.

## Verdict

Full gate green on the current tree. The owner re-confirmed retention of the Expressions attribution at the 2026-11-02 walkthrough. All findings are addressed or rejected with evidence.
