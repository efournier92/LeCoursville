# E2E Gate - Session State (updated 2026-10-01)

Branch: `angular-upgrade`. The overnight handoff from 2026-08-08 is complete; this file replaces it.

## Current state: DONE and GREEN

- Full 3-browser gate green: 64/64 chromium, 64/64 webkit, 64/64 firefox (proven 2026-10-01).
- Unit suite green: 213/213 in 65 files (Vitest).
- E2E gate implemented per `design_specs/2026-08-07_e2e_gate.md`: `playwright.config.ts`, `e2e/specs/` (14 spec files), `e2e/helpers/`, `scripts/e2e/seed.mjs`, `scripts/e2e/gate.sh`, emulator wiring in `firebase.json` + `storage.rules`, e2e build config in `angular.json`, protractor fully deleted.
- Phase D done: `scripts/deploy.sh` runs the gate before any build/tag/deploy, with interactive `deploy` sign-off or `E2E_APPROVED=1` for non-interactive shells.
- Agentic docs done: `AGENTS.md` at repo root, `CLAUDE.md` pointer.

## Security findings: all resolved

1. Admin guard localStorage trust: FIXED. `auth-admin-guard.service.ts` verifies the RTDB-backed user record via `userObservable`, 5s timeout redirects to sign-in. Proven by `security.spec.ts` guard-bypass test (green on all 3 browsers) and unit spec.
2. XSS in chat/expression bodies: NOT a vulnerability. `[innerHTML]` goes through Angular's default sanitizer (no `bypassSecurityTrust*` on those paths; the only bypass in the repo is the Drive iframe ResourceUrl, a known external). `security.spec.ts` proves `window.__xss === 0` for chat bodies, expression bodies, and person names. innerHTML binding retained deliberately for rich-text bodies.
3. Public upload accepts non-image types: documented user-action finding (spec records it as a probe test).
4. Drive iframe external requests: known external, allowlisted in the outbound-request spec together with `apis.google.com` (the Drive player's API loader).

## Cross-browser fixes made 2026-10-01

- WebKit `security.spec.ts` outbound walk: allowlisted `apis.google.com/js/api.js` (loaded from inside the Drive player iframe; only `drive.google.com` was allowed before).
- Firefox folder upload: Playwright's Firefox channel delivers directory-picked files with empty MIME type (probe-proven), so `filterImageFiles` dropped every file and the upload dialog never opened. `admin-photo-albums.component.ts` now falls back to image-extension matching when `file.type` is empty.
- `auth-admin-guard.service.spec.ts` rewritten for the Observable guard API (old spec asserted the abandoned synchronous-boolean contract).

## Locked harness decisions (still true, do not re-litigate)

- RTDB namespace: seed writes to `?ns=lecoursville-dev-default-rtdb` to match the app SDK namespace; without it the app reads an empty DB.
- Hosting `public` is `dist/lecoursville/browser`; seed fixtures go to `dist/lecoursville/browser/assets/e2e-fixtures/`.
- `storage.rules` (open, emulator-only) exists because the storage emulator refuses to boot without a rules file.
- `EmulatorConfig` lives in `src/environments/emulator-config.ts` (fileReplacements circular-import workaround).
- Auth emulator REST needs `?key=emulator` on signUp/signInWithPassword.
- Java (openjdk@21) is a machine prerequisite: `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.
- Contacts page is people-derived; the legacy `contacts` node is not read by the UI.
- Chat is seeded OFF; specs enable it via `/admin/features` and restore it in afterEach.
- Seed requirements: admin user has `super: true`; people have `firstPreferred` set; audio album has non-empty `urls.download`.

## Verify commands

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm test          # unit: 213 passed
npm run e2e:gate  # 64 x 3 browsers, ~4 min
```

## Open items

- None blocking. The working-tree changeset (e2e gate + design facelift + fixes) needs committing; see `design_specs/2026-08-07_design_facelift.md` for the facelift scope.
- `database-debug.log` / `firebase-debug.log` in the repo root are emulator artifacts, not for commit.
