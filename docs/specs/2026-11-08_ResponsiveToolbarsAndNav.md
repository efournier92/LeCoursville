# Responsive Toolbars And Nav Links

Spec for UI-004 and UI-019. Workstream WS7. Depends on WS1.

## Goal

Top-nav links open in a new tab on middle-click and modifier-click, and mobile page toolbars stack left-aligned instead of wrapping right-aligned.

## Non-Goals

- No change to routes or guards.
- No new toolbar component.
- No icon-only mobile redesign beyond existing truncation.

## Current State

- Top-nav items are native `<button>` elements with `[routerLink]` (`navbar-links.component.html:20-24`, `:39-43`).
- `.page-toolbar` is `flex-wrap: wrap`. `.page-toolbar-content` inherits per-cluster alignment and the tools cluster is `justify-content: flex-end` (`shared/page-toolbar/page-toolbar.component.scss:10-14`, `:61-68`). Under 600px only `flex-basis: 100%` applies (`:116-129`).
- `.admin-filter-bar` is at `admin-data.scss:70` and `.admin-filter-actions` at `:137`.

## Behavior And Acceptance Criteria

### UI-004 New Tab

- Inline and mobile nav items render as `<a>` with `[routerLink]`, keeping `routerLinkActive`, icons, labels, and test hooks.
- Middle-click and ctrl or cmd click open a new browser page at the target route. Plain click navigates in place and sets active.
- Mobile `mat-menu-item` anchors keep hit area and focus styling.

### UI-019 Mobile Toolbars

- Under 600px `.page-toolbar` is a column with `align-items: stretch` and 8px row gap.
- Title and left cluster are full width and left aligned. Content cluster is `justify-content: flex-start`, full width, wrapping from the left.
- `.admin-filter-bar` becomes a column. `.admin-filter-actions` drops `margin-left: auto` and right alignment, uses `justify-content: flex-start` and `flex: 1 1 100%`.
- Buttons are not stretched edge to edge. 44px touch targets stay.

## Data Model And Rollout

- No data change. Roll back by branch revert.

## Light, Dark, And Print

- Toolbars and nav renders follow existing tokens. No print change.

## Accessibility

- Anchors keep accessible names and focus visibility.
- Mobile stack order matches reading order.
- Touch targets stay 44px.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Nav hrefs | `e2e/specs/nav.spec.ts` | Each desktop nav anchor exposes an `href` matching its route |
| Middle click | `e2e/specs/nav.spec.ts` | Middle click opens a second page at the target URL |
| Modifier click | `e2e/specs/nav.spec.ts` | Ctrl or cmd click opens a new tab, current page unchanged |
| Plain click | `e2e/specs/nav.spec.ts` | Plain click navigates in place and sets active |
| Mobile toolbar stack | `e2e/specs/nav.spec.ts` or `e2e/specs/edge-cases.spec.ts` | Phone viewport toolbar children stack, left edges match the content box, cover admin list, People, Calendar, Photos |

## Resolved Decisions And Open Questions

- Resolved: mobile actions stay text labels, stacked and left aligned.
- Resolved: anchors replace buttons, no custom click handler.
