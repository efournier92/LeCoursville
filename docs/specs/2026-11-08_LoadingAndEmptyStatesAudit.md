# Loading And Empty States Audit

Spec for UI-023. Workstream WS2. Depends on WS1.

## Goal

No component shows a permanent skeleton when its collection is empty. An explicit loaded signal replaces the consumer-side empty-emission guess, and every audited component proves its empty state.

## Non-Goals

- No pagination or data-loading redesign.
- No change to the message write paths.

## Current State

- Admin Expressions renders the shared `ExpressionsComponent` (`admin.module.ts:78-81`), so the bug affects the user page too.
- With zero expressions, `isLoading` never clears. The skeleton renders forever (`expressions.component.html:79-99`), and the empty state at `:136-143` is unreachable.
- `MessageComponent` declares `let isSeed = true` per subscription and drops the first empty emission (`message.component.ts:59-71`). `subscribeMessagesObservable` reruns on every user emission (`:54-56`). `MessageService` is a `BehaviorSubject([])` that replays its current value (`message.service.ts:17-26`).
- `ExpressionsComponent` declares its own `isLoading` (`expressions.component.ts:19`) while the base class uses `loading`. `retry()` resets only the base field (`message.component.ts:73-78`).

## Behavior And Acceptance Criteria

- `MessageService` exposes an explicit loaded signal, `messagesLoaded$` or `hasLoaded`, or switches to `ReplaySubject(1)`.
- `MessageComponent` clears loading only when that signal says the first real read completed, empty or not.
- One loading field per component. `retry()` resets it.
- With zero messages the empty state shows and the skeleton is gone.
- Retry after an error recovers.

## Audit List

Each of these shows an empty state and never a permanent skeleton: `admin-calendars`, `admin-songs`, `admin-photo-albums`, `admin-families`, `admin-users`, `admin-analytics`, `admin-recovery`, `admin-user-uploads`, `admin-media`, `admin-family-explorer`, `admin-people-import`, plus `contacts`, `people`, `calendar`, and `media-list`.

## Data Model And Rollout

- No data change. Roll back by branch revert.

## Light, Dark, And Print

Empty and skeleton states follow existing tokens in both modes.

## Accessibility

- Empty state is announced or visible text, not an aria-only signal.
- Skeleton is not focusable.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Zero expressions | `e2e/specs/expressions.spec.ts` | Empty state shows, skeleton absent |
| Retry recovery | `e2e/specs/loading.spec.ts` | After an error, retry shows content or empty state |
| Empty admin collections | `e2e/specs/loading.spec.ts` | One case per audited admin component |
| Empty user collections | `e2e/specs/loading.spec.ts` | Contacts, people, calendar, media list |

## Unit Coverage

- `message.component.spec.ts` proves the loaded signal clears loading on an empty first read.
- `expressions.component.spec.ts` proves the empty state renders when the collection is empty.

## Resolved Decisions And Open Questions

- Resolved: add an explicit loaded signal rather than inferring seed from an empty emission.
- Resolved: unify to one loading field.
