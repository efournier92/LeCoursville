# Agent Design Spec: Admin Feature Flags

## Branch & Directories

- **Base directory**: `/Users/e/mnt/bnk/cs/lecoursville`
- **Frontend**: Angular 15 SPA at `src/app/`
- **Firebase Backend**: Realtime Database (dev + prod separate projects)

---

## Context & Motivation

The top-nav menu items are hardcoded in `NavbarLinksComponent.buttons[]` (`navbar-links.component.ts` lines 17-58). There is no mechanism to show or hide nav items per environment or to toggle features on/off without a code deployment. The goal is to give admins the ability to enable/disable top-nav menu items from the Admin UI, with state persisted in Firebase Realtime Database per environment.

---

## Glossary

- **Feature Flag**: A boolean toggle stored in Firebase under `/features/{featureId}` that controls whether a nav item is visible.
- **Feature ID**: The identifier for a toggleable nav item, matching the route path (e.g., `expressions`, `music`, `videos`, `calendar`, `contacts`, `photos`, `chat`).
- **NavbarLinksComponent**: The component at `src/app/components/navbar-links/navbar-links.component.ts` that renders the top-nav menu buttons.
- **FeatureFlagsService**: The new service that wraps Firebase reads/writes for feature flags.
- **AdminFeaturesComponent**: The new admin tab component for managing feature flags.

---

## Current State

### NavbarLinksComponent

**File**: `src/app/components/navbar-links/navbar-links.component.ts`

The `buttons` array is hardcoded (lines 17-58) with 8 items:
```typescript
buttons: LinkableButton[] = [
  { title: 'Expressions',  link: '/expressions',       icon: 'format_quote'    },
  { title: 'Music',        link: '/media/audio',       icon: 'library_music'   },
  { title: 'Videos',       link: '/media/video',        icon: 'local_movies'    },
  { title: 'Calendar',     link: '/calendar',          icon: 'calendar_today'  },
  { title: 'Contacts',     link: '/contacts',          icon: 'people'          },
  { title: 'Photos',       link: '/photos',            icon: 'photo'           },
  { title: 'Chat',         link: '/chat',              icon: 'message'         },
  { title: 'Account',      link: '/',                  icon: 'account_circle'  },
];
```

Template (`navbar-links.component.html` lines 1-14) uses `*ngFor="let button of buttons"` to render each as a `mat-button` with `[routerLink]="button.link"`.

### AdminRoutingComponent

**File**: `src/app/components/admin-routing/admin-routing.component.ts`

Tab navigation uses `mat-button-toggle-group` with three toggles: `onClickUsersRoute()`, `onClickCalendarRoute()`, `onClickMediaRoute()`. Navigation is via `routingService.NavigateTo*` methods.

**Route**: `src/app/app-routing.module.ts` lines 69-83.

### Firebase Pattern

Standard injection pattern:
```typescript
constructor(private db: AngularFireDatabase) {}
```

Reads: `db.list(path).valueChanges()` returns `Observable<T[]>`
Writes: `db.list(path).set(key, value)` or `db.object(path).set(value)`

Existing Firebase paths: `/users/{uid}`, `/calendarEvents/{id}`, `/media/{id}`, `/contacts/{id}`, `/messages/{id}`, `/photos/{id}`.

No `database.rules.json` in repo — rules managed via Firebase Console.

### Environment Config

**File**: `src/environments/environment.ts`

Dev project: `lecoursville-dev`. Each Firebase project has its own RTDB, so data written to `/features/{id}` in the dev DB is automatically per-environment.

---

## Goals

1. Admins can view a list of all toggleable nav items on a new `/admin/features` tab.
2. Each feature has a checkbox toggle — ON/OFF state is persisted to Firebase.
3. If a feature flag has no Firebase value yet, it defaults to ON.
4. Nav items whose flag is OFF are filtered out of the navbar before rendering (hidden entirely).
5. The "Account" nav item is never toggleable — it is always visible.
6. Feature flag reads happen once at navbar component initialization (not real-time reactive).
7. Non-admin users cannot access `/admin/features`.

---

## Non-Goals

1. Real-time reactive updates to navbar when flags change (navbar reads once on init only).
8. If a user navigates directly to a disabled feature's route, they see a "feature disabled" page with a "Go Home" button that sends them to `/`.
2. Bulk enable/disable all features.
3. Environment switching UI in the admin tab.
4. Feature flags for any entity other than top-nav menu items.

---

### 9. Feature Flag Guard

**File**: `src/app/services/feature-flag-guard.service.ts` (new file)

- New `CanActivate` guard that checks if a feature is enabled before allowing route access.
- Route data includes `featureId` (e.g., `{ path: 'expressions', component: ExpressionsComponent, canActivate: [FeatureFlagGuard], data: { featureId: 'expressions' } }`).
- Guard injects `FeatureFlagsService`, ensures flags are loaded, then checks if the feature is enabled.
- If feature is disabled, redirects to `/feature-disabled` with query param (e.g., `/feature-disabled?feature=expressions`).

**File**: `src/app/components/feature-disabled/feature-disabled.component.ts` (new file)
**Template**: `src/app/components/feature-disabled/feature-disabled.component.html`
**Styles**: `src/app/components/feature-disabled/feature-disabled.component.scss`

- Selector: `app-feature-disabled`.
- Reads `featureId` from query params.
- Displays Material Card with: "Feature Disabled" title, "The [feature name] feature is currently disabled." message, and "Go Home" button that navigates to `/`.

### Prerequisites

- `AuthAdminGuardService` already protects `/admin/*` routes.
- `AuthService.isUserAdmin()` check already exists at `auth.service.ts` lines 146-149.
- `AngularFireDatabase` and `AngularFireModule` already bootstrapped in `app.module.ts`.

---

## Design Principles

1. Mirror existing Firebase service patterns: inject `AngularFireDatabase`, use `BehaviorSubject` for local state.
2. Feature flag IDs match route paths exactly: `expressions`, `music`, `videos`, `calendar`, `contacts`, `photos`, `chat`.
3. Firebase path: `/features/{featureId}` — each flag is stored at its ID (e.g., `/features/expressions`).
4. Flag value schema: `{ enabled: boolean, updatedAt: number (unix timestamp) }`.
5. Default to ON if Firebase document does not exist.
6. Admin tab added as the last toggle in `AdminRoutingComponent`.

---

## Front End Requirements

### 1. New Model: FeatureFlag

**File**: `src/app/models/feature-flag.ts` (new file)

```typescript
export interface FeatureFlag {
  enabled: boolean;
  updatedAt: number;
}
```

### 2. New Service: FeatureFlagsService

**File**: `src/app/services/feature-flags.service.ts` (new file)

- Inject `AngularFireDatabase`.
- Path constant: `FEATURES_PATH = 'features'`.
- Method `getFeatureFlag(featureId: string): Observable<FeatureFlag | null>` — reads `/features/{featureId}`.
- Method `setFeatureFlag(featureId: string, enabled: boolean): Promise<void>` — writes `/features/{featureId}` with `{ enabled, updatedAt: Date.now() }`.
- Method `getAllFeatureFlags(): Observable<Record<string, FeatureFlag>>` — uses `db.object('features').valueChanges()` to get all flags at once.
- Use `BehaviorSubject<Map<string, boolean>>` locally to cache the flags map after initial load.
- `getEnabledFeatures(): string[]` — returns array of feature IDs that are enabled. If a flag is null/missing in Firebase, treat as enabled.

### 3. Unified Feature Configuration

**File**: `src/app/config/feature-config.ts` (new file)

Instead of hardcoding feature definitions in multiple places, use a single config file:
```typescript
export interface FeatureConfig {
  id: string;
  label: string;
  route: string;
  icon: string;
}

export const FEATURES: FeatureConfig[] = [
  { id: 'expressions', label: 'Expressions', route: '/expressions', icon: 'format_quote' },
  { id: 'music', label: 'Music', route: '/media/audio', icon: 'library_music' },
  { id: 'videos', label: 'Videos', route: '/media/video', icon: 'local_movies' },
  { id: 'calendar', label: 'Calendar', route: '/calendar', icon: 'calendar_today' },
  { id: 'contacts', label: 'Contacts', route: '/contacts', icon: 'people' },
  { id: 'photos', label: 'Photos', route: '/photos', icon: 'photo' },
  { id: 'chat', label: 'Chat', route: '/chat', icon: 'message' },
];
```

Both `NavbarLinksComponent` and `AdminFeaturesComponent` import from this config. Adding a new feature to the top-nav only requires adding one entry here.

### 4. Modified Component: AdminFeaturesComponent

**File**: `src/app/components/admin-features/admin-features.component.ts` (new file)
**Template**: `src/app/components/admin-features/admin-features.component.html` (new file)
**Styles**: `src/app/components/admin-features/admin-features.component.scss` (new file)

- Selector: `app-admin-features`.
- On init: call `featureFlagsService.getAllFeatureFlags()` and subscribe.
- Render a simple list: one row per toggleable feature (7 items).
- **Styling**: Checkboxes aligned at the start of each line in a straight vertical column. Labels left-aligned immediately next to their corresponding checkboxes. Uses a flex container with `.feature-row` divs for each feature.
- Each row: `[checked]="isEnabled(featureId)" (checkedChange)="onToggle(featureId, $event)"`.
- Static feature list defined in component:
  ```typescript
  featureDefs = [
    { id: 'expressions', label: 'Expressions' },
    { id: 'music',       label: 'Music'       },
    { id: 'videos',      label: 'Videos'      },
    { id: 'calendar',    label: 'Calendar'     },
    { id: 'contacts',    label: 'Contacts'     },
    { id: 'photos',      label: 'Photos'       },
    { id: 'chat',        label: 'Chat'         },
  ];
  ```
- `isEnabled(featureId)` — returns `true` if flag is `null` (default) or `flag.enabled === true`; false otherwise.
- `onToggle(featureId, enabled)` — calls `featureFlagsService.setFeatureFlag(featureId, enabled)`.

### 4. Modify NavbarLinksComponent

**File**: `src/app/components/navbar-links/navbar-links.component.ts`

- Inject `FeatureFlagsService`.
- On init: call `featureFlagsService.getAllFeatureFlags()` and subscribe to get the flags map.
- Store flags in a local `Map<string, boolean>` via `BehaviorSubject`.
- Filter `buttons` array: only include items where `featureId` is enabled OR the item is "Account".
- The `buttons` array after filtering is used directly in the template — the template already uses `*ngFor="let button of buttons"`.

Modified `buttons` logic (new method after line 58):
```typescript
private filteredButtons: LinkableButton[] = [...];

ngOnInit() {
  this.featureFlagsService.getAllFeatureFlags().subscribe(flagsMap => {
    this.filteredButtons = this.buttons.filter(b => {
      if (b.link === '/') return true; // Account always visible
      const featureId = this.getFeatureIdFromLink(b.link);
      const flag = flagsMap[featureId];
      return flag === null || flag === undefined || flag.enabled === true;
    });
  });
}

private getFeatureIdFromLink(link: string): string {
  const map: Record<string, string> = {
    '/expressions': 'expressions',
    '/media/audio':  'music',
    '/media/video':   'videos',
    '/calendar':     'calendar',
    '/contacts':     'contacts',
    '/photos':       'photos',
    '/chat':         'chat',
  };
  return map[link] || link;
}
```

### 5. Modify AdminRoutingComponent

**File**: `src/app/components/admin-routing/admin-routing.component.ts`

- Add a new method `onClickFeaturesRoute()` calling `routingService.NavigateToAdminFeatures()`.
- Add a new `mat-button-toggle` in the template for "Features" as the last toggle.

**Template** (`admin-routing.component.html`): Add a 4th toggle button after the Media toggle:
```html
<mat-button-toggle class="admin-routing-button col" (click)="onClickFeaturesRoute()">Features</mat-button-toggle>
```

### 6. Modify RoutingService

**File**: `src/app/services/routing.service.ts`

- Add `NavigateToAdminFeatures()` method returning `/admin/features`.

### 7. New Route

**File**: `src/app/app-routing.module.ts`

- Add route: `{ path: 'admin/features', component: AdminFeaturesComponent, canActivate: [AuthAdminGuardService] }`.
- Place after existing admin routes.
- Add route: `{ path: 'feature-disabled', component: FeatureDisabledComponent }`.

### 8. Routes with Feature Flag Guard

**File**: `src/app/app-routing.module.ts`

- Add `FeatureFlagGuard` to each toggleable feature route:
  - `/expressions` -> `{ data: { featureId: 'expressions' } }`
  - `/media/audio` -> `{ data: { featureId: 'music' } }`
  - `/media/video` -> `{ data: { featureId: 'videos' } }`
  - `/calendar` -> `{ data: { featureId: 'calendar' } }`
  - `/contacts` -> `{ data: { featureId: 'contacts' } }`
  - `/photos` -> `{ data: { featureId: 'photos' } }`
  - `/chat` -> `{ data: { featureId: 'chat' } }`

### 8. Module Registration

**File**: `src/app/app.module.ts`

- Add `AdminFeaturesComponent` to `declarations` array.
- Add `MatCheckboxModule` and `MatListModule` imports if not already present.

---

## Firebase Requirements

### Database Paths

- **Read**: `/features/{featureId}` — value is `{ enabled: boolean, updatedAt: number }`
- **Write**: `/features/{featureId}` — same structure
- **Read all**: `/features` (object snapshot) — returns `Record<string, FeatureFlag>`

### Feature IDs and Firebase Paths

| Feature ID   | Firebase Path           |
|---|---|
| `expressions` | `/features/expressions` |
| `music`       | `/features/music`        |
| `videos`      | `/features/videos`       |
| `calendar`    | `/features/calendar`     |
| `contacts`    | `/features/contacts`     |
| `photos`      | `/features/photos`       |
| `chat`        | `/features/chat`         |

### Security Rules

No `database.rules.json` in repo. Rules must be managed via Firebase Console. The rules should allow authenticated admin users to read/write `/features/*`. Since `AuthAdminGuardService` already restricts access to admin users on the client side, the Firebase rules should enforce: allow read/write if `auth != null`.

### Auth Context

- Only users with `roles.admin === true` can access `/admin/features`.
- No additional Firebase auth claims required beyond existing `roles.admin` pattern.

---

## Production Risks & Mitigations

1. **Risk**: If Firebase is unreachable, navbar loads with all features ON (default behavior). **Mitigation**: The `getAllFeatureFlags()` subscription handles errors silently and the BehaviorSubject fallback treats unknown flags as enabled.
2. **Risk**: Feature flags for new environments are empty, so all nav items appear by default. **Mitigation**: This is intentional — defaults to ON so a fresh environment doesn't break navigation.
3. **Risk**: Admin toggles a feature OFF but the navbar still shows it until page refresh. **Mitigation**: This is accepted per the "load on init only" requirement — navbar is not real-time reactive.
4. **Risk**: Firebase write failure leaves admin UI in misleading state. **Mitigation**: Catch write errors in `setFeatureFlag()` and log to console (no user-facing error UI needed for this admin tool).

---

## Rollout Plan

1. Create `FeatureFlag` model.
2. Create `FeatureFlagsService` with Firebase reads/writes.
3. Create `AdminFeaturesComponent` with toggle UI.
4. Add `/admin/features` route and `AuthAdminGuardService` guard.
5. Add "Features" toggle button to `AdminRoutingComponent`.
6. Modify `NavbarLinksComponent` to filter based on flags from service.
7. Register component in `AppModule`.
8. Test locally: toggle a feature OFF, verify it disappears from navbar on next page load.

---

## Test Plan

### FeatureFlagsService (`feature-flags.service.spec.ts`)

1. `getFeatureFlag()` returns `Observable<FeatureFlag>` when Firebase returns a flag.
2. `getFeatureFlag()` returns `null` when Firebase path has no data (default to ON behavior).
3. `setFeatureFlag()` writes correct `{ enabled, updatedAt }` structure to Firebase.
4. `getAllFeatureFlags()` returns `Record<string, FeatureFlag>` from Firebase object snapshot.

### AdminFeaturesComponent (`admin-features.component.spec.ts`)

1. On init, calls `featureFlagsService.getAllFeatureFlags()`.
2. Renders all 7 feature rows from `featureDefs`.
3. `isEnabled()` returns `true` when Firebase flag is `null` (default ON).
4. `isEnabled()` returns `true` when Firebase flag has `enabled: true`.
5. `isEnabled()` returns `false` when Firebase flag has `enabled: false`.
6. `onToggle()` calls `featureFlagsService.setFeatureFlag()` with correct args.
7. Clicking a checkbox calls `onToggle()` with the new boolean value.

### NavbarLinksComponent (`navbar-links.component.spec.ts`)

1. When `getAllFeatureFlags()` returns `{ music: { enabled: false } }`, the Music button is not in `filteredButtons`.
2. When `getAllFeatureFlags()` returns `{}` (empty), all 7 toggleable buttons are present in `filteredButtons`.
3. "Account" button is always present regardless of flags.
4. "Account" button maps to `link === '/'` and is never filtered.

### AdminRoutingComponent (`admin-routing.component.spec.ts`)

1. New "Features" button toggle is present in the template.
2. Clicking "Features" toggle calls `onClickFeaturesRoute()`.
3. `onClickFeaturesRoute()` calls `routingService.NavigateToAdminFeatures()`.

### RoutingService (`routing.service.spec.ts`)

1. `NavigateToAdminFeatures()` navigates to `/admin/features`.

---

## Summary of Changes

### New Files

- `src/app/models/feature-flag.ts` — `FeatureFlag` interface
- `src/app/config/feature-config.ts` — Unified feature configuration (`FEATURES` array)
- `src/app/services/feature-flags.service.ts` — Firebase service for feature flags
- `src/app/services/feature-flags.service.spec.ts` — Tests
- `src/app/services/feature-flag-guard.service.ts` — Route guard for feature flags
- `src/app/components/admin-features/admin-features.component.ts` — Admin tab component
- `src/app/components/admin-features/admin-features.component.html` — Template with checkbox list
- `src/app/components/admin-features/admin-features.component.scss` — Styles
- `src/app/components/admin-features/admin-features.component.spec.ts` — Tests
- `src/app/components/feature-disabled/feature-disabled.component.ts` — Disabled feature page
- `src/app/components/feature-disabled/feature-disabled.component.html` — Template
- `src/app/components/feature-disabled/feature-disabled.component.scss` — Styles

### Modified Files

- `src/app/components/navbar-links/navbar-links.component.ts` — Inject service, filter buttons by flags
- `src/app/components/admin-routing/admin-routing.component.ts` — Add `onClickFeaturesRoute()` method
- `src/app/components/admin-routing/admin-routing.component.html` — Add 4th toggle for Features tab
- `src/app/services/routing.service.ts` — Add `NavigateToAdminFeatures()` method
- `src/app/app-routing.module.ts` — Add `/admin/features` route with `AuthAdminGuardService`, add `/feature-disabled` route, add `FeatureFlagGuard` to feature routes
- `src/app/app.module.ts` — Register `AdminFeaturesComponent`, `FeatureDisabledComponent`, add `MatCheckboxModule`/`MatListModule` imports

### Firebase Data

- New path: `/features/{featureId}` with schema `{ enabled: boolean, updatedAt: number }`
- 7 feature IDs: `expressions`, `music`, `videos`, `calendar`, `contacts`, `photos`, `chat`

---

## Verification

1. **Local**: `ng serve` — navigate to `/admin/features`, toggle "Music" OFF, open navbar in another tab, confirm Music is hidden. Refresh and confirm state persists.
2. **Firebase**: Write directly to `/features/music` in Firebase Console with `{ enabled: false }` — verify navbar reflects change after refresh.
3. **Default behavior**: Delete a flag from Firebase entirely — verify the item appears in navbar (default ON).

---

## Open Questions

None — all questions resolved during clarification rounds.