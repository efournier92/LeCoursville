# Critique Ledger: Theme Input Standardization

- Goal: Evergreen Emerald palette + one control standard app-wide + user-facing read-only, verified green and redteamed to convergence on branch theme+input-standardization
- Started: 2026-10-31
- Branch: theme+input-standardization (worktree /Users/e/mnt/bnk/cs/lecoursville-theme, base 26755dcd)
- Lens set: correctness, visual, security, testing

## Findings

- C-20261031-01 | 2026-10-31 | maintainability | medium | high | addressed | Merge collision ahead: main checkout carries an uncommitted destructive-button session (--color-er | docs/specs/2026-10-31_ThemeInputStandardization.md:25
  - rebuttal | addressed | b465409d merge of origin/master | Master #49/#50 merged in; destructive-button work adopted onto the emerald token system (on-brand-solid ink); no semantic conflicts remain; post-merge gate running
- C-20261031-02 | 2026-10-31 | correctness | low | high | addressed | Spec internal tension (delete Create button vs create works on admin route) was resolved in code as | src/app/components/expressions/expressions.component.ts:25
- C-20261031-03 | 2026-10-31 | correctness | high | high | addressed | Pill container-shape (999px) on outlined mat-form-fields is geometrically invalid: notched-outline layout inflates (wrapper 999px, infix a | src/styles.scss:251
  - rebuttal | addressed | `npx playwright test e2e/specs/auth.spec.ts --project=chromium` 12/12 after shape change to var(--radius-card); probe: input w 0px to 298px
- C-20261031-04 | 2026-10-31 | visual | medium | high | addressed | Dark input border #333940 on surface #1B1F24 is far below the 3:1 WCAG 1.4.11 intent the spec claims for f | docs/specs/2026-10-31_ThemeInputStandardization.md:177
- C-20261031-05 | 2026-10-31 | visual | low | high | open | Raw non-Material inputs (search bars, public-upload) keep pill 999px radius while mat-form-fields are 16px card radius; one-shape control language is | src/styles.scss:251
- C-20261031-06 | 2026-10-31 | testing | medium | high | addressed | Five e2e gaps from the implementation: stale admin-nav counts (10/9), XSS test still using the removed user-side Create button, focus-outline | e2e/specs/admin.spec.ts:113
- C-20261031-07 | 2026-10-31 | correctness | medium | high | addressed | admin-contacts inner rtdb.object subscribe never released; param-only reuse overlaps live s | src/app/components/admin-contacts/admin-contacts.component.ts:41
- C-20261031-08 | 2026-10-31 | correctness | medium | high | addressed | userContacts BehaviorSubject([]) first empty emission flips status ready: false "No contact | src/app/components/admin-contacts/admin-contacts.component.ts:33
- C-20261031-09 | 2026-10-31 | testing | medium | high | open | Completeness script exempts user-edit from the roles ban though the spec exception set is admin*/photos-legacy/user-view o | scripts/check-theme-standardization.mjs:50
- C-20261031-10 | 2026-10-31 | correctness | low | medium | open | isAdminRoute is a one-shot pathname snapshot; unit test bypasses the mechanism (sets the field directly | src/app/components/expressions/expressions.component.ts:25
- C-20261031-11 | 2026-10-31 | correctness | low | high | addressed | Raw brand hex in TS (contact-card fallback) bypasses styles.scss token authority; theme:c | src/app/components/contacts/contact-card/contact-card.component.ts:72
- C-20261031-12 | 2026-10-31 | correctness | low | medium | addressed | Role badges moved to radius-control while spec section 4 locks badge radius to radius-sm | src/app/components/user-view/user-view.component.scss:44
- C-20261031-13 | 2026-10-31 | visual | high | high | addressed | Dark toolbar override re-emits brand-primary which is mint #8CCDA3 in dark, with white text 1.85:1; the comment claims an invariant toolbar tha | src/styles.scss:271
- C-20261031-14 | 2026-10-31 | visual | medium | high | addressed | 58 of 70 form-fields are filled-appearance and render M3-derived green-tinted neutrals (#dfe4d7/#43483f) against th | dist/lecoursville/browser/styles-KZIORKV7.css
- C-20261031-15 | 2026-10-31 | visual | medium | high | addressed | Light input border #C9CED4 is 1.58:1 on white, not the claimed 3:1; the strict-border decision's value was never contrast-verified | src/styles.scss:94
- C-20261031-16 | 2026-10-31 | visual | low | high | addressed | ink-3 #8A919C is 2.89:1 on app-bg, below the 3:1 its own comment claims for large text on that ground | src/styles.scss:74
- C-20261031-17 | 2026-10-31 | security | medium | high | open | Expressions read-only is UI-only: messages rules accept member writes with messageType expression and empty authorName, so members can publis | database.rules.json:25
- C-20261031-18 | 2026-10-31 | security | medium | high | open | Contacts .read is member-wide (roles/user), so all contact PII is member-readable via SDK today; the spec audit recorded contacts as admin-ga | database.rules.json:19
- C-20261031-19 | 2026-10-31 | security | medium | high | open | Admin chat moderation UI removed (disjunct dropped) with no admin chat route; admins keep DB write power bu | src/app/components/chat-view/chat-view.component.html:72
- C-20261031-20 | 2026-10-31 | security | low | high | addressed | XSS regression test now runs behind super-admin; the member-visible innerHTML surface on /expressions is unexercised | e2e/specs/security.spec.ts:106
- C-20261031-21 | 2026-10-31 | security | low | high | open | Pre-existing open reads: /media .read true (anonymous), /messages+/photos .read auth!=null with self-registerable accounts | database.rules.json:148
- C-20261031-22 | 2026-10-31 | testing | medium | high | addressed | Theme e2e mutates users/$uid/prefs/theme with no try/finally restore; failure after toggle persists dark for later specs (pattern exists | e2e/specs/edge-cases.spec.ts:177
- C-20261031-23 | 2026-10-31 | testing | medium | high | addressed | theme:check misses .ts raw hex; contact-card #27744A plus pre-existing people.component.ts:475 and load-error.compone | scripts/check-theme-standardization.mjs:21
- C-20261031-24 | 2026-10-31 | testing | low | high | open | Radius check is scss-only; dark-parity check diffs include names, not token re-emission | scripts/check-theme-standardization.mjs:34
- C-20261031-25 | 2026-10-31 | testing | low | medium | addressed | /admin/contacts fixup flow never exercises isEditable:false (seeded contact-3) | e2e/specs/contacts.spec.ts:91
- C-20261031-26 | 2026-10-31 | maintainability | medium | high | addressed | Un-ship: contact-view carried dead auth plumbing (user field, AuthService, subscrib | src/app/components/contacts/contact-view/contact-view.component.ts:1
- C-20261031-27 | 2026-10-31 | maintainability | medium | high | addressed | Un-ship: --color-brand-container/--color-on-brand-container declared light+dark with zero consumers; deleted. --color-error-solid kep | src/styles.scss:90
- C-20261031-28 | 2026-10-31 | maintainability | low | medium | addressed | Un-ship: admin-contacts per-id object stream replaced by deriving contact from the live | src/app/components/admin-contacts/admin-contacts.component.ts:44
- C-20261031-29 | 2026-10-31 | maintainability | low | high | rejected | Un-ship rejected as churn: isAdminRoute @Input dedup, admin-contacts spec scaffolding trim, --color-focus alias | docs/critique/2026-10-31_ThemeInputStandardization.md
- C-20261031-30 | 2026-10-31 | testing | medium | high | open | Referee verdict NOT-CONVERGED: open mediums C-01 C-09 C-17 C-18 C-19 all classified HUMAN with recommendations; | docs/critique/2026-10-31_ThemeInputStandardization.md
