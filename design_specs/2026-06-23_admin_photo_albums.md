# Admin Photo Albums: Bulk Folder Upload + Album Management

## Branch & Directories

- **Base directory (frontend only — no backend)**: `/Users/e/mnt/bnk/cs/lecoursville`
- **New design spec**: `design_specs/2026-06-23_admin_photo_albums.md`
- **Branch**: cut `feature/admin-photo-albums` from latest `master`

## Design Revision (2026-08-06)

**`/admin/photo-albums` is now the only curation surface.** Per
`2026-06-21_photo_albums.md` revision, the user-facing `/photos` grid and
`/photos/:albumId` detail are view-only. This admin page additionally gained:

- **Per-album photo-management drill-in**: clicking an album card opens its photos
  inline with per-photo actions — edit metadata (info/location/year/isYearCirca/
  takenBy), set as cover, delete (with cover clearing if the cover photo is deleted),
  download, and Add Photos. Back button returns to the album grid.
- **"New Album" toolbar button** (empty album via `PhotoAlbumEditDialogComponent`),
  complementing "Upload Folder".
- **Analytics**: `photo_album_create` (empty-album create + folder-upload create)
  and `photo_album_delete` fire from this page (they previously fired from the
  user-facing grid).

## Context & Motivation

The `2026-06-21_photo_albums.md` spec shipped an album grid (`/photos`), a single-album view (`/photos/:albumId`), a Ken Burns slideshow (`/photos/:albumId/slideshow`), and a per-upload dialog (`PhotoAlbumPickerDialogComponent`) for the existing guest-upload approval flow. But there is no admin surface for managing albums in bulk. Today an admin who wants to ingest 200 photos from a wedding has to either:

1. Upload them one-by-one through the per-album `Add Photos` button on `/photos/:albumId` (slow, no progress overview, no batch metadata).
2. Ask guests to upload through `/upload` and then approve each one through the picker dialog (`admin-user-uploads.component.ts:79-93`) — which still calls `photosService.uploadPhotoToAlbum` per file with no batch progress.

Neither fits the common case: the admin already has the photos on disk in a folder structure, and just wants to point at the folder and have it land as a coherent album with proper cover, count, and storage paths.

This spec adds a dedicated `/admin/photo-albums` route. It is the single admin surface for album management: list existing albums, upload a folder of photos into a new album, rename or delete an album, and add more photos to an existing album. Bulk upload scans the picked folder recursively, uploads every image with per-file progress, auto-sets the cover to the first photo, and uses the same `photos/{albumId}/{fileName}` storage convention already established by `UserUploadService.approveUploadToAlbum` (`user-upload.service.ts:187-225`).

## Glossary

- **Admin photo albums route** — new route at `/admin/photo-albums`, gated by `AuthAdminGuardService` (inherited from the existing `admin` parent route). Lists every `PhotoAlbum` and exposes bulk upload + per-album management.
- **Folder picker** — `<input type="file" webkitdirectory>` (matches `public-upload.component.html:28`). User picks a single folder via the OS dialog. All files under that folder (recursive) are listed with their `webkitRelativePath`.
- **Bulk upload album** — a new `PhotoAlbum` created on the fly when the admin clicks "Upload Folder" and picks a folder. Default title = the picked folder's basename (last path segment). Editable in the upload dialog before upload starts.
- **Recursive scan** — every image file found under the picked folder (at any depth) becomes a photo in the new album. The album title is the picked folder's basename, NOT each subfolder. All files land in one album.
- **Storage path** — `photos/{albumId}/{fileName}`, matching `approveUploadToAlbum` (`user-upload.service.ts:194`) and the `FeatureFlagGuard`-gated rule proposal in `2026-06-21_photo_albums.md:1069`. File names from the picked folder are preserved (basename only, subpath is dropped — see §"Front End Requirements").
- **Cover auto-set** — after the bulk upload completes, `photosService.setAlbumCover(albumId, firstPhoto.id)` is called. Matches the existing `resolveCover` fallback in `photo-albums.component.ts:75-80` so album cards show the first uploaded image even if `coverPhotoId` is otherwise null.
- **Drag-and-drop zone** — drop target on the admin page covering the full upload area. Accepts folder drops. Same `DataTransferItem.webkitGetAsEntry()` pattern as `public-upload.component.ts:105-141`. Click-to-pick is also wired via the hidden `<input type="file" webkitdirectory>`.

## Current State

- `PhotoAlbumsService.albums$` (`src/app/services/photo-albums.service.ts:10`) is a `BehaviorSubject<PhotoAlbum[]>` populated in the constructor — subscribable from any component.
- `PhotoAlbumsService.createAlbum(title)`, `updateAlbum(id, partial)`, `deleteAlbum(id)` exist (`photo-albums.service.ts:26-40`).
- `PhotosService.uploadPhotoToAlbum(file, albumId): PhotoUpload` (`src/app/services/photos.service.ts:119-123`) wraps `uploadImage` and tags `albumId` on the resulting `Photo` before the RTDB write fires. Returns a `PhotoUpload` (defined at `photos.service.ts:10-14`) with `task`, `photo`, `onUrlAvailable`.
- `PhotosService.setAlbumCover(albumId, photoId)` (`photos.service.ts:111-113`) writes to `photoAlbums/{albumId}`.
- `PhotoUploadProgressComponent` (`src/app/components/photo-upload-progress/photo-upload-progress.component.ts`) takes `[upload]: PhotoUpload` and emits `(completeUploadEvent): Photo`. Already used by `photos-legacy.component.html:71-75` and `photo-album-detail.component.html:23-25`.
- `PhotoAlbumsComponent` (`src/app/components/photo-albums/photo-albums.component.ts`) already has the user-facing album grid + per-album actions. Its `resolveCover` fallback (`photo-albums.component.ts:75-80`) handles missing `coverPhotoId` by returning the first photo's `url` where `photo.albumId === album.id`. The admin route does NOT need to duplicate this logic.
- `PhotoAlbumsComponent.cascadeDeleteAlbum` (`photo-albums.component.ts:139-149`) is `private` — the admin component will inline its own version (or we factor it onto `PhotoAlbumsService.deleteAlbumCascade`; see §"Front End Requirements" §5).
- `AdminComponent` sidenav (`src/app/components/admin/admin.component.html:1-62`) is a flat `<ul class="sidebar-nav">` with one `<li>` per admin page. New entry will sit between Media (line 33-37) and Uploads (line 39-43).
- `AdminUserUploadsComponent` is `standalone: true` (`src/app/components/admin-user-uploads/admin-user-uploads.component.ts:38-52`) with its own `imports: [...]`. The new admin photo-albums component follows the same standalone pattern — no `AppModule.declarations` change needed.
- `RoutingService.NavigateToAdmin*` helpers (`src/app/services/routing.service.ts:96-118`) cover navigation to other admin pages; add `NavigateToAdminPhotoAlbums` if needed (or use `Router` directly inside the component).
- `AppRoutingModule` admin children block (`src/app/app-routing.module.ts:107-146`) lists each admin page as a child route. Insert a new `{ path: 'photo-albums', component: AdminPhotoAlbumsComponent }` between `'media'` (line 113) and `'users'` (line 118).
- Existing folder-picker UX lives in `PublicUploadComponent` (`src/app/components/public-upload/public-upload.component.ts:105-180`). It uses `webkitGetAsEntry()` to recurse dropped folders and `webkitRelativePath` to identify files. The new component borrows the recursion strategy but DOES NOT preserve subpath in storage (we flatten to `photos/{albumId}/{fileName}` per the prior spec).
- The closest admin list+edit+delete pattern is `AdminFamiliesComponent` (`src/app/components/admin-families/admin-families.component.ts` + html) — custom CSS-grid rows, `isAdding`/`editingItem` flags, inline form section, immediate delete. We follow a hybrid: list uses cards (matches `PhotoAlbumsComponent` user view), delete uses confirm dialog (matches `PhotoAlbumsComponent.onDeleteAlbum`), edit uses an inline form below the list (matches `AdminFamiliesComponent`).

## Goals

1. An admin visits `/admin/photo-albums` and sees the same album cards as the user-facing `/photos` view, but with additional admin actions visible (rename, delete, "Add More Photos").
2. The admin clicks "Upload Folder" and either drags a folder onto the drop zone or picks one via `<input type="file" webkitdirectory>`. A dialog opens with the picked folder's basename pre-filled as the album title and a list of detected image files. The admin can rename the album or cancel.
3. On confirm, every detected image file uploads with per-file progress cards (reusing `<app-photo-upload-progress>`). On completion of the last upload, the album's `coverPhotoId` is auto-set to the first successfully uploaded photo.
4. The admin can rename an album via an inline form below the album grid. Save calls `PhotoAlbumsService.updateAlbum(id, { title })` and bumps `updatedAt` automatically.
5. The admin can delete an album. A confirm dialog shows photo count ("Delete album 'X' and its N photos? This cannot be undone."). On confirm, all photos in the album are cascade-deleted via multi-path `db.object('/').update({ [photoPath]: null, ... })` and the album record is removed.
6. The admin can add more photos to an existing album from this admin view (in addition to the existing "Add Photos" button on `/photos/:albumId`). Same `<input type="file" accept="image/*" multiple hidden>` pattern.

## Non-Goals

1. No EXIF parsing. Photo metadata defaults to empty/zero; admin edits per-photo on `/photos/:albumId` (existing flow).
2. No `srcset`/`sizes`/thumbnails. Photos load at full resolution.
3. No zip upload. (Could be added later — `jszip` is already in `package.json:36`.)
4. No multi-album folder mapping (each picked folder → exactly one album). The `2026-06-21_photo_albums.md` spec §13 (`approveUpload` flow) handles one-album-per-upload; this route handles bulk-but-one-album.
5. No per-album storage subfolder mirroring (file names are flattened, not preserving the picked folder's subpath). If `MyTrip/Beach/a.jpg` is picked, it lands at `photos/{albumId}/a.jpg`.
6. No real-time presence (no multi-admin concurrent edit handling). Last-write-wins on `title` and `coverPhotoId`.
7. No migration of legacy `/photos/{id}` data. Out of scope.
8. No new analytics events on this admin view. (User-facing events from the prior spec already cover create/delete/open at `/photos`; the admin page calls the same service methods so the events still fire.)
9. No `<input type="file" webkitdirectory>` fallback for browsers without directory upload support. Modern Chrome/Edge/Safari/Firefox all support it as of 2026.

## Prerequisites

- All deliverables of `design_specs/2026-06-21_photo_albums.md` are merged into `master`. In particular: `PhotoAlbumsService`, `PhotoAlbum` model, `PhotosService.uploadPhotoToAlbum`, `PhotosService.setAlbumCover`, `PhotoUploadProgressComponent`, the feature flag `enablePhotoAlbums`, the new `/photos/:albumId` route, and the `PhotoAlbumPickerDialogComponent`.
- `AuthAdminGuardService` continues to gate the `admin` parent route; child routes inherit that gate. No new admin guard needed.
- `MaterialModule` (`src/app/modules/material.module.ts`) already exports `MatCardModule`, `MatButtonModule`, `MatIconModule`, `MatDialogModule`, `MatFormFieldModule`, `MatInputModule`, `MatTooltipModule`, `MatProgressSpinnerModule`, `MatSnackBarModule`.
- `@angular/cdk` is in `package.json:17`. The CDK drop-zone helpers (DragDropModule) are NOT needed — we use native HTML5 drag-and-drop listeners (`dragover`, `drop`) like `PublicUploadComponent` already does (`public-upload.component.ts:105-141`).
- `PromptModalService` (`src/app/services/prompt-modal.service.ts`) is the house confirm-dialog service.

## Design Principles

1. **Mirror the user-facing album grid for the admin list.** The admin page is a `PhotoAlbumsComponent`-style card grid, NOT a `mat-table`. Same look-and-feel reduces admin cognitive load.
2. **Standalone component, mirroring `AdminUserUploadsComponent`.** `standalone: true` with explicit `imports: [...]`. No `AppModule.declarations` change.
3. **Lean models.** `PhotoAlbum` stays `{ id, title, coverPhotoId, createdAt, updatedAt }`. No new fields.
4. **Photo carries the FK.** New uploads from this admin view call `photosService.uploadPhotoToAlbum(file, albumId)` — the resulting `Photo.albumId` is set before the RTDB write, so no scan/update step is needed. Matches `photo-album-detail.component.ts:135-141`.
5. **Reuse `<app-photo-upload-progress>`.** Per-file progress cards are the same primitive the user-facing album view already uses. No new progress component.
6. **Cascade delete via multi-path `db.object('/').update({ [photoPath]: null, ... })`.** Single round-trip; one RTDB rule violation aborts the whole op (which is what we want).
7. **Folder recursion uses `webkitRelativePath`.** The user picks a folder via `<input type="file" webkitdirectory>` or drops one. Each file's `webkitRelativePath` is the full path from the picked root. We extract the basename (last segment after `/`) for `fileName`; the picked root's basename becomes the default album title.
8. **No new feature flag.** Admin pages don't need a feature flag; the parent `admin` route is already auth-gated.
9. **No lazy loading, no `loadChildren`.** Eager registration per house style.

## Front End Requirements

### 1. New component: `AdminPhotoAlbumsComponent`

**Files**:
- `src/app/components/admin-photo-albums/admin-photo-albums.component.ts`
- `src/app/components/admin-photo-albums/admin-photo-albums.component.html`
- `src/app/components/admin-photo-albums/admin-photo-albums.component.scss`

**Selector**: `app-admin-photo-albums`.

**Standalone**: `standalone: true`, `imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatTooltipModule, MatProgressSpinnerModule, PageToolbarComponent, NoResultsMessageComponent, PhotoUploadProgressComponent]`.

**State**:
```ts
albums: PhotoAlbum[] = [];
photoCounts: { [albumId: string]: number } = {};
searchTerm = '';
sortType: 'recent' | 'title' = 'recent';
editingAlbumId: string | null = null;
editingTitle = '';

// Upload dialog state (when user has picked a folder)
uploadDialogOpen = false;
pendingAlbumTitle = '';
pendingFiles: File[] = [];
activeUploads: { upload: PhotoUpload; file: File }[] = [];
currentUploadAlbumId: string | null = null;

// Drag-and-drop UX state
isDragOver = false;

private subscriptions: Subscription[] = [];
```

**Methods**:

- `ngOnInit`: subscribes to `PhotoAlbumsService.albums$` and `PhotosService.nonMessagePhotos$`. On every emission, recomputes `photoCounts`.
- `getFilteredAlbums(): PhotoAlbum[]`: applies `searchTerm` (case-insensitive title) + `sortType`. Default sort is `recent` (by `updatedAt` desc).
- `getPhotoCount(album): number`: returns `photoCounts[album.id] || 0`.
- `getCoverUrl(album): string | null`: returns `album.coverPhotoId`'s photo `url` if found, else first photo's `url` where `photo.albumId === album.id`, else `null`. Same logic as `PhotoAlbumsComponent.resolveCover` (`photo-albums.component.ts:75-80`) — duplicated here to keep components decoupled.
- `onCreateAlbum()` (opens the upload dialog with empty title, no files pre-loaded).
- `onAddPhotosToExisting(album)`: opens a single-file multi-picker (`<input type="file" accept="image/*" multiple>`), uploads to the existing album. No new album, no cover change. Reuses the same per-file progress card pattern.
- `onEditAlbum(album)`: sets `editingAlbumId = album.id`, copies `album.title` into `editingTitle`. Inline form below the grid.
- `onSaveEdit()`: calls `photoAlbumsService.updateAlbum(editingAlbumId, { title: editingTitle.trim() })`. Clears edit state on completion.
- `onCancelEdit()`: clears edit state.
- `onDeleteAlbum(album)`: confirm dialog "Delete album '{title}' and its {N} photos? This cannot be undone." (uses `PromptModalService`). On confirm: cascade delete via `db.object('/').update({ [photoPath]: null, ... })` then `photoAlbumsService.deleteAlbum(album.id)`.
- `onUploadClick()`: triggers the hidden `<input type="file" webkitdirectory>` click.
- `onFolderPicked(event)`: extracts `File[]` from `event.target.files`, derives the picked folder's basename from the first file's `webkitRelativePath`, opens the upload confirmation dialog.
- `onDragOver(event)` / `onDragLeave(event)`: toggles `isDragOver`. `event.preventDefault()` required.
- `onDrop(event)`: extracts `File[]` from `event.dataTransfer.files`, derives basename from `webkitRelativePath`, opens the dialog.
- `onUploadConfirm()`: validates `pendingAlbumTitle.trim()`, calls `photoAlbumsService.createAlbum(pendingAlbumTitle)` to get a fresh album id, then iterates `pendingFiles` calling `photosService.uploadPhotoToAlbum(file, albumId)` and pushes each into `activeUploads`. After all uploads complete (tracked via `completePhotoUpload`), calls `setAlbumCover(albumId, firstPhoto.id)` once and closes the dialog.
- `onUploadCancel()`: closes the dialog. Any in-flight uploads are NOT cancelled (they finish in the background but their progress cards are dismissed with the dialog — same trade-off as the existing upload flow).
- `completePhotoUpload(photo)`: removes from `activeUploads` by matching `photo.id`. After the last one leaves, calls `photosService.setAlbumCover(currentUploadAlbumId, firstUploadedPhotoId)` and closes the dialog.
- `ngOnDestroy`: unsubscribes.

### 2. New component: `AdminPhotoAlbumUploadDialogComponent`

**Files**:
- `src/app/components/admin-photo-album-upload-dialog/admin-photo-album-upload-dialog.component.{ts,html,scss}`

**Selector**: `app-admin-photo-album-upload-dialog`.

**Standalone**: `standalone: true`, `imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatIconModule, PhotoUploadProgressComponent]`.

**Inputs (`MAT_DIALOG_DATA`)**:
```ts
interface AdminPhotoAlbumUploadDialogData {
  albumTitle: string;
  fileCount: number;
}
```

**Returns**:
```ts
type AdminPhotoAlbumUploadDialogResult =
  | { action: 'start'; title: string }
  | { action: 'cancel' }
  | undefined;
```

**State**:
- `title: string` (initialized from `data.albumTitle`, editable)
- `isUploading: boolean = false` (set to true when admin clicks Start; disables the title field and switches button labels)

**Template outline**:
```html
<h2 mat-dialog-title>Upload Folder</h2>
<mat-dialog-content>
  <p class="upload-dialog-summary">
    Detected <strong>{{ data.fileCount }}</strong> image{{ data.fileCount === 1 ? '' : 's' }} in the picked folder.
  </p>
  <mat-form-field appearance="fill" class="album-title-field">
    <mat-label>Album title</mat-label>
    <input matInput [(ngModel)]="title" required maxlength="80" [disabled]="isUploading" />
  </mat-form-field>
  <p class="upload-dialog-warning" *ngIf="data.fileCount === 0">
    No image files were detected. Pick a folder that contains photos.
  </p>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="onCancel()" [disabled]="isUploading">Cancel</button>
  <button mat-raised-button color="primary" [disabled]="!isValid()" (click)="onStart()">
    {{ isUploading ? 'Uploading...' : 'Start Upload' }}
  </button>
</mat-dialog-actions>
```

The component itself does NOT render the upload progress — that lives in the parent `AdminPhotoAlbumsComponent`. The dialog returns `{ action: 'start', title }` and the parent owns the upload orchestration. This keeps the dialog a thin confirmation shell.

`isValid()`: returns `true` when `title.trim().length > 0` AND `!isUploading`.

### 3. Service change: `PhotoAlbumsService.deleteAlbumCascade`

**File**: `src/app/services/photo-albums.service.ts`.

Add:
```ts
async deleteAlbumCascade(id: string, photoIds: string[]): Promise<void> {
  if (photoIds.length === 0) {
    await this.db.object(`photoAlbums/${id}`).remove();
    return;
  }
  const updates: { [path: string]: null } = { [`photoAlbums/${id}`]: null };
  for (const photoId of photoIds) {
    updates[`photos/${photoId}`] = null;
  }
  await this.db.object('/').update(updates);
}
```

And refactor `PhotoAlbumsComponent.cascadeDeleteAlbum` (`photo-albums.component.ts:139-149`) to call this new method. Removes the duplicated private implementation in two places.

### 4. Routing change

**File**: `src/app/app-routing.module.ts`.

Add the new component to imports (line ~25 area):
```ts
import { AdminPhotoAlbumsComponent } from 'src/app/components/admin-photo-albums/admin-photo-albums.component';
import { AdminPhotoAlbumUploadDialogComponent } from 'src/app/components/admin-photo-album-upload-dialog/admin-photo-album-upload-dialog.component';
```

Add a new child route between `'media'` (line 113-115) and `'users'` (line 116-119):
```ts
{
  path: 'photo-albums',
  component: AdminPhotoAlbumsComponent,
},
```

The component is standalone, so no `AppModule.declarations` change. The parent `admin` route's `AuthAdminGuardService` covers auth.

### 5. Sidenav change

**File**: `src/app/components/admin/admin.component.html`.

Insert between the existing `Media` `<li>` (line 33-37) and `Uploads` `<li>` (line 39-43):
```html
<li routerLinkActive="active">
  <a routerLink="/admin/photo-albums" (click)="closeSidenav()">
    <mat-icon>photo_library</mat-icon>
    <span>Photo Albums</span>
  </a>
</li>
```

`photo_library` matches the `feature-config.ts` icon for `enablePhotoAlbums` (kept consistent with the user-facing album grid).

### 6. Standalone component imports

`AdminPhotoAlbumsComponent` and `AdminPhotoAlbumUploadDialogComponent` are both `standalone: true`. They import the Material modules they need directly. The `<app-page-toolbar>` (`PageToolbarComponent`), `<app-no-results-message>` (`NoResultsMessageComponent`), and `<app-photo-upload-progress>` (`PhotoUploadProgressComponent`) are non-standalone. The standalone component imports them via `imports: [PageToolbarComponent, NoResultsMessageComponent, PhotoUploadProgressComponent]` — Angular Ivy allows non-standalone components to appear in standalone components' `imports` as long as they're declared in some NgModule (they are: in `AppModule`).

### 7. Drag-and-drop file recursion

Reuse the `webkitGetAsEntry()` pattern from `PublicUploadComponent` (`public-upload.component.ts:105-141`):

```ts
private collectFilesFromDataTransfer(
  items: DataTransferItemList,
  cb: (files: File[]) => void,
): void {
  const files: File[] = [];
  let pending = 0;
  const checkDone = () => { if (pending === 0) cb(files); };
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') { continue; }
    const entry = item.webkitGetAsEntry?.();
    if (!entry) {
      const file = item.getAsFile();
      if (file) files.push(file);
      continue;
    }
    pending++;
    this.walkEntry(entry, files, () => { pending--; checkDone(); });
  }
  checkDone();
}

private walkEntry(entry: FileSystemEntry, files: File[], done: () => void): void {
  if (entry.isFile) {
    (entry as FileSystemFileEntry).file(file => { files.push(file); done(); }, done);
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    let pendingDirs = 1;
    const checkDir = () => { pendingDirs--; if (pendingDirs === 0) done(); };
    const readBatch = () => {
      reader.readEntries(entries => {
        if (entries.length === 0) { checkDir(); return; }
        pendingDirs += entries.length;
        entries.forEach(child => this.walkEntry(child, files, () => { pendingDirs--; checkDir(); }));
        readBatch();
      }, checkDir);
    };
    readBatch();
  } else {
    done();
  }
}
```

For the click-to-pick flow (`<input type="file" webkitdirectory>`), iterate `event.target.files` and assign each file's `webkitRelativePath` is already populated by the browser.

### 8. Folder basename extraction

```ts
function basenameOfPickedFolder(files: File[]): string {
  if (files.length === 0) { return ''; }
  const first = files[0];
  const path = first.webkitRelativePath || first.name;
  const parts = path.split('/');
  return parts[0] || first.name;
}
```

When the admin drops a folder, the first file's `webkitRelativePath` is `{folderName}/{subPath}/{fileName}`; the folder name is the first `/`-segment. When the admin picks via the file dialog, `webkitRelativePath` is also populated.

### 9. RxJS stream design summary

| Stream | Producer | Consumer | Cleanup |
|---|---|---|---|
| `PhotoAlbumsService.albums$` | `db.list('photoAlbums').valueChanges()` | `AdminPhotoAlbumsComponent.ngOnInit` | `ngOnDestroy` |
| `PhotosService.nonMessagePhotos$` | filter on `getAllPhotos()` | `AdminPhotoAlbumsComponent.ngOnInit` (for photo counts) | `ngOnDestroy` |
| `photoUpload.onUrlAvailable` | Firebase upload task | `PhotoUploadProgressComponent.ngOnInit` (existing; emit `completeUploadEvent`) | handled by `take(1)` in the progress component |

The parent component manages its own `subscriptions: Subscription[]` and unsubscribes in `ngOnDestroy`. The `activeUploads` array is filtered imperatively (matches `photo-album-detail.component.ts:144-147`).

### 10. Template outline

```html
<app-page-toolbar title="Admin Photo Albums">
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
  <button mat-raised-button color="primary" (click)="onUploadClick()">
    <mat-icon>create_new_folder</mat-icon> Upload Folder
  </button>
  <input #folderInput type="file" webkitdirectory multiple hidden
         (change)="onFolderPicked($event)" />
</app-page-toolbar>

<div class="upload-drop-zone"
     [class.drag-over]="isDragOver"
     (dragover)="onDragOver($event)"
     (dragleave)="onDragLeave($event)"
     (drop)="onDrop($event)">
  <mat-icon class="drop-zone-icon">cloud_upload</mat-icon>
  <div class="drop-zone-label">Drag a folder here, or click "Upload Folder" above</div>
</div>

<div *ngIf="activeUploads.length > 0" class="active-uploads">
  <h3>Uploading... ({{ activeUploads.length }} remaining)</h3>
  <app-photo-upload-progress *ngFor="let entry of activeUploads"
                             [upload]="entry.upload"
                             (completeUploadEvent)="completePhotoUpload($event)">
  </app-photo-upload-progress>
</div>

<div class="admin-album-grid container-fluid">
  <mat-card *ngFor="let album of getFilteredAlbums()"
            class="admin-album-card mat-elevation-z6 col-12 col-sm-6 col-md-4 col-lg-3">
    <div class="album-cover">
      <img *ngIf="getCoverUrl(album); else placeholder"
           [src]="getCoverUrl(album)"
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
    <mat-card-actions>
      <button mat-icon-button matTooltip="Add More Photos" (click)="onAddPhotosToExisting(album)">
        <mat-icon>add_photo_alternate</mat-icon>
      </button>
      <button mat-icon-button matTooltip="Rename" (click)="onEditAlbum(album)">
        <mat-icon>edit</mat-icon>
      </button>
      <button mat-icon-button matTooltip="Delete" (click)="onDeleteAlbum(album)">
        <mat-icon>delete</mat-icon>
      </button>
    </mat-card-actions>
  </mat-card>
  <app-no-results-message *ngIf="getFilteredAlbums().length === 0" [searchTerm]="searchTerm"></app-no-results-message>
</div>

<div *ngIf="editingAlbumId" class="album-edit-form-section">
  <mat-card class="album-edit-card">
    <mat-card-header>
      <mat-card-title>Rename Album</mat-card-title>
    </mat-card-header>
    <mat-card-content>
      <mat-form-field appearance="fill">
        <mat-label>Album title</mat-label>
        <input matInput [(ngModel)]="editingTitle" required maxlength="80" />
      </mat-form-field>
    </mat-card-content>
    <mat-card-actions align="end">
      <button mat-button (click)="onCancelEdit()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!editingTitle.trim()" (click)="onSaveEdit()">Save</button>
    </mat-card-actions>
  </mat-card>
</div>
```

### 11. SCSS outline

```scss
.upload-drop-zone {
  margin: 16px;
  padding: 32px;
  border: 2px dashed #cbd5e0;
  border-radius: 12px;
  background: #f7fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: background 150ms, border-color 150ms;
  cursor: pointer;
}

.upload-drop-zone.drag-over {
  background: #ebf8ff;
  border-color: var(--color-brand-primary);
}

.drop-zone-icon {
  font-size: 48px;
  width: 48px;
  height: 48px;
  color: var(--color-brand-primary);
}

.drop-zone-label {
  color: #4a5568;
  font-size: 0.95rem;
}

.active-uploads {
  margin: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
}

.admin-album-grid {
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
}

.admin-album-card {
  margin-bottom: 16px;
  cursor: default;
}

.album-cover {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;

  img {
    object-fit: cover;
    width: 100%;
    height: 100%;
  }
}

.album-cover-placeholder {
  font-size: 64px;
  width: 64px;
  height: 64px;
  color: var(--color-brand-primary);
}

.album-title {
  font-weight: 600;
  margin-top: 8px;
  font-size: 1rem;
}

.album-count {
  color: #6b7280;
  font-size: 0.875rem;
}

.album-edit-form-section {
  margin: 16px;
}

.album-edit-card {
  padding: 16px;
}
```

## Firebase Requirements

### RTDB paths

| Path | Writer | Reader | Type |
|---|---|---|---|
| `/photoAlbums/{albumId}` | `PhotoAlbumsService.createAlbum/updateAlbum/deleteAlbum/deleteAlbumCascade` | `PhotoAlbumsService.getAlbum` | `PhotoAlbum` |
| `/photos/{photoId}` | `PhotosService.uploadImage` (with `albumId` set); `PhotosService.deletePhoto`; multi-path cascade | `PhotosService.getAllPhotos`, `getPhotosByAlbum`, `getLoosePhotos`, `getPhotoById` | `Photo` (with `albumId: string \| null`) |

### Storage paths

| Path | Writer | Reader |
|---|---|---|
| `photos/{albumId}/{fileName}` | `PhotosService.uploadPhotoToAlbum` (called by `AdminPhotoAlbumsComponent` and `AdminPhotoAlbumUploadDialogComponent`) | Existing storage browser |

Existing path conventions from `2026-06-21_photo_albums.md:1068-1072` are reused unchanged. The admin bulk upload writes the same shape that `UserUploadService.approveUploadToAlbum` writes (`user-upload.service.ts:194`).

### Security rules

No changes. The proposed RTDB rules in `2026-06-21_photo_albums.md:1079-1106` already cover `/photoAlbums` (admin-only writes via `auth != null`) and `/photos` (admin-only writes). `AuthAdminGuardService` ensures the UI exposes these writes only to admins. Storage rules at `2026-06-21_photo_albums.md:1108-1112` already cover `photos/{allPaths}`.

### Auth context

- `/admin/photo-albums` is gated by `AuthAdminGuardService` (inherited from the `admin` parent route at `app-routing.module.ts:107-110`).
- No new admin-only checks in services. RTDB rules enforce the access boundary at the data layer.

## Production Risks & Mitigations

1. **Folder upload of 1000+ images can saturate Firebase Storage bandwidth.** *Mitigation*: no explicit cap in this spec; document the soft limit at ~200 photos per bulk upload in a confirmation message ("This will upload 847 files. Continue?"). Long-term: add admin-configurable batch size.
2. **Concurrent edits to the same album by two admins.** *Mitigation*: last-write-wins on `title` and `coverPhotoId`. Real-time merge would require a CRDT; out of scope.
3. **Drag-and-drop UX rejects on some browsers.** *Mitigation*: the click-to-pick button is always available. Add a fallback `<input type="file" multiple>` (non-`webkitdirectory`) for browsers without folder upload — but only if data shows usage. Skip in this spec.
4. **`file.webkitRelativePath` is empty when the user picks files via a non-directory file dialog.** *Mitigation*: the click-to-pick flow uses `<input type="file" webkitdirectory>` which DOES populate `webkitRelativePath`. The non-directory fallback is out of scope.
5. **A user picks a folder with no images.** *Mitigation*: the dialog shows "No image files were detected" and the Start button is disabled. UI prevents the upload from starting.
6. **A user picks a folder with 10,000+ files (system freeze risk).** *Mitigation*: cap accepted MIME types at `image/*`. Browsers still load file metadata for non-image files before filtering; document the soft cap at 500 files per upload in a confirmation message.
7. **Folder basename contains characters that break Storage paths.** *Mitigation*: sanitize via the existing `sanitizeName` helper at `user-upload.service.ts:44-46` (`name.replace(/[^a-zA-Z0-9]/g, '')`). Apply to the picked folder name before using as album title default and to each file's basename.
8. **In-flight uploads survive dialog dismissal.** If the admin cancels the upload dialog mid-batch, the `activeUploads` array is wiped from the view but the underlying Firebase Storage uploads keep running. The resulting Photo records still land in RTDB. *Mitigation*: document the trade-off; provide a "Cancel All" button on the active-uploads panel that calls `upload.task.cancel()` on each.
9. **Cover photo race when two admins upload to the same album simultaneously.** *Mitigation*: last-write-wins. Document the behavior.
10. **Cascade delete on an album with > 500 photos issues a single multi-path update.** Firebase's RTDB allows up to ~1000 paths per `update()` call. *Mitigation*: chunk the cascade into multiple `update()` calls if photo count exceeds 500. Implement a `chunkPaths(paths, size=500)` helper inside `deleteAlbumCascade`.
11. **`activeUploads` array references `PhotoUpload` objects whose progress components have already been destroyed.** *Mitigation*: same pattern as `photo-album-detail.component.ts:144-147` — filter on `photo.id` match. No memory leak because `PhotoUploadProgressComponent` completes its own subscription via `take(1)` on `onUrlAvailable`.
12. **`<input type="file" webkitdirectory>` HTML attribute casing.** Use `webkitdirectory` (lowercase) in markup; Angular treats it as a DOM attribute passthrough. The existing `public-upload.component.html:28` uses `webkitDirectory` (camelCase) which also works. Either form is acceptable; match the existing camelCase style.

## Rollout Plan

1. **Branch**: cut `feature/admin-photo-albums` from latest `master`.
2. **Add `AdminPhotoAlbumsComponent`** (standalone, all inline features: list, drop zone, upload orchestration, edit, delete).
3. **Add `AdminPhotoAlbumUploadDialogComponent`** (standalone, thin confirmation shell).
4. **Extend `PhotoAlbumsService` with `deleteAlbumCascade(id, photoIds)`**.
5. **Refactor `PhotoAlbumsComponent.cascadeDeleteAlbum`** to delegate to the new service method. Remove the private duplicate at `photo-albums.component.ts:139-149`.
6. **Add sidenav entry** in `admin.component.html` between Media and Uploads.
7. **Add admin route** in `app-routing.module.ts` as a child of `admin`.
8. **Run `ng build` and resolve any errors**.
9. **Manual smoke test**:
   - Sign in as admin, navigate to `/admin/photo-albums`.
   - Confirm the existing album cards render with covers and photo counts.
   - Click "Upload Folder", pick a folder with 5 JPEGs and 1 nested subfolder containing 2 more. Verify the dialog shows "Detected 7 images" and the title is the picked folder's basename. Rename the title. Click Start Upload. Verify all 7 progress cards appear, complete, and the dialog auto-closes.
   - Verify the new album appears in the grid with the first photo as the cover (or fallback if the cover URL hasn't loaded yet).
   - Drag-and-drop a folder onto the drop zone. Verify the same flow.
   - Click "Rename" on an existing album. Edit the title. Click Save. Verify the title updates and `updatedAt` bumps.
   - Click "Delete" on an album with 7 photos. Verify the confirm dialog text. Click "Yes" (or equivalent confirm action). Verify the album and all 7 photos are gone from RTDB.
   - Click "Add More Photos" on an existing album. Pick 2 more files. Verify both upload and the album's photo count increments to (original + 2).
10. **Deploy to staging** via `firebase deploy --only hosting --project lecoursville-dev`.
11. **Smoke test on staging** with a real Firebase project.
12. **Promote to production** by repeating the deploy with `--project lecoursville`.

## Summary of Changes

### New Files
- `src/app/components/admin-photo-albums/admin-photo-albums.component.{ts,html,scss}` — admin album management page
- `src/app/components/admin-photo-album-upload-dialog/admin-photo-album-upload-dialog.component.{ts,html,scss}` — confirmation dialog before bulk upload starts

### Modified Files
- `src/app/services/photo-albums.service.ts` — add `deleteAlbumCascade(id, photoIds)` with multi-path `db.object('/').update(...)` and chunking for > 500 photos
- `src/app/components/photo-albums/photo-albums.component.ts` — refactor `cascadeDeleteAlbum` private method (currently `photo-albums.component.ts:139-149`) to delegate to `photoAlbumsService.deleteAlbumCascade`
- `src/app/components/admin/admin.component.html` — insert `<li>` for Photo Albums between Media (line 37) and Uploads (line 43)
- `src/app/app-routing.module.ts` — add `{ path: 'photo-albums', component: AdminPhotoAlbumsComponent }` child route

### No Firebase Console Changes
- No RTDB rule changes (existing rules from `2026-06-21_photo_albums.md:1079-1106` cover the new write patterns).
- No Storage rule changes.
- No new index needed.

### No Analytics Changes
- The admin page reuses `photoAlbumsService.createAlbum/updateAlbum/deleteAlbum` which the user-facing `PhotoAlbumsComponent` already logs (`photo_album_create`, `photo_album_delete`).

### No New Dependencies
- No `package.json` changes.

## Verification

### Local validation

1. `ng build` exits with no errors.
2. Manual flow as described in the Rollout Plan §9.

### Staging validation

1. `firebase deploy --only hosting --project lecoursville-dev`.
2. Sign in as admin on the staging site, navigate to `/admin/photo-albums`.
3. Confirm the sidenav entry is visible and active when on the route.
4. Repeat the manual flow with a folder of 20+ images spanning multiple subfolders.
5. Verify in Firebase Console:
   - `/photoAlbums/{newId}` has `title`, `createdAt`, `updatedAt`, `coverPhotoId = {firstPhotoId}`.
   - `/photos/{photoId}` records have `albumId = {newId}`.
   - Storage has files under `photos/{newId}/{fileName}`.
6. Test the rename flow: verify `updatedAt` increments and the album's title updates across all consumers.
7. Test the delete cascade: pick an album with 10+ photos. Confirm all 10+ are removed from `/photos` and the album is removed from `/photoAlbums` in a single multi-path write.

### Manual edge cases

- Folder with zero images: dialog warns "No image files were detected"; Start button disabled.
- Folder with 1 image: dialog shows "Detected 1 image"; upload proceeds; cover auto-set to that one photo.
- Folder with non-image files mixed in: filtered out by `accept` on the picker; drag-and-drop filters via MIME type check.
- Cancel during upload: in-flight uploads continue in the background; admin can dismiss the active uploads panel without affecting them.
- Two admins editing the same album title: last-write-wins on `title`. Documented in Production Risks §2.

## Open Questions

None.
