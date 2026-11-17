# Handoff: Support Portal And Analytics Report

- Date: 2026-11-17
- Branch: `Polish-2026-11-16`. Support portal, data-rights, sign-in and the analytics expansion are committed through `27955bfc`. Still uncommitted: the analytics partial-day annotation, the un-ship deletions, the critique ledger, the discovery entries and this handoff, plus unrelated in-progress calendar work in the tree.
- Gate state: `npm run check` PASSED (116 files, 959 tests). Targeted chromium e2e green for admin, nav, admin-consistency, admin-roles, loading, admin-analytics, security, account-recovery, data-rights, admin-system. Rules project green for dataRequests. WebKit, Firefox and the prod-storage pass have not been run since these changes, so tier 4 (`npm run e2e:gate`) is still owed before a deploy.

## What Landed

### Data and Privacy

- One contact form: `Your Email` plus `What Is This About?`, one `Send Message`, one `Cancel`. No update/remove/data-class choices, no Close.
- Footer link reads `Data and Privacy`.
- Model is `{ id, contact, description, status: open|closed, createdAt }`. Grant, verification, redaction and the audit node are gone.
- New `onDataRequestCreated` writes `adminAlerts/data-request-{id}`, so the existing `onAdminAlertCreated` Resend pipeline mails `config/adminAlertRecipients` (eric@lecoursville.com). No hardcoded address.
- Queue actions are Close and Reopen only.

### Sign-in

- Google button first, inline brand G, `Sign in with Google` / `Sign up with Google`.
- `Forgot password?` and `Get help signing in` sit behind the `Need help signing in?` toggle (hospital cross icon), hidden in create-account mode.
- 320px fold rhythm tightened inside the short-viewport media blocks.

### Support Portal

- `/admin/support`, nav label `Support`, icon `support_agent`, super only. Badge testid `admin-nav-badge-support`.
- Old `/admin/recovery` and `/admin/data-requests` redirect to it.
- Stacked sections: `Data and Privacy`, then `Account Recovery`. Both child components lost their own `.admin-page`, toolbar and intro.
- Content admins now see no System nav items.

### Analytics Report

- White `admin-surface` cards. Root cause of the tinted cards was a missing `@use 'src/app/styles/admin-data'` in the page scss.
- KPI row (users, sessions, page views, new users, avg session, bounce), `Sessions And Users` SVG trend with HTML labels, top pages and top events with share bars, device split, derived insight line.
- Payload extended: `range`, six totals, 30-point ISO daily series, devices. GA dates normalized from `YYYYMMDD`, sparse days zero-filled, range ends yesterday and is annotated partial when the source is `ga`.
- Rule documented in `docs/design/ADMIN_SURFACES.md` and linked from `AGENTS.md`.

## Redteam Ledger

`docs/critique/2026-11-17_AnalyticsReport.md` - 36 findings, all addressed or rejected with evidence. The one human decision was the partial GA day, resolved as annotation.

## Known Leftovers

- Confirm the uncommitted analytics polish and ledger are committed with the calendar work split out.

- `docs/runbooks/2026-11-09_NextProdDeployChecklist.md` still names `/admin/data-requests` and the deleted grant migration.
- The working tree also carries unrelated in-flight edits (app.component, admin-calendars, functions/config, several specs) that this session did not touch.
- Tier 4 browser matrix and the prod-storage pass are unrun.

## Resume Prompt

Continue on `Polish-2026-11-16`. Read `docs/handoffs/2026-11-17_SupportAndAnalytics.md`. Next step is `npm run e2e:gate`, then `ship-changes` if the user approves committing the Support portal and analytics report work.
