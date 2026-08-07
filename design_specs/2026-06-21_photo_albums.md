# Photo Albums & Ken Burns Slideshow

## Branch & Directories

- **Base directory (frontend only — no backend)**: `/Users/e/mnt/bnk/cs/lecoursville`
- **New design spec**: `design_specs/2026-06-21_photo_albums.md`

## Design Revision (2026-08-06)

**User side is view-only; all curation lives on the admin side.** Sections §5 and §6
originally described admin actions inline on the user-facing `/photos` grid and
`/photos/:albumId` detail (New Album, Edit/Delete album, Add Photos, per-photo edit,
set cover, delete). These were removed: `PhotoAlbumsComponent` and
`PhotoAlbumDetailComponent` now expose viewing only (search/sort, PhotoSwipe,
slideshow, download). Album + per-photo curation (create/rename/delete albums,
folder upload, add photos, edit photo metadata, set cover, delete photo) happens on
`/admin/photo-albums` — see `design_specs/2026-06-23_admin_photo_albums.md`, which
gained a per-album photo-management drill-in and a "New Album" (empty album) button.
`photo_album_create` / `photo_album_delete` analytics moved to the admin component.

## Context & Motivation

The current `/photos` page is the third-most-edited surface in the codebase (chat and contacts get more attention) and the most user-facing of the photo flows, yet its three sibling components and four RTDB paths are in a half-migrated state. `PhotosComponent` (legacy admin gallery) loads everything from `/photos/{id}` flat; `PhotoAlbumComponent` (media-explorer lightbox viewer) is a hollow shell whose subscribe block was commented out months ago and whose template renders an empty lightgallery; the only path that writes a `PhotoAlbum` is `UserUploadService.createPhotoAlbum` (`src/app/services/user-upload.service.ts:161-170`), and it sets `listing = [upload.id]` — a single-element array — to a `Photo` ID that has no corresponding record. The user-upload flow therefore creates album shells that point at nothing, the legacy gallery has no concept of albums at all, and chat attachments sit alongside curated photos in `/photos/{id}` with a never-read `isMessageAttachment` flag. Dead code, commented-out writes, and a 7-second `setTimeout` in the upload-progress component (`src/app/components/photo-upload-progress/photo-upload-progress.component.ts:37`) all confirm the feature needs an overhaul rather than another patch.

We are taking the opportunity to add a real album structure, a true full-screen Ken Burns slideshow, and a modern web-standard lightbox (PhotoSwipe v5 — MIT, vanilla JS, no Angular-version lock-in), while keeping the legacy `/photos/{id}` flow reachable via an admin feature flag so existing users do not lose access to curated photos.

## Glossary

- **Album** — a `PhotoAlbum` record at `/photoAlbums/{albumId}`. A named container of zero-or-more `Photo` records identified by `Photo.albumId`. Lean: id, title, coverPhotoId, createdAt, updatedAt.
- **Cover photo** — `PhotoAlbum.coverPhotoId`. The single photo shown on the album card. Auto-set to the first photo's id on read if null.
- **Photo** — a record at `/photos/{photoId}`. Gains a new `albumId: string | null` field. Stays where it is in Storage and RTDB; only gains an FK.
- **Legacy photo** — a `Photo` record with no `albumId` value (still null). Continues to render in the legacy `PhotosComponent` view when the `enablePhotoAlbums` feature flag is OFF. When the flag is ON, legacy photos are hidden by default — the admin toggles the flag to bring them back.
- **Slideshow** — the new `PhotoSlideshowComponent` rendered at `/photos/:albumId/slideshow`. Full-screen, Ken Burns panning, random photo order, controls overlay.
- **Ken Burns effect** — a slow zoom-in (1.00× → 1.08×) with a small parallel pan (~8% of frame) applied to each slide for the duration of the slide. Direction randomized per slide from four options: TL→BR, TR→BL, BL→TR, BR→TL.
- **PhotoSwipe** — `photoswipe` ^5.4 npm package. Vanilla TS lightbox. The lightbox for clicking into a photo from an album grid.
- **`enablePhotoAlbums`** — new boolean feature flag at `/features/enablePhotoAlbums`. Default OFF. When ON, `/photos` shows the new `PhotoAlbumsComponent`. When OFF, `/photos` shows the legacy `PhotosComponent`. Surfaced on the existing `/admin/features` page.
- **`photos` (existing flag)** — gates whether `/photos` exists at all. The new flag only affects which view appears inside the page when `photos` is ON.

## Current State

- **`src/app/components/photos/photos.component.ts:1-338`** — main `/photos` page. Subscribes to `photosService.allPhotosObservable` (line 285-294), paginates client-side 3 + 10 (line 167-184), supports search (line 220-247) and three sort modes. Edit form (lines 99-106) is wired to `PhotosService.updatePhoto`, whose RTDB write is **commented out** (`src/app/services/photos.service.ts:48-51`). Delete method (line 108-122) has a splice index bug — it splices `loadedPhotos[i]` using an `i` that iterates `allPhotos.length`. Upload method (line 137-160) is unreachable: the template has no `<input type="file">` or `<app-file-input>`. The lightgallery block (`updatePhotoGallery`, lines 317-337) is commented out — `lightLink` anchor classes on line 95 of `photos.component.html` are also commented out.
- **`src/app/components/photo-album/photo-album.component.ts:1-78`** — `<app-photo-album>`. Renders an empty lightgallery. `initializeAlbumListing` (lines 60-66) iterates `album.listing` but the inner subscribe (lines 68-77) is commented out. Template (`photo-album.component.html:1-15`) iterates an always-empty `photos: UploadableMedia[]` array.
- **`src/app/services/photos.service.ts:1-136`** — `PhotosService`. Provides `getAllPhotos(): AngularFireList<Photo>` (line 62), `getPhotoById(id)` (line 68), `uploadImage` (line 85-126), `updatePhoto` (line 47-53), `deletePhoto` (line 55-60), and `uploadVideoScreenshot` (line 89-91 — never called). Constructor subscribes in place (line 34-45) and leaks. Has `uploadVideoScreenshot`, dead `getYears` getter.
- **`src/app/services/user-upload.service.ts:1-187`** — guest upload queue. `approveUpload` (line 132-159) calls `createPhotoAlbum` (line 161-170) which writes `db.list('photoAlbums').update(album.id, album)` with `listing = [upload.id]` and `urls = { download: url, icon: url }`. The album id is the upload id; no migration to /photoAlbums/{id}/photos/{photoId}.
- **`src/app/models/photo.ts:1-15`** — `Photo` class: id, dateAdded, path, extension, url, info, location, year, takenBy, uploadedBy, isYearCirca, isEditable, isMessageAttachment.
- **`src/app/models/media/photo-album.ts:1-42`** — `PhotoAlbum` class implementing `UploadableMedia`. 13 fields plus `listing: string[]`. Many fields are vestigial for our purposes (artist, folderName, fileName, format, etc.) because they were modeled after `AudioAlbum`/`Video` media types.
- **`src/app/models/media/media.ts:1-15`** — `UploadableMedia` interface. Defines the shape `PhotoAlbum` implements. We do not need to keep `PhotoAlbum` an `UploadableMedia` going forward.
- **`src/app/constants/media-constants.ts:21-73`** — `MediaConstants.PHOTO` (line 37-42), `MediaConstants.PHOTO_ALBUM` (line 51-56). Both used only by `MediaService`/`MediaExplorerComponent`. The new albums feature does **not** need to register with `MediaConstants`.
- **`src/app/app-routing.module.ts:57-62`** — `/photos` route: `AuthGuardService`, `FeatureFlagGuard`, `data: { featureId: 'photos' }`.
- **`src/app/services/feature-flags.service.ts:1-68`** — `FeatureFlagsService`. Reads `/features` from RTDB. Surfaces each flag via `flags$: Observable<{[id: string]: boolean}>`. The admin `/admin/features` page (`src/app/components/admin-features/admin-features.component.ts`) lists every flag returned by `getAllFeatureFlags()`. Adding `enablePhotoAlbums` to the default flag set in `feature-config.ts` makes it appear in the admin UI automatically.
- **`src/app/config/feature-config.ts:1-31`** — `FEATURES` constant. Currently declares `photos` (default true). We add `enablePhotoAlbums` (default false).
- **`src/app/components/admin-user-uploads/admin-user-uploads.component.ts:1-287`** — admin moderation page. The Approve button (`:91-93`) calls `userUploadService.approveUpload(upload)`. We will inject a new dialog-driven flow that prompts for an album before approving.
- **`src/app/components/photo-upload-progress/photo-upload-progress.component.ts:1-44`** — per-upload progress card. Magic 7-second `setTimeout` (line 37) before emitting completion.
- **`src/app/components/message-edit/message-edit.component.ts:189-219`** — chat/expression photo attachment. Calls `photosService.uploadPhoto(this.photoUpload, true)` which sets `isMessageAttachment = true`. The new system **leaves this flow alone**; chat photos continue to live at `/photos/{id}.{ext}` with `isMessageAttachment = true` and never receive an `albumId`.

### Existing prior art to reuse

- **`LightgalleryModule`** (`app.module.ts:25, 165`) is already imported but **not used** by the new design (we are replacing with PhotoSwipe). We keep the import to avoid breaking `PhotoAlbumComponent` (which we will keep rendering via `MediaExplorerComponent` but no longer rely on for the new feature). The import stays because `MediaExplorerComponent` (`:58`) still hosts `<app-photo-album>`, and `app-photo-album` still uses Lightgallery.
- **House BehaviorSubject pattern** — `src/app/services/clan.service.ts:9-18` (ClanService) is the canonical example for a service exposing `private source: BehaviorSubject<T[]>` + `public $: Observable<T[]> = source.asObservable()`.
- **House route-query-param pattern** — `src/app/components/people/people.component.ts:113-128` shows `queryParamsHandling: 'merge'` for stateful UI state. Used to open PhotoSwipe at a specific photo via `?photo=<id>`.

### Asymmetries and dead code we will fix in this spec

- `PhotosService.updatePhoto` write uncommented (or removed if we want the edit form to keep working — we keep it; uncomment).
- `PhotoAlbumComponent` left in place; it remains the `/media/explorer` lightbox view. We do not migrate it.
- `PhotoAlbum.listing` is replaced by `Photo.albumId` for the new feature. `PhotoAlbum` loses `listing` and the `UploadableMedia` heritage.
- `PhotosComponent.uploadPhotos` template file picker added (currently missing).
- `PhotosComponent.deletePhoto` splice bug fixed.
- `PhotoUploadProgressComponent`'s 7-second `setTimeout` replaced with an RTDB subscription that fires when `url` is non-empty.

## Goals

1. A user visiting `/photos` sees an album grid: cover photo, title, photo count. Click an album → see its photos in a grid with PhotoSwipe on click. Click "Slideshow" → full-screen Ken Burns.
2. The Ken Burns slideshow picks photos at random with no immediate repeats, applies a 1.00→1.08× zoom with ~8% pan in a random direction, and advances every N seconds (N configurable per album: 5/8/12/15; default 8). Controls: play/pause, prev/next, counter, exit.
3. Admins can create, rename, and delete albums inline on `/photos`. Admins can upload photos into an album via a file picker on the album detail page. Admin edit form persists `info`/`location`/`year`/`isYearCirca`/`takenBy` to RTDB.
4. Guest uploads (`/upload`) flow through `AdminUserUploadsComponent` Approve with a `MatDialog` that asks the admin to pick an existing album or create a new one.
5. The legacy `/photos/{id}` flat gallery remains reachable when the `enablePhotoAlbums` feature flag is OFF. Admins toggle the flag at `/admin/features` to switch between the new and legacy views.
6. Chat/expression message attachments continue to live at `/photos/{id}.{ext}` with `isMessageAttachment = true` and never receive an `albumId`. The `/photos` page never shows message attachments regardless of flag state.

## Non-Goals

1. No EXIF parsing or auto-population of `year`/`location`. Manual entry stays.
2. No thumbnail generation, no `srcset`/`sizes`. Photos load at full resolution with `loading="lazy"` + `decoding="async"` + explicit `width`/`height` to prevent CLS.
3. No lazy-loading of album metadata — the album list is small enough to subscribe once.
4. No profile photos, no event-photo foreign keys beyond albums.
5. No migration of legacy `/photos/{id}` data into the album structure. Legacy photos stay flat; they appear only when `enablePhotoAlbums` is OFF.
6. No `MediaExplorerComponent` changes. `PhotoAlbumComponent` continues to render the media-explorer album view using its existing (broken) lightgallery path. We are not in the business of fixing it in this spec.
7. No `JsonService` photo bulk-upload changes. Still commented out.
8. No realtime presence / multi-user slideshow. Slideshow is per-tab.

## Prerequisites

- `firebaseui-angular` configured in `src/app/auth.config.ts` (already in place).
- `@angular/material` 13 + `bootstrap` 5.3.8 + `MaterialModule` already centralized in `src/app/modules/material.module.ts`.
- `lightgallery` ^2.9.0 already in `package.json:46`; new spec adds `photoswipe` ^5.4 as a fresh dependency.
- `@angular/fire/compat` API in use throughout. New code follows the same compat imports.
- `feature-flags.service.ts` + `feature-flag-guard.service.ts` already in place.
- `AuthGuardService` + `AuthAdminGuardService` already in place.
- `RoutingService.NavigateTo*` methods already in place for programmatic nav.

## Design Principles

1. **Mirror existing service patterns.** New `PhotoAlbumsService` and extended `PhotosService` follow the BehaviorSubject + Observable + `private readonly X_PATH` shape of `ClanService` (`src/app/services/clan.service.ts:9-30`).
2. **Lean models.** `PhotoAlbum` keeps only id, title, coverPhotoId, createdAt, updatedAt. Drop `UploadableMedia` heritage; it is no longer needed for the new feature.
3. **Photo carries the FK.** `Photo.albumId` is the single source of truth for membership. Album listing = `db.list('/photos', ref => ref.orderByChild('albumId').equalTo(albumId))`.
4. **Route state is shareable.** `/photos/:albumId?photo=<id>` opens PhotoSwipe directly at photo `id` so users can deep-link.
5. **PhotoSwipe owns the lightbox, not us.** We do not write our own pinch-zoom, swipe, or close-on-ESC code. PhotoSwipeLightbox + PhotoSwipe (programmatic API) are wired via a service.
6. **Slideshow is a route, not a modal.** `/photos/:albumId/slideshow` is deep-linkable and survives reload.
7. **Lean into Angular Material + Bootstrap 5.** Use `mat-card`, `mat-icon-button`, `mat-form-field`, `matTooltip`, plus Bootstrap responsive grid (`col-12 col-md-6 col-lg-4` etc.). No new CSS framework.
8. **No lazy loading, no `loadChildren`.** Eager registration in `AppModule`, per house style.
9. **Clean up dead code as we go.** Uncomment `PhotosService.updatePhoto`'s write, fix `PhotosComponent.deletePhoto`'s splice, fix the 7-second `setTimeout` in `PhotoUploadProgressComponent`, add the missing file picker to `PhotosComponent`. These fixes are bundled with the migration, not deferred.
10. **Soft migration via feature flag.** Legacy `/photos/{id}` data is never deleted; it just becomes invisible when `enablePhotoAlbums` is ON.

## Front End Requirements

### 1. New Model: `PhotoAlbum` (lean)

**File**: `src/app/models/photo-album.ts` (replaces existing).

```ts
export interface PhotoAlbum {
  id: string;
  title: string;
  coverPhotoId: string | null;
  createdAt: number;
  updatedAt: number;
}
```

Notes:
- Drop `UploadableMedia` heritage. Drop `artist`, `date`, `folderName`, `fileName`, `isSticky`, `isHidden`, `listing`, `urls`, `type`, `format`, `dateUpdated`.
- Keep file at the same path (`src/app/models/photo-album.ts`) to avoid mass-rename churn. **Move** from `src/app/models/media/photo-album.ts` (delete the old file). Update imports in `media-explorer.component.ts` and `media.service.ts` if they referenced the old path.
- Delete the now-unused file `src/app/models/media/photo-album.ts`. `media.service.ts` and `media-explorer.component.ts` no longer reference it.

### 2. New Model: add `albumId` to `Photo`

**File**: `src/app/models/photo.ts` (extend).

```ts
export class Photo {
  id = '';
  dateAdded?: Date;
  path = '';
  extension = '';
  url = '';
  info = '';
  location = '';
  year = 0;
  takenBy = '';
  uploadedBy = '';
  isYearCirca = false;
  isEditable = false;
  isMessageAttachment = false;
  albumId: string | null = null;
}
```

- `albumId: string | null` is appended after the existing fields. Existing fields untouched.
- New `Photo` records default to `albumId = null` (= legacy). New uploads from `/photos/:albumId` set `albumId` to that album's id.

### 3. New Service: `PhotoAlbumsService`

**File**: `src/app/services/photo-albums.service.ts` (new).

```ts
import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { PhotoAlbum } from '../models/photo-album';

@Injectable({ providedIn: 'root' })
export class PhotoAlbumsService {
  private readonly PHOTO_ALBUMS_PATH = 'photoAlbums';
  private albumsSource: BehaviorSubject<PhotoAlbum[]> = new BehaviorSubject<PhotoAlbum[]>([]);
  public albums$: Observable<PhotoAlbum[]> = this.albumsSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.getAllAlbums().valueChanges().subscribe((albums: PhotoAlbum[]) => {
      this.albumsSource.next(albums);
    });
  }

  getAllAlbums(): AngularFireList<PhotoAlbum> {
    return this.db.list(this.PHOTO_ALBUMS_PATH);
  }

  getAlbum(id: string): Observable<PhotoAlbum | null> {
    return this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).valueChanges() as Observable<PhotoAlbum | null>;
  }

  async createAlbum(title: string): Promise<PhotoAlbum> {
    const id = this.db.createPushId();
    const now = Date.now();
    const album: PhotoAlbum = { id, title, coverPhotoId: null, createdAt: now, updatedAt: now };
    await this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).set(album);
    return album;
  }

  async updateAlbum(id: string, partial: Partial<PhotoAlbum>): Promise<void> {
    await this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).update({ ...partial, updatedAt: Date.now() });
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.db.object(`${this.PHOTO_ALBUMS_PATH}/${id}`).remove();
  }

  createPushId(): string {
    return this.db.createPushId();
  }
}
```

Method semantics:
- `createAlbum(title)` returns the created `PhotoAlbum` so callers can immediately bind to its id.
- `updateAlbum` always refreshes `updatedAt` — callers cannot set it manually.
- `deleteAlbum` does **not** cascade. Callers are responsible for moving photos first (see §5 deletion flow).

### 4. Extend `PhotosService` with album-aware reads/writes

**File**: `src/app/services/photos.service.ts` (extend).

Add methods (do not remove existing methods; legacy flows still need them):

```ts
private readonly PHOTOS_PATH = 'photos';

getPhotosByAlbum(albumId: string): Observable<Photo[]> {
  return this.db.list(this.PHOTOS_PATH, ref => ref.orderByChild('albumId').equalTo(albumId))
    .valueChanges() as Observable<Photo[]>;
}

getLoosePhotos(): Observable<Photo[]> {
  return this.db.list(this.PHOTOS_PATH, ref =>
    ref.orderByChild('albumId').equalTo(null)
  ).valueChanges() as Observable<Photo[]>;
}

async uploadPhotoToAlbum(photoUpload: PhotoUpload, albumId: string): Promise<PhotoUpload> {
  photoUpload.photo.albumId = albumId;
  return this.uploadImage(photoUpload);
}

async setPhotoAlbum(photoId: string, albumId: string | null): Promise<void> {
  await this.db.object(`${this.PHOTOS_PATH}/${photoId}`).update({ albumId });
}

async setAlbumCover(albumId: string, photoId: string | null): Promise<void> {
  await this.db.object(`${this.PHOTO_ALBUMS_PATH}/${albumId}`).update({ coverPhotoId: photoId, updatedAt: Date.now() });
}
```

Uncomment the existing `updatePhoto` write at `src/app/services/photos.service.ts:48-51`:

```ts
async updatePhoto(photo: Photo): Promise<void> {
  await this.db.object(`${this.PHOTOS_PATH}/${photo.id}`).update({
    info: photo.info,
    location: photo.location,
    year: photo.year,
    isYearCirca: photo.isYearCirca,
    takenBy: photo.takenBy,
  });
}
```

Write only the user-editable fields; do not let RTDB overwrite `albumId`/`uploadedBy`/`url`/`path`.

Add a getter exposing a `BehaviorSubject<Photo[]>` that filters out message attachments (used by the new shell):

```ts
private nonMessagePhotosSource = new BehaviorSubject<Photo[]>([]);
public nonMessagePhotos$: Observable<Photo[]> = this.nonMessagePhotosSource.asObservable();
```

In the constructor, after the existing subscribe, derive non-message photos:

```ts
this.getAllPhotos().valueChanges().subscribe((photos: Photo[]) => {
  this.allPhotos = photos;
  this.nonMessagePhotosSource.next(photos.filter(p => !p.isMessageAttachment));
});
```

### 5. New Component: `PhotoAlbumsComponent` (album grid)

**Files**:
- `src/app/components/photo-albums/photo-albums.component.ts`
- `src/app/components/photo-albums/photo-albums.component.html`
- `src/app/components/photo-albums/photo-albums.component.scss`

Selector: `app-photo-albums`.

Inputs/Outputs: none. Route-only component (rendered by `PhotoShellComponent`).

State:
- `albums: PhotoAlbum[] = []` (subscribed from `PhotoAlbumsService.albums$`)
- `photos: Photo[] = []` (subscribed from `PhotosService.nonMessagePhotos$` — used to compute photo counts and resolve `coverPhotoId`)
- `searchTerm: string = ''`
- `sortType: 'recent' | 'title' = 'recent'`
- `coverUrls: { [albumId: string]: string | null } = {}`
- `subscription: Subscription | null = null`

Methods:
- `ngOnInit`: subscribes to `albums$` and `nonMessagePhotos$`. On every emission, recomputes `coverUrls` (see below).
- `resolveCover(album: PhotoAlbum): string | null` — pure helper. Returns `album.coverPhotoId`'s photo `url` if found in `photos`; otherwise returns the first photo's `url` where `photo.albumId === album.id`; otherwise `null`.
- `getPhotoCount(album: PhotoAlbum): number` — pure helper.
- `getFilteredAlbums(): PhotoAlbum[]` — applies `searchTerm` (case-insensitive title match) + sort.
- `onCreateAlbum()`: opens `PhotoAlbumEditDialog` with `album: null` for create.
- `onEditAlbum(album)`: opens `PhotoAlbumEditDialog` with `album` for edit.
- `onDeleteAlbum(album)`: opens `MatDialog` confirm with body "Delete album '{title}' and its {N} photos? This cannot be undone." On confirm: cascade-deletes all photos in album (multi-path `db.object('/').update({ [photoPath1]: null, [photoPath2]: null, ... })`), then `photoAlbumsService.deleteAlbum(id)`.
- `onAlbumClick(album)`: navigates to `/photos/${album.id}`.
- `isAdmin(): boolean` — returns `this.user?.roles?.admin === true`.
- `ngOnDestroy`: `subscription?.unsubscribe()`.

Template outline:
```html
<app-page-toolbar title="Photo Albums">
  <mat-form-field>
    <input matInput placeholder="Search albums" [(ngModel)]="searchTerm" />
  </mat-form-field>
  <button mat-button [matMenuTriggerFor]="sortMenu">
    Sort: {{ sortType === 'recent' ? 'Recent' : 'Title' }}
  </button>
  <mat-menu #sortMenu>
    <button mat-menu-item (click)="sortType='recent'">Recent</button>
    <button mat-menu-item (click)="sortType='title'">Title (A–Z)</button>
  </mat-menu>
  <button *ngIf="isAdmin()" mat-raised-button color="primary" (click)="onCreateAlbum()">
    <mat-icon>add</mat-icon> New Album
  </button>
</app-page-toolbar>

<div class="album-grid container-fluid">
  <mat-card *ngFor="let album of getFilteredAlbums()"
            class="album-card mat-elevation-z6 col-12 col-sm-6 col-md-4 col-lg-3"
            (click)="onAlbumClick(album)">
    <div class="album-cover">
      <img *ngIf="resolveCover(album); else placeholder"
           [src]="resolveCover(album)"
           [alt]="album.title"
           loading="lazy" decoding="async"
           width="400" height="400" />
      <ng-template #placeholder>
        <mat-icon class="album-cover-placeholder">photo_library</mat-icon>
      </ng-template>
    </div>
    <mat-card-content>
      <div class="album-title">{{ album.title }}</div>
      <div class="album-count">{{ getPhotoCount(album) }} photos</div>
    </mat-card-content>
    <mat-card-actions *ngIf="isAdmin()" (click)="$event.stopPropagation()">
      <button mat-icon-button matTooltip="Edit" (click)="onEditAlbum(album)">
        <mat-icon>edit</mat-icon>
      </button>
      <button mat-icon-button matTooltip="Delete" (click)="onDeleteAlbum(album)">
        <mat-icon>delete</mat-icon>
      </button>
    </mat-card-actions>
  </mat-card>
  <app-no-results-message *ngIf="getFilteredAlbums().length === 0" searchTerm="{{ searchTerm }}" />
</div>
```

SCSS:
- `.album-grid` uses Bootstrap container + row gutters.
- `.album-cover` is a square `aspect-ratio: 1 / 1` with `overflow: hidden`. The `<img>` uses `object-fit: cover; width: 100%; height: 100%`.
- `.album-cover-placeholder` is centered, large (`font-size: 64px; width: 64px; height: 64px; color: var(--color-brand-primary);`).
- Hover state: `.album-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.2); }` with `transition: transform 200ms, box-shadow 200ms;`.
- `.album-card` has `cursor: pointer`.

### 6. New Component: `PhotoAlbumDetailComponent` (photo grid for one album)

**Files**:
- `src/app/components/photo-album-detail/photo-album-detail.component.ts`
- `src/app/components/photo-album-detail/photo-album-detail.component.html`
- `src/app/components/photo-album-detail/photo-album-detail.component.scss`

Selector: `app-photo-album-detail`.

Inputs/Outputs: none. Route-only.

Route data:
- `route.snapshot.paramMap.get('albumId')` → `albumId: string`.
- `route.queryParamMap.get('photo')` → `?photo=<id>` opens PhotoSwipe at that photo on load.

State:
- `albumId: string = ''`
- `album: PhotoAlbum | null = null` (subscribed from `PhotoAlbumsService.getAlbum(albumId)`)
- `photos: Photo[] = []` (subscribed from `PhotosService.getPhotosByAlbum(albumId)`)
- `searchTerm: string = ''`
- `sortType: 'recent' | 'yearTaken' = 'recent'`
- `showSpinner: boolean = true`
- `editingPhotoId: string | null = null`
- `editDraft: Photo | null = null` (deep-copied photo being edited)
- `photoUpload: PhotoUpload | null = null`
- `subscriptions: Subscription[] = []`

Methods:
- `ngOnInit`: subscribe to `album$` and `photos$`; on photos emit, `showSpinner = false`; if `?photo=<id>` in query params, call `openPhotoSwipe(<id>)` after a short delay (next tick) to allow view init.
- `getFilteredPhotos(): Photo[]` — applies `searchTerm` (substring on info/location/year/takenBy) + sort.
- `openPhotoSwipe(photoId: string)`: find photo index, call `photoswipeService.open(photos, index)`.
- `onPhotoClick(photo: Photo)`: navigate to `?photo=<photo.id>` via `routingService.updateQueryParams({ photo: photo.id })`. Then `openPhotoSwipe(photo.id)`.
- `onStartSlideshow()`: navigate to `/photos/${albumId}/slideshow`.
- `onUploadPhotos(fileList: FileList)`: for each file, call `photosService.uploadPhotoToAlbum(photoUpload, albumId)`. Track progress in `photoUploads: PhotoUpload[]`.
- `completePhotoUpload(upload: PhotoUpload)`: removes from `photoUploads` after the photo appears in `photos`.
- `onEditPhoto(photo)`: deep-copy into `editDraft`, set `editingPhotoId = photo.id`.
- `onSavePhoto()`: `photosService.updatePhoto(editDraft).then(...)`; clear editing state.
- `onCancelEdit()`: clear editing state.
- `onDeletePhoto(photo)`: confirm dialog → `photosService.deletePhoto(photo)` → `photoAlbumsService.updateAlbum(albumId, {})` to bump `updatedAt`.
- `onSetAsCover(photo)`: `photoAlbumsService.setAlbumCover(albumId, photo.id)`.
- `isAdmin(): boolean`.
- `ngOnDestroy`: `subscriptions.forEach(s => s.unsubscribe())`.

Template outline:
```html
<app-page-toolbar [title]="album?.title || 'Album'">
  <button mat-icon-button routerLink="/photos" matTooltip="Back to albums">
    <mat-icon>arrow_back</mat-icon>
  </button>
  <button mat-raised-button color="primary"
          [disabled]="photos.length === 0"
          (click)="onStartSlideshow()">
    <mat-icon>play_arrow</mat-icon> Slideshow
  </button>
  <mat-form-field>
    <input matInput placeholder="Search photos" [(ngModel)]="searchTerm" />
  </mat-form-field>
  <button *ngIf="isAdmin()" mat-stroked-button>
    <label>
      <mat-icon>add_photo_alternate</mat-icon> Add Photos
      <input type="file" accept="image/*" multiple hidden
             (change)="onUploadPhotos($event.target.files)" />
    </label>
  </button>
</app-page-toolbar>

<app-photo-upload-progress *ngFor="let upload of photoUploads"
                           [upload]="upload"
                           (completeUploadEvent)="completePhotoUpload($event)" />

<div class="photo-grid container-fluid" *ngIf="!showSpinner; else loadingTpl">
  <mat-card *ngFor="let photo of getFilteredPhotos()"
            class="photo-card mat-elevation-z6 col-12 col-sm-6 col-md-4 col-lg-3"
            (click)="onPhotoClick(photo)">
    <div class="photo-card-image-wrap">
      <img mat-card-image [src]="photo.url" [alt]="photo.info || 'Photo'"
           loading="lazy" decoding="async"
           width="400" height="400" />
    </div>
    <mat-card-content *ngIf="!isEditing(photo)">
      <div class="photo-taken-by" *ngIf="photo.takenBy">{{ photo.takenBy }}</div>
      <div class="photo-info">{{ photo.info }}</div>
      <div class="photo-location" *ngIf="photo.location">{{ photo.location }}</div>
      <div class="photo-year">{{ photo.isYearCirca ? 'c. ' : '' }}{{ photo.year }}</div>
    </mat-card-content>
    <mat-card-content *ngIf="isEditing(photo)">
      <mat-form-field>
        <input matInput placeholder="Caption (info)" [(ngModel)]="editDraft.info" />
      </mat-form-field>
      <mat-form-field>
        <input matInput placeholder="Location" [(ngModel)]="editDraft.location" />
      </mat-form-field>
      <mat-form-field>
        <input matInput type="number" placeholder="Year" [(ngModel)]="editDraft.year" />
      </mat-form-field>
      <mat-checkbox [(ngModel)]="editDraft.isYearCirca">Year is circa</mat-checkbox>
      <mat-form-field>
        <input matInput placeholder="Taken by" [(ngModel)]="editDraft.takenBy" />
      </mat-form-field>
    </mat-card-content>
    <mat-card-actions *ngIf="isAdmin()" (click)="$event.stopPropagation()">
      <button mat-icon-button matTooltip="Edit" *ngIf="!isEditing(photo)"
              (click)="onEditPhoto(photo)"><mat-icon>edit</mat-icon></button>
      <button mat-icon-button matTooltip="Save" *ngIf="isEditing(photo)"
              (click)="onSavePhoto()"><mat-icon>save</mat-icon></button>
      <button mat-icon-button matTooltip="Cancel" *ngIf="isEditing(photo)"
              (click)="onCancelEdit()"><mat-icon>cancel</mat-icon></button>
      <button mat-icon-button matTooltip="Set as cover"
              *ngIf="!isEditing(photo) && album?.coverPhotoId !== photo.id"
              (click)="onSetAsCover(photo)"><mat-icon>star</mat-icon></button>
      <button mat-icon-button matTooltip="Delete" *ngIf="!isEditing(photo)"
              (click)="onDeletePhoto(photo)"><mat-icon>delete</mat-icon></button>
      <a mat-icon-button matTooltip="Download" [href]="photo.url" [download]="photo.path" target="_blank">
        <mat-icon>cloud_download</mat-icon>
      </a>
    </mat-card-actions>
  </mat-card>
  <app-no-results-message *ngIf="getFilteredPhotos().length === 0" searchTerm="{{ searchTerm }}" />
</div>
<ng-template #loadingTpl>
  <div class="photos-skeleton-grid container-fluid">
    <div *ngFor="let _ of skeletonIterations" class="photos-skeleton-card col-12 col-sm-6 col-md-4 col-lg-3">
      <div class="skeleton-photo-image shimmer"></div>
      <div class="skeleton-photo-line shimmer"></div>
      <div class="skeleton-photo-line short shimmer"></div>
    </div>
  </div>
</ng-template>

<div class="pswp-gallery" [id]="'gallery-' + albumId" style="display: none;">
  <a *ngFor="let photo of photos; let i = index"
     [href]="photo.url"
     [attr.data-pswp-width]="1600"
     [attr.data-pswp-height]="1600"
     [attr.data-cropped]="true"
     target="_blank" rel="noopener">
    <img [src]="photo.url" [alt]="photo.info || ''" />
  </a>
</div>
```

SCSS:
- Reuse the `.photo-card`, `.photo-image`, `.photo-taken-by`, `.photo-info`, `.photo-location`, `.photo-year`, `.photo-edit-field`, `.photos-skeleton-grid`, `.skeleton-photo-line`, `.shimmer` rules from `src/app/components/photos/photos.component.scss:84-322` (copy or `@import` selectively).
- `.photo-card-image-wrap` is `aspect-ratio: 1 / 1; overflow: hidden;`. The `<img>` is `width: 100%; height: 100%; object-fit: cover;`.
- Hover: `.photo-card { cursor: pointer; transition: transform 200ms; } .photo-card:hover { transform: scale(1.02); }`.

### 7. New Service: `PhotoswipeService` (programmatic PhotoSwipe integration)

**File**: `src/app/services/photoswipe.service.ts` (new).

```ts
import { Injectable } from '@angular/core';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import PhotoSwipe from 'photoswipe';
import { Photo } from '../models/photo';

@Injectable({ providedIn: 'root' })
export class PhotoswipeService {
  private lightbox: PhotoSwipeLightbox | null = null;

  initForGallery(gallerySelector: string): void {
    if (this.lightbox) {
      this.lightbox.destroy();
    }
    this.lightbox = new PhotoSwipeLightbox({
      gallery: gallerySelector,
      children: 'a',
      pswpModule: PhotoSwipe,
      bgOpacity: 0.95,
      showHideAnimationType: 'fade',
      padding: { top: 20, bottom: 40, left: 20, right: 20 },
    });
    this.lightbox.init();
  }

  openAtIndex(index: number): void {
    this.lightbox?.loadAndOpen(index);
  }

  destroy(): void {
    this.lightbox?.destroy();
    this.lightbox = null;
  }
}
```

Wired in `PhotoAlbumDetailComponent.ngAfterViewInit`:
```ts
this.photoswipeService.initForGallery('#gallery-' + this.albumId);
```
and called from `onPhotoClick`:
```ts
this.photoswipeService.openAtIndex(index);
```

### 8. New Component: `PhotoSlideshowComponent` (Ken Burns full-screen)

**Files**:
- `src/app/components/photo-slideshow/photo-slideshow.component.ts`
- `src/app/components/photo-slideshow/photo-slideshow.component.html`
- `src/app/components/photo-slideshow/photo-slideshow.component.scss`

Selector: `app-photo-slideshow`.

State:
- `albumId: string = ''` (from route param)
- `photos: Photo[] = []` (subscribed from `PhotosService.getPhotosByAlbum(albumId)`)
- `shuffled: Photo[] = []` (shuffled once when photos arrive)
- `currentIndex: number = 0`
- `slideDurationMs: number = 8000` (configurable per album via `?duration=5|8|12|15`; default 8)
- `isPlaying: boolean = true`
- `kenBurnsClass: string = ''` (one of `kenburns-tl-br`, `kenburns-tr-bl`, `kenburns-bl-tr`, `kenburns-br-tl`)
- `intervalHandle: any = null`
- `subscriptions: Subscription[] = []`
- `@HostListener('window:keydown')` for ESC and Space.

Lifecycle:
- `ngOnInit`: subscribe to `photos$`. On emission, call `restart()`.
- `restart()`: shuffle `photos` via Fisher-Yates; `currentIndex = 0`; `isPlaying = true`; `pickNext()`.
- `pickNext()`: increments `currentIndex`, wrapping with `currentIndex % shuffled.length`. Calls `applyKenBurns()`. Re-arms the interval.
- `applyKenBurns()`: random pick from the four Ken Burns class names.
- `startInterval()`: `clearInterval` if any; `intervalHandle = setInterval(() => this.pickNext(), this.slideDurationMs)`.
- `pause()` / `togglePlay()`: clear/set interval.
- `next()` / `prev()`: manual nav.
- `exit()`: `routingService.NavigateToPhotoAlbum(albumId)` (helper to be added to `RoutingService`).
- `onKeydown(event: KeyboardEvent)`:
  - `Escape`: `exit()`.
  - `Space`: `event.preventDefault(); togglePlay();`.
  - `ArrowRight`: `next()`.
  - `ArrowLeft`: `prev()`.
- `ngOnDestroy`: clear interval; unsubscribe.

Template (`photo-slideshow.component.html`):
```html
<div class="slideshow-stage" [class.paused]="!isPlaying">
  <img *ngIf="currentPhoto()"
       class="slideshow-image"
       [class]="kenBurnsClass"
       [src]="currentPhoto().url"
       [alt]="currentPhoto().info || ''"
       [style.animationDuration.ms]="slideDurationMs" />

  <div class="slideshow-controls">
    <button mat-icon-button (click)="prev()" matTooltip="Previous">
      <mat-icon>skip_previous</mat-icon>
    </button>
    <button mat-icon-button (click)="togglePlay()" matTooltip="Play / Pause">
      <mat-icon>{{ isPlaying ? 'pause' : 'play_arrow' }}</mat-icon>
    </button>
    <button mat-icon-button (click)="next()" matTooltip="Next">
      <mat-icon>skip_next</mat-icon>
    </button>
    <span class="slideshow-counter">{{ currentIndex + 1 }} / {{ shuffled.length }}</span>
    <button mat-icon-button (click)="exit()" matTooltip="Exit (Esc)">
      <mat-icon>close</mat-icon>
    </button>
  </div>
</div>
```

SCSS (`photo-slideshow.component.scss`):
```scss
:host {
  display: block;
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 1000;
}

.slideshow-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.slideshow-image {
  width: 100vw;
  height: 100vh;
  object-fit: cover;
  animation-fill-mode: forwards;
  animation-iteration-count: 1;
  animation-timing-function: ease-in-out;
}

@keyframes kenburns-tl-br {
  from { transform: scale(1) translate(0, 0); }
  to { transform: scale(1.08) translate(-4%, -4%); }
}
@keyframes kenburns-tr-bl {
  from { transform: scale(1) translate(0, 0); }
  to { transform: scale(1.08) translate(4%, -4%); }
}
@keyframes kenburns-bl-tr {
  from { transform: scale(1) translate(0, 0); }
  to { transform: scale(1.08) translate(-4%, 4%); }
}
@keyframes kenburns-br-tl {
  from { transform: scale(1) translate(0, 0); }
  to { transform: scale(1.08) translate(4%, 4%); }
}

.slideshow-controls {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 24px;
  color: white;

  button { color: white; }
}

.slideshow-counter {
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  min-width: 60px;
  text-align: center;
}
```

### 9. New Component: `PhotoAlbumEditDialogComponent` (MatDialog for create/edit album)

**Files**:
- `src/app/components/photo-album-edit-dialog/photo-album-edit-dialog.component.{ts,html,scss}`

Selector: `app-photo-album-edit-dialog`.

Inputs (via `MAT_DIALOG_DATA`):
```ts
interface PhotoAlbumEditDialogData {
  album: PhotoAlbum | null;  // null = create mode
}
```

Returns (via `MatDialogRef.close`):
```ts
type PhotoAlbumEditDialogResult =
  | { action: 'save'; title: string }
  | { action: 'cancel' }
  | undefined; // dialog dismissed by backdrop
```

Template:
```html
<h2 mat-dialog-title>{{ data.album ? 'Edit Album' : 'New Album' }}</h2>
<mat-dialog-content>
  <mat-form-field appearance="fill">
    <mat-label>Album title</mat-label>
    <input matInput [(ngModel)]="title" required maxlength="80" />
  </mat-form-field>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="onCancel()">Cancel</button>
  <button mat-raised-button color="primary" [disabled]="!title.trim()" (click)="onSave()">
    {{ data.album ? 'Save' : 'Create' }}
  </button>
</mat-dialog-actions>
```

### 10. New Component: `PhotoShellComponent` (route-level flag dispatcher)

**Files**:
- `src/app/components/photo-shell/photo-shell.component.{ts,html,scss}`

Selector: `app-photo-shell`.

State:
- `enablePhotoAlbums: boolean = false`
- `subscription: Subscription | null = null`

Methods:
- `ngOnInit`: subscribe to `featureFlagsService.flags$`. Map `flags['enablePhotoAlbums']` → `enablePhotoAlbums`.
- `ngOnDestroy`: unsubscribe.

Template:
```html
<app-photo-albums *ngIf="enablePhotoAlbums; else legacy"></app-photo-albums>
<ng-template #legacy>
  <app-photos-legacy></app-photos-legacy>
</ng-template>
```

### 11. Refactor: rename `PhotosComponent` → `PhotosLegacyComponent`

**Files renamed**:
- `src/app/components/photos/photos.component.{ts,html,scss}` → `src/app/components/photos-legacy/photos-legacy.component.{ts,html,scss}`

Selector changes:
- `app-photos` → `app-photos-legacy`
- Class name: `PhotosComponent` → `PhotosLegacyComponent`

Other changes (in addition to the rename):
- **Add the missing file picker** in the legacy template at the bottom of the toolbar:
  ```html
  <button *ngIf="isAdmin()" mat-stroked-button>
    <label>
      <mat-icon>add_photo_alternate</mat-icon> Add Photos
      <input type="file" accept="image/*" multiple hidden
             (change)="onUploadPhotos($event.target.files)" />
    </label>
  </button>
  ```
- **Fix the `deletePhoto` splice bug** at `src/app/components/photos/photos.component.ts:113-122`:
  ```ts
  deletePhoto(photo: Photo): void {
    this.photosService.deletePhoto(photo);
    const idx = this.loadedPhotos.findIndex(p => p.id === photo.id);
    if (idx >= 0) {
      this.loadedPhotos.splice(idx, 1);
      this.allPhotos = this.allPhotos.filter(p => p.id !== photo.id);
    }
  }
  ```
- The `updatePhoto` write uncomment in `PhotosService` (see §4) makes the Edit form persist.

### 12. Refactor: `PhotoUploadProgressComponent` — replace 7-second `setTimeout`

**File**: `src/app/components/photo-upload-progress/photo-upload-progress.component.ts`.

Replace the body of `ngOnInit` (line 24-43) with an actual subscription to `upload.task.snapshotChanges()` that emits when the download URL is available:

```ts
ngOnInit(): void {
  this.upload.task.snapshotChanges().pipe(
    finalize(() => {
      if (this.upload.photo.url) {
        this.completeUploadEvent.emit(this.upload.photo);
      }
    })
  ).subscribe();
}
```

We rely on `PhotosService.uploadImage` to populate `upload.photo.url` inside its own `finalize` callback (which it already does at `photos.service.ts:104-115`).

### 13. Modify `AdminUserUploadsComponent` to use album-picker dialog on approve

**File**: `src/app/components/admin-user-uploads/admin-user-uploads.component.ts`.

Replace the existing `onApprove(upload: UserUpload)` (`:91-93`) with:

```ts
async onApprove(upload: UserUpload): Promise<void> {
  const dialogRef = this.dialog.open(PhotoAlbumPickerDialogComponent, {
    data: {
      suggestedTitle: upload.eventName || 'Untitled Album',
      albums: this.allAlbums, // subscribed from PhotoAlbumsService.albums$
    },
    width: '480px',
  });
  const result = await firstValueFrom(dialogRef.afterClosed());
  if (!result) return;
  let albumId: string;
  if (result.action === 'use-existing') {
    albumId = result.albumId;
  } else {
    const created = await this.photoAlbumsService.createAlbum(result.title);
    albumId = created.id;
  }
  this.processingIds.add(upload.id);
  try {
    await this.userUploadService.approveUploadToAlbum(upload, albumId);
  } finally {
    this.processingIds.delete(upload.id);
  }
}
```

Add a new private subscription to `photoAlbumsService.albums$` to populate `allAlbums`.

### 14. New Component: `PhotoAlbumPickerDialogComponent` (MatDialog for admin approval)

**Files**:
- `src/app/components/photo-album-picker-dialog/photo-album-picker-dialog.component.{ts,html,scss}`

Inputs (`MAT_DIALOG_DATA`):
```ts
interface PhotoAlbumPickerDialogData {
  suggestedTitle: string;
  albums: PhotoAlbum[];
}
```

Returns:
```ts
type PhotoAlbumPickerDialogResult =
  | { action: 'use-existing'; albumId: string }
  | { action: 'create-new'; title: string }
  | undefined;
```

Template:
```html
<h2 mat-dialog-title>Add photo to album</h2>
<mat-dialog-content>
  <mat-radio-group [(ngModel)]="mode">
    <mat-radio-button value="existing">Use existing album</mat-radio-button>
    <mat-form-field *ngIf="mode === 'existing'">
      <mat-select [(ngModel)]="selectedAlbumId">
        <mat-option *ngFor="let album of data.albums" [value]="album.id">
          {{ album.title }}
        </mat-option>
      </mat-select>
    </mat-form-field>
    <mat-radio-button value="new">Create new album</mat-radio-button>
    <mat-form-field *ngIf="mode === 'new'">
      <input matInput [(ngModel)]="newTitle" placeholder="Album title" maxlength="80" />
    </mat-form-field>
  </mat-radio-group>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="onCancel()">Cancel</button>
  <button mat-raised-button color="primary" [disabled]="!isValid()" (click)="onConfirm()">Approve & Add</button>
</mat-dialog-actions>
```

Default state: `mode = 'new'`, `newTitle = data.suggestedTitle`.

### 15. Extend `UserUploadService` with `approveUploadToAlbum`

**File**: `src/app/services/user-upload.service.ts`.

Add:
```ts
async approveUploadToAlbum(upload: UserUpload, albumId: string): Promise<void> {
  const photoId = this.db.createPushId();
  const extension = upload.fileName?.split('.').pop() || 'jpg';
  const newPath = `photos/${albumId}/${upload.fileName}`;
  const sourceRef = upload.url
    ? this.storage.storage.refFromURL(upload.url)
    : this.storage.storage.ref(upload.path);
  const destRef = this.storage.storage.ref(newPath);
  await sourceRef.copyTo(destRef);
  await sourceRef.delete();
  const downloadUrl = await destRef.getDownloadURL();
  const photo: Photo = {
    id: photoId,
    dateAdded: new Date(),
    path: newPath,
    extension,
    url: downloadUrl,
    info: '',
    location: '',
    year: 0,
    takenBy: '',
    uploadedBy: upload.uploader?.anonymousId || 'anonymous',
    isYearCirca: false,
    isEditable: false,
    isMessageAttachment: false,
    albumId,
  };
  await this.db.object(`photos/${photoId}`).set(photo);
  await this.db.object(`userUploads/${upload.id}`).update({
    status: 'approved',
    path: newPath,
    url: downloadUrl,
  });
  await this.photoAlbumsService.updateAlbum(albumId, {});
}
```

Remove the now-unused `createPhotoAlbum()` private method (`:161-170`) and the `PhotoAlbum` import. Leave `UserUploadService`'s existing `approveUpload()` in place for backward compatibility but mark it `@deprecated`; new callers go through `approveUploadToAlbum`.

### 16. Update `RoutingService` with slideshow navigation helper

**File**: `src/app/services/routing.service.ts`.

Add:
```ts
NavigateToPhotoAlbum(albumId: string): void {
  this.router.navigate(['/photos', albumId]);
}

NavigateToPhotoSlideshow(albumId: string, durationSec?: number): void {
  const queryParams = durationSec ? { duration: durationSec } : {};
  this.router.navigate(['/photos', albumId, 'slideshow'], { queryParams });
}
```

### 17. Routing changes

**File**: `src/app/app-routing.module.ts`.

Replace the `/photos` block (lines 57-62) and add `/photos/:albumId` and `/photos/:albumId/slideshow`:

```ts
{
  path: 'photos',
  component: PhotoShellComponent,
  canActivate: [AuthGuardService, FeatureFlagGuard],
  data: { featureId: 'photos' },
},
{
  path: 'photos/:albumId',
  component: PhotoAlbumDetailComponent,
  canActivate: [AuthGuardService, FeatureFlagGuard],
  data: { featureId: 'photos' },
},
{
  path: 'photos/:albumId/slideshow',
  component: PhotoSlideshowComponent,
  canActivate: [AuthGuardService, FeatureFlagGuard],
  data: { featureId: 'photos' },
},
```

The slideshow route is gated by the same `photos` feature flag (not `enablePhotoAlbums`) — if `photos` is OFF, the entire route subtree is unreachable. The new flag only affects which view `/photos` renders.

### 18. AppModule declarations and imports

**File**: `src/app/app.module.ts`.

Add to declarations:
- `PhotoShellComponent`
- `PhotoAlbumsComponent`
- `PhotoAlbumDetailComponent`
- `PhotoSlideshowComponent`
- `PhotoAlbumEditDialogComponent`
- `PhotoAlbumPickerDialogComponent`
- `PhotosLegacyComponent` (renamed from `PhotosComponent`)
- Remove `PhotosComponent` declaration.

`MatDialogModule` is already exported from `MaterialModule` (line 19 of `src/app/modules/material.module.ts`).

### 19. Feature flag registration

**File**: `src/app/config/feature-config.ts`.

Add to `FEATURES`:
```ts
enablePhotoAlbums: false, // when ON, /photos shows the new album grid; OFF = legacy gallery
```

No additional `feature-config.ts` work is needed beyond this line — `AdminFeaturesComponent` lists every key from this map automatically.

### 20. PhotoSwipe CSS import

**File**: `src/styles.scss`.

Add at the bottom (after the existing lightgallery imports):
```scss
@import "~photoswipe/dist/photoswipe.css";
```

### 21. Package dependency

**File**: `package.json`.

Add to `dependencies`:
```json
"photoswipe": "^5.4.0"
```

### 22. Delete the unused old model

**File**: `src/app/models/media/photo-album.ts` — delete.

Update imports:
- `src/app/services/media.service.ts` — remove any reference to `PhotoAlbum` from `/media/photo-album`. Search and replace with the new `src/app/models/photo-album` import path if any logic still references it.
- `src/app/components/media-explorer/media-explorer.component.ts` — the `<app-photo-album>` element still exists and works (the inner broken state is unchanged from this spec). The `selectedMedia.type === 'photo-album'` check should continue to work because `MediaConstants.PHOTO_ALBUM.id` is unchanged.

### 23. RxJS stream design summary

| Stream | Producer | Consumer | Cleanup |
|---|---|---|---|
| `PhotoAlbumsService.albums$` | `db.list('photoAlbums').valueChanges()` | `PhotoAlbumsComponent.ngOnInit` | `ngOnDestroy` |
| `PhotosService.nonMessagePhotos$` | filter on `getAllPhotos()` | `PhotoAlbumsComponent.ngOnInit` (for counts + cover resolution) | `ngOnDestroy` |
| `PhotosService.getPhotosByAlbum(albumId)` | `db.list('/photos', orderByChild('albumId').equalTo(albumId))` | `PhotoAlbumDetailComponent.ngOnInit` + `PhotoSlideshowComponent.ngOnInit` | `ngOnDestroy` |
| `featureFlagsService.flags$` | `db.object('features').valueChanges()` | `PhotoShellComponent.ngOnInit` | `ngOnDestroy` |
| `photoUpload.task.snapshotChanges()` | Firebase upload task | `PhotoUploadProgressComponent.ngOnInit` (finalize emits completion) | handled by `takeUntil` finalize |

No manual subscriptions in services (consistent with house style). All component-level subs are cleaned up in `ngOnDestroy`.

### 24. Analytics events

Add to `AnalyticsService.logEvent` calls (using existing pattern at `photos.component.ts:60, 93, 102, 131, 155, 180, 194, 243, 252`):
- `photo_album_view` — fired on `PhotoAlbumsComponent.ngOnInit`.
- `photo_album_open` — fired when user clicks an album card. Payload: `{ albumId }`.
- `photo_album_create` — fired after `photoAlbumsService.createAlbum` resolves. Payload: `{ albumId, title }`.
- `photo_album_delete` — fired after `photoAlbumsService.deleteAlbum` resolves. Payload: `{ albumId, photoCount }`.
- `photo_view` — fired when PhotoSwipe opens. Payload: `{ albumId, photoId, index }`.
- `photo_slideshow_start` — fired on `PhotoSlideshowComponent.ngOnInit`. Payload: `{ albumId, durationMs, photoCount }`.
- `photo_slideshow_exit` — fired in `exit()`. Payload: `{ albumId, photosViewed }`.
- `photo_admin_approve_with_album` — fired in `AdminUserUploadsComponent.onApprove`. Payload: `{ uploadId, albumId, mode: 'existing' | 'new' }`.

## Firebase Requirements

### RTDB paths

| Path | Writer | Reader | Type |
|---|---|---|---|
| `/photoAlbums/{albumId}` | `PhotoAlbumsService.createAlbum/updateAlbum/deleteAlbum` | `PhotoAlbumsService.getAlbum` | `PhotoAlbum` (lean) |
| `/photos/{photoId}` | `PhotosService.uploadImage` (sets `albumId` if provided); `UserUploadService.approveUploadToAlbum`; `PhotosService.updatePhoto` (now functional); `PhotosService.deletePhoto` | `PhotosService.getAllPhotos`, `getPhotosByAlbum`, `getLoosePhotos`, `getPhotoById` | `Photo` (extended with `albumId`) |
| `/userUploads/{uploadId}` | `UserUploadService.uploadFile`, `approveUploadToAlbum` (status update) | `AdminUserUploadsComponent` | `UserUpload` (unchanged) |
| `/features/photos` | (existing) | (existing) | `boolean` |
| `/features/enablePhotoAlbums` | `AdminFeaturesComponent` (admin toggle) | `PhotoShellComponent` | `boolean` |

### Storage paths

| Path | Writer | Reader |
|---|---|---|
| `photos/{photoId}.{ext}` | `PhotosService.uploadImage` (legacy, when `albumId` is null) | (existing consumers) |
| `photos/{albumId}/{fileName}` | `UserUploadService.approveUploadToAlbum` | (new) |
| `userUploads/{folderName}/{fileName}` | `UserUploadService.uploadFile` | `AdminUserUploadsComponent` |

No changes to storage path conventions. New `photos/{albumId}/` prefix is intentional: groups approved guest-upload files under their album id so admins can browse them via the existing Storage Browser (`/admin/uploads` → Storage tab).

### Security rules

The existing rules (per `design_specs/user-upload-ads.md:336-357` and `admin-user-uploads-storage-browser.md:702-724`) cover `/photos`, `/photoAlbums`, and `/userUploads`. The new spec does **not** require rule changes — `/photos` and `/photoAlbums` already use `auth != null` for writes. **However**, the new spec removes the `UploadableMedia` heritage of `PhotoAlbum` and the `PhotoAlbum.listing` array, which `MediaService` may still attempt to read. Verify and update `MediaService` (`src/app/services/media.service.ts:91-99`) to handle the lean shape gracefully (no `listing` field) — the existing `MediaExplorerComponent` reading path should not throw on the new shape.

Recommended RTDB rules (paste into Firebase Console):
```json
{
  "rules": {
    "photoAlbums": {
      ".read": true,
      ".write": "auth != null",
      "$albumId": {
        ".validate": "newData.hasChildren(['id', 'title', 'createdAt', 'updatedAt'])",
        "title":     { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length < 81" },
        "createdAt": { ".validate": "newData.isNumber()" },
        "updatedAt": { ".validate": "newData.isNumber()" },
        "coverPhotoId": { ".validate": "newData.val() === null || newData.isString()" },
        "id":        { ".validate": "newData.val() === newData.parent().key" }
      }
    },
    "photos": {
      ".read": true,
      "$photoId": {
        ".write": "auth != null",
        "albumId": { ".validate": "newData.val() === null || newData.isString()" },
        "isMessageAttachment": { ".validate": "newData.isBoolean()" }
      }
    },
    "userUploads": { ".read": true, ".write": true },
    "features":    { ".read": true, ".write": "auth != null" }
  }
}
```

Storage rules (no change from `admin-user-uploads-storage-browser.md`):
```
match /photos/{allPaths}         { read: true; write: if request.auth != null; }
match /userUploads/{allPaths}    { read: true; write: if request.auth != null; }
```

### Auth context

- All new routes under `/photos/*` are gated by `AuthGuardService` + `FeatureFlagGuard('photos')`.
- No new admin-only routes — admin actions happen inline via UI conditional rendering (`isAdmin()`).
- `PhotoAlbumsService` and `PhotosService` perform no client-side role checks; security relies on RTDB rules.

## Production Risks & Mitigations

1. **Album deletion cascades to photos.** An admin mistakenly deletes an album loses its photos permanently. *Mitigation*: confirmation dialog must show photo count and require explicit "Delete" button click on a typed confirm field for albums with > 10 photos.
2. **RTDB write storm on cascade delete.** Deleting an album with 500 photos issues 501 separate `remove()` calls. *Mitigation*: use multi-path `db.object('/').update({...})` with a single update containing `{ [photoPath1]: null, [photoPath2]: null, ... }` to delete in one round-trip.
3. **PhotoSwipe bundle size.** `photoswipe` ^5.4 is ~30KB gzipped. *Mitigation*: dynamic `import('photoswipe/lightbox')` inside `PhotoswipeService.initForGallery()` so the lightbox code only loads when the user enters an album view.
4. **Ken Burns `transform` interacts with PhotoSwipe's animation.** If users open PhotoSwipe from the album view, then exit, and then re-enter the album view, leftover transforms could persist. *Mitigation*: each `<img>` in PhotoSwipe's gallery renders with `transform: none`. The slideshow component is a separate route and never coexists with PhotoSwipe.
5. **Slideshow memory.** Holding all photos in memory + a shuffled array is fine for small albums but could grow. *Mitigation*: cap at 200 photos per album view (warn admin when album exceeds this); spec does not implement pagination in slideshow.
6. **Race: cover photo deletion.** If admin sets a photo as cover, then deletes it, `coverPhotoId` becomes stale. *Mitigation*: `PhotoAlbumDetailComponent.onDeletePhoto` checks if `photo.id === album.coverPhotoId` and clears it in the same RTDB transaction.
7. **Race: user creates album while another user uploads to it.** Multiple writes to `/photoAlbums/{id}` set `updatedAt` from different clients. *Mitigation*: last-write-wins is acceptable for `updatedAt`; cover photo assignment is idempotent.
8. **`getPhotosByAlbum` uses `orderByChild('albumId').equalTo(albumId)`** which requires a Firebase index on `/photos/albumId`. *Mitigation*: document this in the rollout plan; if Firebase complains, add the index via the Firebase Console link in the error message.
9. **PhotoSwipe double-init.** Calling `initForGallery` twice creates two lightbox instances. *Mitigation*: `PhotoswipeService` destroys any existing lightbox before initializing a new one.
10. **The 7-second `setTimeout` removal might break in-flight uploads during deployment.** Old code waited 7 seconds before emitting completion; new code emits as soon as `upload.photo.url` is populated. *Mitigation*: the new behavior is strictly faster and equivalent — no in-flight uploads can be lost because the URL is set before `finalize()` resolves.
11. **Dialog state on small screens.** The album-picker dialog uses a fixed `width: 480px`. *Mitigation*: add `max-width: 95vw` to the dialog `panelClass` config.

## Rollout Plan

1. **Branch**: create `feature/photo-albums-ken-burns` from `main`.
2. **Add `photoswipe` ^5.4 dependency**: `npm install photoswipe@^5.4.0` and commit `package.json` + `package-lock.json`.
3. **Add `PhotoAlbum` lean model** (new file) and delete the old `src/app/models/media/photo-album.ts`. Verify no compile errors via `ng build`.
4. **Extend `Photo` model** with `albumId`. Verify `ng build` passes.
5. **Add `PhotoAlbumsService`**, extend `PhotosService` with `getPhotosByAlbum`, `uploadPhotoToAlbum`, `setPhotoAlbum`, `setAlbumCover`, `nonMessagePhotos$`. Uncomment `updatePhoto` write.
6. **Rename `PhotosComponent` → `PhotosLegacyComponent`** and add the missing file picker. Fix the splice bug.
7. **Replace 7-second `setTimeout`** in `PhotoUploadProgressComponent` with `finalize`-based emission.
8. **Build new `PhotoAlbumsComponent`, `PhotoAlbumDetailComponent`, `PhotoSlideshowComponent`, `PhotoAlbumEditDialogComponent`, `PhotoAlbumPickerDialogComponent`, `PhotoShellComponent`** with their templates and SCSS.
9. **Wire `PhotoswipeService` into `PhotoAlbumDetailComponent`.**
10. **Update `AdminUserUploadsComponent`** to inject `PhotoAlbumsService`, subscribe to `albums$`, and replace `onApprove` with the dialog flow. Add the new `PhotoAlbumPickerDialogComponent` import.
11. **Extend `UserUploadService`** with `approveUploadToAlbum` (deprecate `createPhotoAlbum`).
12. **Update `RoutingService`** with `NavigateToPhotoAlbum` and `NavigateToPhotoSlideshow`.
13. **Update `app-routing.module.ts`** with the three new `/photos/*` routes.
14. **Update `app.module.ts`** with the new declarations and remove the old `PhotosComponent` declaration.
15. **Update `feature-config.ts`** to add `enablePhotoAlbums: false`.
16. **Add PhotoSwipe CSS import** to `src/styles.scss`.
17. **Run `ng build`** and resolve any TypeScript errors.
18. **Manual smoke test**:
    - Create a new album as admin.
    - Upload 3 photos into it.
    - Open album view, click a photo, verify PhotoSwipe opens.
    - Click "Slideshow", verify Ken Burns runs.
    - Delete one photo, verify cover updates if it was the cover.
    - Delete the album, verify photos are also deleted.
    - Toggle `enablePhotoAlbums` OFF in `/admin/features`, verify `/photos` shows the legacy gallery.
19. **Deploy to staging** via `firebase deploy --only hosting --project lecoursville-dev`.
20. **Apply RTDB rule changes** in Firebase Console for staging.
21. **Smoke test on staging** with a real Firebase project, including a guest upload that an admin approves into a chosen album.
22. **Promote to production** by repeating the deploy with `--project lecoursville`.
23. **Monitor** Firebase Console for the first 48 hours for any RTDB rule violations or unusual read volumes.

## Summary of Changes

### New Files

- `src/app/models/photo-album.ts` (lean `PhotoAlbum` interface)
- `src/app/services/photo-albums.service.ts`
- `src/app/services/photoswipe.service.ts`
- `src/app/components/photo-albums/photo-albums.component.{ts,html,scss}` (album grid)
- `src/app/components/photo-album-detail/photo-album-detail.component.{ts,html,scss}` (photo grid + PhotoSwipe)
- `src/app/components/photo-slideshow/photo-slideshow.component.{ts,html,scss}` (Ken Burns)
- `src/app/components/photo-album-edit-dialog/photo-album-edit-dialog.component.{ts,html,scss}` (MatDialog for create/edit album)
- `src/app/components/photo-album-picker-dialog/photo-album-picker-dialog.component.{ts,html,scss}` (admin approval picker)
- `src/app/components/photo-shell/photo-shell.component.{ts,html,scss}` (route-level flag dispatcher)

### Modified Files

- `src/app/models/photo.ts` — add `albumId: string | null = null;`
- `src/app/services/photos.service.ts` — add `getPhotosByAlbum`, `getLoosePhotos`, `uploadPhotoToAlbum`, `setPhotoAlbum`, `setAlbumCover`, `nonMessagePhotos$`; uncomment `updatePhoto` write
- `src/app/services/user-upload.service.ts` — add `approveUploadToAlbum`; mark `createPhotoAlbum` `@deprecated`
- `src/app/services/routing.service.ts` — add `NavigateToPhotoAlbum`, `NavigateToPhotoSlideshow`
- `src/app/components/admin-user-uploads/admin-user-uploads.component.ts` — inject `PhotoAlbumsService` + `MatDialog`; replace `onApprove` with dialog flow
- `src/app/components/photo-upload-progress/photo-upload-progress.component.ts` — replace 7s `setTimeout` with `finalize`-based emission
- `src/app/app-routing.module.ts` — add `/photos`, `/photos/:albumId`, `/photos/:albumId/slideshow` routes
- `src/app/app.module.ts` — declare new components; remove `PhotosComponent` declaration
- `src/app/config/feature-config.ts` — add `enablePhotoAlbums: false`
- `src/styles.scss` — add `@import "~photoswipe/dist/photoswipe.css";`
- `package.json` — add `photoswipe: ^5.4.0`

### Renamed Files

- `src/app/components/photos/photos.component.{ts,html,scss}` → `src/app/components/photos-legacy/photos-legacy.component.{ts,html,scss}`
  - Selector: `app-photos` → `app-photos-legacy`
  - Class: `PhotosComponent` → `PhotosLegacyComponent`
  - Add file picker to template (currently missing)
  - Fix `deletePhoto` splice bug

### Deleted Files

- `src/app/models/media/photo-album.ts` — replaced by `src/app/models/photo-album.ts`

### Firebase Console Changes

- Update RTDB rules per §"Security rules" above (paste JSON into Firebase Console for `/photoAlbums`).
- Add Firebase index on `/photos/albumId` if prompted by `orderByChild` query.
- No Storage rule changes needed.
- `/features/enablePhotoAlbums` flag is created automatically when `AdminFeaturesComponent` first writes to RTDB on admin save.

### Analytics Events Added

`photo_album_view`, `photo_album_open`, `photo_album_create`, `photo_album_delete`, `photo_view`, `photo_slideshow_start`, `photo_slideshow_exit`, `photo_admin_approve_with_album` (see §"Analytics events").

## Verification

### Local validation

1. `ng build` exits with no errors.
2. Manual flow:
   - Create album "Test" via /photos (admin).
   - Upload 3 photos.
   - Click photo → PhotoSwipe opens with next/prev/close working.
   - Click "Slideshow" → full-screen Ken Burns runs for 8s, then advances.
   - Press Space → pauses; press again → resumes.
   - Press Esc → returns to album view.
   - Edit a photo's caption → save → refresh page → caption persists.
   - Delete a photo → photo disappears from album and slideshow.
   - Delete album → confirm dialog shows "3 photos" → confirm → album and all 3 photos are gone.
3. Toggle `enablePhotoAlbums` to false via /admin/features → /photos shows the legacy gallery (renamed component) with the same content as before.
4. Toggle `enablePhotoAlbums` back to true → new album grid renders.
5. As a non-admin user (signed in but no admin role): /photos shows albums but no "+ Album" button; album view shows no "+ Add Photos", no Edit/Delete buttons.

### Staging validation

1. `firebase deploy --only hosting --project lecoursville-dev`.
2. Apply RTDB rule changes in Firebase Console for staging project.
3. Add Firebase index on `/photos/albumId` if the `orderByChild` query errors on first album open.
4. Sign in as admin on the staging site → repeat the manual flow above.
5. Sign in as a guest (or anonymous tab) → /upload → upload a photo with eventName "Summer Picnic" → sign in as admin → /admin/uploads → click Approve → dialog appears → "Create new album" with "Summer Picnic" pre-filled → click Approve & Add → file moves to `photos/{albumId}/` → /photos shows the new album with one photo.
6. Open the album → click Slideshow → confirm Ken Burns animation runs smoothly without jank on a real photo.
7. Check Firebase Console for: RTDB `/photoAlbums` has the new doc with `createdAt`/`updatedAt` timestamps; `/photos/{photoId}` has `albumId` matching; Storage has the file under `photos/{albumId}/`.
8. Inspect Analytics events in Firebase Console DebugView — confirm the eight new event names fire at the right points.

## Open Questions

None.
