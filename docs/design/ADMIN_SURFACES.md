# Admin Surface Rules

## White Cards Only

Admin content cards use the shared `admin-surface` white surface from `src/app/styles/admin-data.scss`.
Any tinted card background (light green, yellow, or cream) is never acceptable, because the admin area has one surface language and a tint reads as an unthemed Material default.
Every admin page-level scss must import the shared sheet as its first line.

```scss
@use 'src/app/styles/admin-data' as *;
```

## Tables And Scrolling

Tables use `admin-table` and sit inside an `admin-table-scroll` wrapper so phones pan instead of clipping the content.

## Failure Symptom

A missing `@use` import leaves `admin-surface` undefined and the card falls back to the Material default `mat-card` background, which is the beige or yellow tint seen on the analytics page.
