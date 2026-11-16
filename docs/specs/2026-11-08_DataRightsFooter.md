# Data Rights Footer

Spec for UI-005. Workstream WS8. Independent create-spec, build, redteam cycle. Never folded into the core batch merge.

## Goal

A site-wide footer that gives every visitor a plain, accessible way to request data removal or data update, with a real backend path and legally careful copy.

## Non-Goals

- No final legal text in this spec. Legal copy is human-reviewed.
- No change to admin permissions beyond the request queue.
- No automated deletion without admin review.

## Current State

- No global footer. `app.component.html` ends at `<router-outlet>`.
- The only data-removal path is a `mailto:` link inside the family explorer (`family-explorer.component.html:58-60`, `family-explorer.component.ts:131-135`). It is scoped to one page, email only, and has no update path.

## Behavior And Acceptance Criteria

- A semantic `<footer>` renders on all user-facing routes, hidden on print and on the admin shell.
- It offers Data Removal, Data Update, and a general Contact path.
- The request path works without sign-in.
- Plain language, no dark patterns, visible focus, 44px targets, contrast in light and dark, responsive layout, no dead links.
- A stated response handling that the app can keep.

## Backend

- Use Realtime Database, not Firestore. The project has never used Firestore and every other path is RTDB, so a new store would add a second database, a second rules file, and a second SDK path for one feature.
- An in-app form persists a request record under a `dataRequests` node with an admin-visible queue at `/admin/data-requests`. No email fallback is required.
- The request record holds a data class, a contact method, a description, a timestamp, and a status of `open`, `resolved`, or `closed`.
- Admin queue surfaces requests and supports resolve and close. Only a super admin can grant or perform a removal.
- Do not store more PII than the request needs. Do not log request bodies to the console.
- Add the RTDB rules: public create for the request node with validation, admin read and update, no public read. Index on `status` for the queue.

## Semantics And Scope

- Removal means hard delete the record when the request is verified and granted. This is irreversible, so it requires an explicit super-admin confirmation and a manual export of the affected record first.
- Keep a minimal deletion audit entry with record id, timestamp, and the acting admin. Never keep the deleted PII in the audit entry.
- Scope is people, photos, media, calendar, contacts, and messages. A removal request names its data class so the admin knows what to delete.
- Identity is email verification plus admin review. An unverifiable request is still recorded and gets a human response, but no data is deleted without verification.

## Legal Copy

- Keep the copy short and safe. State what the visitor can request, that we will review and respond, and the contact method. Do not promise a specific response window, do not claim a legal basis, and do not invent jurisdiction-specific text.
- A human reviews the final wording before ship. The build must not block on a long legal document.

## Data Model And Rollback

- New `dataRequests` RTDB node plus an admin queue route. Removal acts on existing person and media records only when granted.
- Roll back by disabling the footer and the queue route. Stored requests remain readable by admins. Hard deletes cannot be undone, so the pre-delete export is the recovery path.

## Light, Dark, And Print

- Footer reads in both modes. Hidden in print. Contrast meets AA for link and body text.

## Accessibility

- Landmark `footer`, logical focus order, visible focus, no color-only meaning.
- The form has labels, inline errors, and an announced success state.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Footer present | `e2e/specs/feature-flags.spec.ts` or a new footer spec | Footer renders on each user route, not on admin, not in print |
| Removal request | footer spec | Submit creates a `dataRequests` record visible in the admin queue |
| Update request | footer spec | Submit creates an update request |
| Admin queue | `e2e/specs/admin-system.spec.ts` | Super admin sees the request, can resolve it, and the grant path requires confirmation |
| Keyboard path | footer spec | Full flow reachable by keyboard |
| Light and dark | footer spec | Footer legible in both modes |
| Mobile | footer spec | Footer stacks without overflow |
| Security | `e2e/specs/security.spec.ts` | Request input cannot inject script or read another request |

## Redteam Focus

Privacy, PII leakage in requests, XSS, auth bypass on the admin queue, and dark-pattern or legal gaps.

## Resolved Decisions And Open Questions

- Resolved: request channel is an in-app RTDB queue, not Firestore and not mailto.
- Resolved: removal is a hard delete with a pre-delete export and a minimal audit entry.
- Resolved: legal copy stays short and safe, human-reviewed, no promised response window.
- Open human decision: confirm jurisdiction and the exact short copy. Never invent final legal text.
