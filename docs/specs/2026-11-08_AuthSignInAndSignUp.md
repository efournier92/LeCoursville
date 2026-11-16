# Auth Sign-In And Sign-Up

Spec for UI-011 and UI-012. Workstream WS4. Depends on WS1.

## Goal

A clear sign-in card with email and password above Google, correct copy, no redundant toolbar link, a theme toggle available when signed out, and a working email and password account creation path that lands new users in pending approval.

## Non-Goals

- No change to server-owned membership or approval.
- No invite system beyond the chosen default.
- No redesign of the `/auth/action` recovery flow.

## Current State

- `auth.component.html` renders Google first (`:35-38`), then the `or` divider (`:39`), then email (`:40-45`) and password (`:46-58`), then submit (`:71-74`). Heading is `Sign in` (`:32`), subtitle `Welcome back to LeCoursville` (`:33`), submit `Sign in` and `Signing in...` (`:73`).
- `app.component.html:38-43` renders a signed-out toolbar Sign In link. The theme toggle lives inside the signed-in `@else` branch (`:81-95`).
- `AuthService` imports `signInWithEmailAndPassword` and `sendPasswordResetEmail` but not `createUserWithEmailAndPassword` (`auth.service.ts:1-20`). `onSignIn` (`:191`) and `createUser` (`:220-238`) write the profile then call `claimMemberRole` (`:366-372`). New users land pending.
- Error mapping exists at `auth.component.ts:203-230`.

## Behavior And Acceptance Criteria

### UI-011 Sign-In Page

- Order is email and password, then divider, then Continue with Google.
- Heading reads `Sign In`. Subtitle reads `Welcome To LeCoursville`. Submit reads `Sign In` and `Signing In...`.
- The toolbar Sign In link is hidden on the root sign-in route only, not on every signed-out route.
- The theme toggle renders on the sign-in page and keeps `data-testid="theme-toggle"`.

### UI-012 Account Creation

- `AuthService.createAccount(email, password)` wraps `createUserWithEmailAndPassword`, then runs the same profile and `claimMemberRole` path as `onSignIn`.
- The auth card supports a Sign In and Create Account mode toggle, with confirm-password and minimum validation.
- New account errors map to friendly messages for `email-already-in-use`, `weak-password`, and `invalid-email`.
- A created account lands pending and shows the pending banner.

## Decisions

- Open signup, not invite-gated.
- Server approval remains required.
- No email-verification gate before approval.
- Minimum 8 characters, confirmed match, plus the Firebase error mapping.

## Light, Dark, And Print

The toggle works on the sign-in page in both modes. No print path.

## Accessibility

- Mode toggle exposes `role="switch"` or a tablist with `aria-selected`.
- Errors are announced with `role="alert"` and tied by `aria-describedby`.
- Field order is logical and the Google button remains keyboard reachable.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Order and copy | `e2e/specs/auth.spec.ts` | Email before Google, exact heading, subtitle, submit copy |
| Toolbar link hidden on root | `e2e/specs/nav.spec.ts` | No toolbar Sign In on the sign-in route, present elsewhere |
| Theme toggle signed out | `e2e/specs/dark-mode.spec.ts` | Toggle present on sign-in and flips the theme |
| Create account | `e2e/specs/auth.spec.ts` | New user created, lands pending, sees banner |
| Duplicate and weak password | `e2e/specs/auth.spec.ts` | Friendly errors, no account created |
| Guard regression | `e2e/specs/auth.spec.ts` | Existing seeded users still sign in |

## Rollout And Rollback

Single deployable change. No schema change. Roll back by branch revert. Created accounts are ordinary auth users, so a revert leaves them in pending as expected.

## Resolved Decisions And Open Questions

- Resolved: open signup with server approval, no email-verification gate, 8-character minimum.
- Open human decision: whether to require email verification before approval later.
