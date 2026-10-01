# Loading Contract: skeletons, content, errors, and the top-nav

## Problem

Rapid refresh can strand any page in skeleton state. Root causes, from the loading-behavior audit (2026-10-01):

- No data subscription anywhere carries an error callback; a failed or aborted Firebase stream leaves `loading`/`isLoading` true forever.
- Contacts and people treat `items.length === 0` as "loading", so a genuinely empty dataset renders an eternal skeleton.
- Chat, expressions, photo-albums, and media-list dismiss skeletons with a `setTimeout(500)` after first emit; if the first emit errors, dismissal never runs.
- Top-nav links render only `@if (user?.id)`: while Firebase auth resolves (the mash-refresh window), the toolbar shows but the nav area is blank.

## Contract (all non-admin routes)

Each page's primary data load has exactly one of four states, rendered explicitly:

- `loading`: existing skeleton markup, container gets `aria-busy="true"`. Skeleton must be visible in the DOM whenever data has not yet arrived AND no error occurred.
- `error`: the shared error component (`LvLoadErrorComponent`): short message, role="alert", and a "Try again" button that resubscribes the stream. Never a silent skeleton.
- `empty`: data arrived, zero items: a distinct empty-state message. Not a skeleton.
- `ready`: content.

Rules:

- State is an explicit `status: 'loading' | 'error' | 'empty' | 'ready'` (or equivalent signal) per component; no inferring loading from array length; no `setTimeout`-based dismissal. Delete the 500ms hacks.
- Every `subscribe(` on a data stream passes an error callback that sets `error`. No exceptions.
- Streams owned in the component (not template `async` pipe alone) so retry can resubscribe; unsubscribe on destroy stays as-is.
- Reuse existing per-page skeleton markup and styles; do not redesign them. Shared piece is only `LvLoadErrorComponent` (inline styles, no new deps).

## Top-nav

- Toolbar chrome and logo render immediately, unconditionally (already true; keep it).
- Cache-first: for returning users the links render immediately from the localStorage user (cosmetic only; the admin guard stays RTDB-backed). The skeleton shows only for first visits with no cache. `userObservable`'s `{}` seed must not wipe the cached render.
- Nav links area never blank: while the auth user is unresolved AND no cache exists, render a single skeleton placeholder in the links slot; when user is `null`, render the sign-in link; when resolved, render `app-navbar-links` (which itself shows skeleton pills while feature flags are pending, links after).
- `authResolved$` resolves on: signed-out auth state, the RTDB user record landing, or a 5s safety timeout (a missing `users/{uid}` node must not skeleton forever).
- The RTDB websocket is warmed at boot via a `.info/connected` listener, so the user record, flags, and page data pay one RTT instead of a serial TLS + WS handshake after auth restore.

## Feature-flag guard

- `feature-flag-guard.service.ts` gains a 10s timeout: if flags never become ready, log one `console.warn` and fail open (matches the service's existing error posture). A hung route is worse than an unflagged one.

## Out of scope

- Admin routes, SSR, resolvers, global loading watchdogs, retry backoff. `minimalist:` ceiling: if the e2e stress suite still finds hangs after error callbacks exist, revisit a watchdog then.

## E2E coverage (mandatory per AGENTS.md)

New `e2e/specs/loading.spec.ts`, fixture-based (console-error collector), deterministic waits only:

1. Per non-admin route: toolbar visible within 1s of navigation; then content (or empty-state) visible within the config expect timeout. Never a blank body.
2. Reload stress: per route, three rapid reloads, then settle: content renders, zero console errors.
3. Empty-state: seeded sparse user with no contacts/photos sees the empty-state message, not the skeleton.
4. Nav: after fresh load + login, links visible without a blank-links window in between (toolbar assertion covers chrome; links assertion covers resolution).

Seed extensions go in `scripts/e2e/seed.mjs`, never hand-edited emulator state.
