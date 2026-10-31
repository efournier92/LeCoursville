# Songs Library Handoff

Date: 2026-10-31 · Branch: `2026-10-31_Songs` · Worktree: `/Users/e/mnt/bnk/cs/lecoursville-songs` · Base: `master` at `26755dcd` · Status: feature-complete; latest presentation/print commits have targeted unit + Chromium Songs e2e, full 3-browser gate must rerun before merge. Not pushed, not deployed.

The discovery index was already above its 8 KB cap before this session; the fourteen new entries are appended, and the archive reconcile is deferred as pre-existing debt.

## Current State

- 27 commits on the branch, working tree clean.
- Last full gate `npm run e2e:gate` was green at `81a80961` (before the chord-over, sample-download, and lyrics-only/print/tags commits). It must be rerun before merge.
- Gate evidence in `.gate-results/`: `unit-tests.txt` (107 files, 740 tests), `functions-tests.txt` (24 files, 298 tests), `rules.txt` (15 passed), `storage-prod.txt` (9 passed), `chromium.json`, `webkit.json`, `firefox.json` (320 expected each, 0 unexpected, 0 flaky, 0 skipped), consolidated in `gate-summary.txt`. These artifacts do not cover the latest three commits.
- Latest targeted evidence: 32 unit tests green; 55 Songs e2e tests green on Chromium.
- No `functions/`, `storage.rules`, `storage.rules.prod`, or dependency changes. `database.rules.json` changed (Songs rules plus shape validation).
- Nothing pushed: no `origin/2026-10-31_Songs`; no tag; `scripts/deploy.sh` untouched.

## Shipped Scope

- Model/service: `src/app/models/song.ts`, `src/app/services/songs.service.ts`.
- Pure logic: `song-parser.ts` (paste and file share it), `chord-transpose.ts` (`hasBracketChords`, `transposeBody`, `transposeKeyName`, `segmentSongBody`, `trimTrailingBlankLines`).
- Member surface: lazy `src/app/components/songs/` module, list `/songs`, detail `/songs/:id`, search with 200 ms debounce and accent folding, leader chips, transpose, lyrics-only toggle, Print/PDF action.
- Presentation: bracket input stays canonical; detail derives a chord-over layout on >=601px and print, and inline gray chord tags on <=600px. Chords are faint gray tags, not brand green.
- Print: every song has Print/PDF via `window.print()`, which opens the browser dialog and Save-as-PDF; the song title is set as the document title for the PDF filename.
- Admin surface: `/admin/songs` with paste and multi-`.txt` import, one editable draft dialog for create and edit, unmatched-leader warning, leader picker, delete confirm, and a downloadable canonical `songs-sample.txt` plus a one-line format guide.
- Config: Songs feature flag and nav entry before Audio; Music relabeled Audio; admin nav Songs under Content.
- RTDB rules: member read, admin write, id pin, plus server-side field type/length checks and unknown-child rejection.
- Seed: Songs flag on plus `song-a` Amazing Grace, `song-b` Blessed Be the Name, `song-c` Come Thou Fount, `song-d` Noël.
- Tests: `e2e/specs/songs.spec.ts` (member, transpose, print, flag, admin, race/dialog/file coverage), extended `nav`, `feature-flags`, `rules`, `security`, `dark-mode`, `admin` specs; unit specs for service, parser, transposer.
- Discovery entries: D-20261031-01 through D-20261031-14 in `docs/discovery/DISCOVERY.md`.

## Key Decisions

- Transpose spelling: the spec's prose (natural roots always sharp) contradicts its test plan (`D` minus 1 gives `Db`). Resolved toward the test plan: downward shifts spell flat, upward shifts spell sharp, flats stay flat. See D-20261031-04.
- Card excerpt drops bracket tokens and all chord-only lines; the detail page is the chord home. This deliberately trades the literal "first two body lines" wording for readable list scent.
- The canonical body is rendered as per-line spans with `chord`, `chord-line`, and `text` segments, using interpolation only (no `innerHTML`). The stored body stays byte-identical; the visible presentation strips bracket glyphs and derives chord-over lines. See D-20261031-12.
- Lyrics-only is display-only: it filters chord-over lines, hides transpose, and never writes to RTDB. See D-20261031-13.
- Print/PDF uses the browser print dialog with the existing print sheet; no client-side PDF dependency. The document title is set to the song title so Save-as-PDF names the file usefully.
- Chords render as faint gray tags in both views; the admin sample file is a valid canonical-format import. See D-20261031-14.
- The detail key line becomes `Key: G → A` under a nonzero transpose offset, so the displayed key is not stale; at offset 0 it stays `Key: G`.
- Rules are hardened beyond the spec's verbatim block: title/body/source/key types and lengths, numeric timestamps, `$other` false, leader ids as strings with numeric indices capped at 0-49. See D-20261031-05.
- Print uses a named page: default `@page { margin: 14mm }`, `@page song { margin: 14mm 0 }`, and `.song-sheet { padding: 0 14mm }`. Real PDFs are the evidence, not print emulation (D-20261031-01).
- Dark print forces `color-scheme: light` and the light token set; without it the @page margin area prints `#121212` (D-20261031-03).
- No `ApprovedGuardService` on Songs: the spec deliberately matches chat/expressions. RTDB rules deny non-member reads, so a pending user gets the load-error state rather than data.
- Admin drawer `inert` state is reset on `ngOnDestroy`, `NavigationEnd`, and crossing `(min-width: 992px)`, so member pages never inherit a frozen toolbar (D-20261031-09).

## Critic Loop Outcome

Eleven UX iterations plus a full Phase-3 adversarial pass. Lenses run: visual craft, accessibility, responsive 320/390, interaction robustness, microcopy, and print, with WebKit/Firefox checks throughout.

Resolved highlights: chord-sheet hierarchy, mobile search width, admin mobile table overlap, dialog fit and safety (Escape/backdrop cannot discard a draft, focus starts on Title), dark scrims and dark CTAs, single-owner print margins, dark-theme print tokens, multi-page print margins, search icon alignment, drawer inert lifecycle, a11y headings/landmarks/labels/live regions, and server-side rules validation.

Deferred or deliberate deviations, with severity:

- Medium: chord-over chord/lyric alignment can break when a line wraps at 320px. The spec explicitly accepts `pre-wrap` as a tradeoff; bracket-chord songs transpose and stay readable.
- Medium: the whole `songs` node loads every body in one subscription. Spec accepts client-side whole-node loading; revisit if the library crosses low tens of thousands of records or bodies approach the 100k cap en masse.
- Medium: `updateSong` is check-then-act. The rules `$id` and required-field validation rejects a resurrected partial record, and tests cover it; a concurrent delete may surface one generic save error before a retry reports "Song no longer exists."
- Low: a multi-file import loop can open a later draft after the admin leaves the page.
- Low: `peopleLoaded$` has no explicit error/retry path; Parse stays disabled on a permanent people-load failure.
- Low: card-preview treatment and the `Key →` preview are deliberate spec deviations, documented above.
- Low: feature-disabled copy is shared pre-existing chrome, not changed here.

## Deploy Sign-Off Checklist

1. Review the branch diff and the gate evidence in `.gate-results/`.
2. Merge `2026-10-31_Songs` into `master` in the main checkout.
3. From `/Users/e/mnt/bnk/cs/lecoursville`, run the gate again if the merge changed anything:
   `npm run e2e:gate`
4. Deploy dev first, smoke-test `/songs`, `/songs/song-a`, `/admin/songs`, and print; then deploy prod.
   Exact commands the user may run (do not run automatically):

   ```bash
   cd /Users/e/mnt/bnk/cs/lecoursville
   npm run deploy:dev
   npm run deploy:prod
   ```

   `scripts/deploy.sh` re-runs the gate and requires the human sign-off prompt. If the gate already passed on the exact merged tree, `npm run deploy:dev:nogate` and `npm run deploy:prod:nogate` skip the re-run but still require sign-off.
5. Rules deploy with the normal release; no functions or Storage rules to deploy.
6. Songs defaults ON with an empty library and a clear empty state. Super admins can flip it off on Features until the songbook is populated.
7. Post-deploy: import the real songbook at `/admin/songs`; print one sheet and transpose one bracket song on a phone.

## Verify Commands

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
cd /Users/e/mnt/bnk/cs/lecoursville-songs
git status --porcelain
git log --oneline master..HEAD
node -e "for(const f of ['chromium','webkit','firefox'])console.log(f,require('./.gate-results/'+f+'.json').stats)"
npm run e2e:gate
```

Expected: clean tree, 27 commits, each browser 320 expected / 0 unexpected / 0 flaky at the last full gate; rerun `npm run e2e:gate` now to cover the latest commits.

## Next Actions

1. Run `npm run e2e:gate` on the current HEAD; the latest three commits are not covered by the last full gate.
2. User review and merge; no push or deploy was performed by the agent.
3. Deploy dev, smoke, deploy prod with sign-off.
4. Populate the library and announce when non-empty.
5. Optional follow-ups: split song metadata from bodies if the library grows; revisit chord-over wrapping on narrow screens; decide whether pending members should get `ApprovedGuardService` on Songs; refresh the shared feature-disabled copy.

## Open Risks / Blockers

No blockers. Residual risks are the deferred items above plus the normal deploy-time rules rollout. The latest presentation/print commits have targeted unit and Chromium Songs e2e coverage only; the full 3-browser gate must rerun before merge. The full gate is emulator-only; no real Firebase project or production data was touched.
