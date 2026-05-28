# Agent Design Spec: User Upload Queue

## Branch & Directories

- **Base directory**: `/Users/e/mnt/bnk/cs/lecoursville`
- **Frontend**: Angular 15 SPA at `src/app/`
- **Firebase Backend**: Realtime Database + Firebase Storage (dev + prod separate projects)

---

## Context & Motivation

Guests at events want an easy way to share photos via QR code scan. Currently there is no way for unauthenticated users to upload photos. The site needs a public upload page at `/upload` that accepts photos/videos, stores them in a moderation queue, and allows an admin to review and approve submissions before they appear publicly.

The asymmetry is: the existing `PhotosService` uploads directly to the `photos/` bucket and RTDB with no review step. This new flow introduces a separate `userUploads/` bucket for raw guest submissions, a pending/approved/rejected status lifecycle, and an admin review UI at `/admin/uploads`.

---

## Glossary

- **UserUpload**: Metadata record for a guest submission, stored in Firebase RTDB at `/userUploads/{id}`. Fields: id, url, path, dateAdded, suggestedEvent, status, uploader, fileName, fileType, fileSize.
- **UploadStatus**: Enum `'pending' | 'approved' | 'rejected'` — the moderation state of a UserUpload.
- **userUploads bucket**: Firebase Storage path `userUploads/{uploadId}/{fileName}` — raw guest uploads land here and await review.
- **photos bucket**: Firebase Storage path `photos/{uploadId}/{fileName}` — approved uploads are copied here.
- **PhotoAlbum**: Existing model at `src/app/models/media/photo-album.ts` — used to group approved uploads by suggested event name.
- **UploaderInfo**: Interface `{ name?, email?, anonymousId? }` — optionally provided by guest uploader.
- **anonymousId**: Client-generated random string `anon_' + random` used to identify guests who do not provide a name or email.

---

## Current State

### Existing Upload Pattern

**File**: `src/app/services/photos.service.ts` (lines 85-126)

The `uploadPhoto()` method uploads to Firebase Storage at `photos/{photoId}.{ext}` and saves metadata to RTDB at `/photos/{id}`. The `uploadedBy` field is set from `this.user.id` (line 97). The RTDB write is commented out at line 110 (metadata not saved). Uses `AngularFireStorage.upload()` and `fileRef.getDownloadURL()` pattern.

### Existing PhotoAlbum Model

**File**: `src/app/models/media/photo-album.ts` (lines 1-43)

PhotoAlbum implements `UploadableMedia` and has fields: id, title, date, folderName, fileName, listing (array of photo IDs), isSticky, isHidden, urls (download + icon).

### Existing Public Route

**File**: `src/app/app-routing.module.ts` (lines 139-141)

```typescript
{ path: 'upload', component: PublicUploadComponent }
```

No auth guard on the upload route — it is publicly accessible.

### Existing Admin Route Pattern

**File**: `src/app/app-routing.module.ts` (lines 92-126)

Admin children routes live under `{ path: 'admin', canActivate: [AuthAdminGuardService] }`. Existing children: media, users, features, people, clans, calendars. Admin nav is in `src/app/components/admin/admin.component.html` (lines 1-49) using `<li routerLinkActive="active">` pattern.

### Existing Upload Component

**File**: `src/app/components/public-upload/public-upload.component.ts` (lines 1-158)

PublicUploadComponent uses `PhotosService` directly. Supports drag-and-drop, multi-file selection, progress bars, and shows completion message. Uses `finalize()` from rxjs/operators to get download URL after upload. No event name input field exists yet.

---

## Goals

1. Guests can upload photos/videos at a public `/upload` URL with no authentication required.
2. Each guest can optionally suggest an event name for their submission.
3. All guest uploads land in Firebase Storage under `userUploads/` and RTDB under `/userUploads` with `status: 'pending'`.
4. An admin can view pending uploads at `/admin/uploads` with thumbnail preview and file metadata.
5. Admin can approve an upload: file is copied to `photos/`, a PhotoAlbum entry is created with the suggested event name, original is deleted, RTDB status updated to `'approved'`.
6. Admin can reject an upload: file deleted from storage, RTDB entry removed.
7. Duplicate filenames are allowed — each upload gets a unique ID regardless of filename.
8. If a Firebase copy or delete operation fails during approval, the error is caught, logged, and the upload remains in `'pending'` status for retry.
9. The system handles multiple simultaneous uploads without data loss.

---

## Non-Goals

1. No email notification on upload or approval (deferred to future work with Cloud Functions).
2. No SMS or push notifications.
3. No guest user accounts or sessions — uploads are anonymous unless the guest provides a name/email.
4. No bulk approve/reject actions (one at a time only).
5. No automated duplicate detection beyond unique ID per upload.
6. Uploaded files are not automatically added to any existing PhotoAlbum — a new PhotoAlbum is created per approved upload.
7. No client-side file compression or resizing before upload.

---

## Prerequisites

- `AngularFireStorage` and `AngularFireDatabase` already bootstrapped in `app.module.ts`.
- `AuthAdminGuardService` already protects `/admin/*` routes.
- `PublicUploadComponent` already exists at `src/app/components/public-upload/` (selector `app-public-upload`).
- `UserUpload` model and `UserUploadService` already exist (implementation done in feature branch).
- `AdminUserUploadsComponent` already exists at `src/app/components/admin-user-uploads/` (selector `app-admin-user-uploads`).
- `/upload` and `/admin/uploads` routes already registered.
- Firebase Storage rules must be set in Firebase Console (see Firebase Requirements section).
- Firebase Realtime Database rules must be set in Firebase Console (see Firebase Requirements section).

---

## Design Principles

1. Mirror existing Firebase service patterns: inject `AngularFireStorage` and `AngularFireDatabase`, use `BehaviorSubject` for local state where needed.
2. Service methods are async/Promise-based for operations that require wait (copy, delete, URL fetch).
3. Upload file type validation happens client-side in the component before upload starts.
4. No new external libraries beyond what is already in the project.
5. Storage paths use constants embedded in the service methods (not externalized to a config file).
6. RTDB writes use `db.list(path).update(key, value)` pattern consistent with existing services.
7. Admin component uses Angular Material components already available in the project (mat-card, mat-icon-button, etc.).

---

## Front End Requirements

### 1. New Model: UserUpload

**File**: `src/app/models/user-upload.ts` (already exists)

```typescript
export type UploadStatus = 'pending' | 'approved' | 'rejected';

export interface UploaderInfo {
  name?: string;
  email?: string;
  anonymousId?: string;
}

export class UserUpload {
  id = '';
  url = '';
  path = '';
  dateAdded = new Date();
  suggestedEvent = '';
  status: UploadStatus = 'pending';
  uploader: UploaderInfo = {};
  fileName = '';
  fileType = '';
  fileSize = 0;
}
```

### 2. New Service: UserUploadService

**File**: `src/app/services/user-upload.service.ts` (already exists)

Methods to retain from existing implementation:

- `getPendingUploads(): AngularFireList<UserUpload>` — returns RTDB list filtered by `orderByChild('status').equalTo('pending')`
- `getAllUploads(): AngularFireList<UserUpload>` — returns all uploads from `/userUploads`
- `subscribeToPendingUploads(callback: (uploads: UserUpload[]) => void): void` — subscribes to pending uploads and calls callback
- `subscribeToAllUploads(callback: (uploads: UserUpload[]) => void): void` — subscribes to all uploads and calls callback
- `uploadFile(file: File, suggestedEvent: string, uploader: UploaderInfo): { task: AngularFireUploadTask, uploadId: string }` — uploads to `userUploads/{uploadId}/{fileName}`, saves metadata to RTDB at `/userUploads/{uploadId}`
- `approveUpload(upload: UserUpload): Promise<void>` — copies file to `photos/{uploadId}/{fileName}`, deletes original, creates PhotoAlbum, updates RTDB status to `'approved'`. On error, catches the error, logs to console, and re-throws so the caller knows the operation failed (upload stays `'pending'`).
- `rejectUpload(upload: UserUpload): Promise<void>` — deletes file from storage, removes RTDB entry. On error, logs to console and re-throws.
- `deleteUpload(upload: UserUpload): Promise<void>` — deletes file from storage (if it exists), removes RTDB entry.

Service-level BehaviorSubject:
```typescript
private allUploadsSource: BehaviorSubject<UserUpload[]> = new BehaviorSubject([]);
allUploads$: Observable<UserUpload[]> = this.allUploadsSource.asObservable();
```

RTDB path constant: `private userUploadsRef = 'userUploads'`

Storage paths:
- Upload destination: `userUploads/{uploadId}/{fileName}`
- Approved destination: `photos/{uploadId}/{fileName}`

### 3. Modified Component: PublicUploadComponent

**File**: `src/app/components/public-upload/public-upload.component.ts` (already modified)

Changes from existing state:
- Replace `PhotosService` import/injection with `UserUploadService`
- Remove `AuthService` import/injection (no longer needed — uploads are anonymous)
- Add `suggestedEvent: string = ''` property
- Modify `startUpload()` to call `userUploadService.uploadFile(item.file, this.suggestedEvent, { anonymousId: this.generateAnonymousId() })` instead of `photosService.uploadPhoto()`
- Add `generateAnonymousId(): string` method returning `'anon_' + Math.random().toString(36).substring(2, 15)`
- `clearAll()` should also reset `this.suggestedEvent = ''`
- `reset()` should also reset `this.suggestedEvent = ''`

**Template**: `src/app/components/public-upload/public-upload.component.html` (already modified)

Add event name input field inside `.file-list` div, before `.file-header`:
```html
<div class="event-input">
  <label for="eventName">Suggest an event name (optional)</label>
  <input id="eventName" type="text" [(ngModel)]="suggestedEvent" placeholder="e.g., Summer Picnic 2024" />
</div>
```

Update success message to reflect moderation queue:
```html
<p>{{ uploadItems.length }} file(s) submitted for review</p>
<p class="hint">An administrator will review and approve your submission.</p>
```

**Styles**: `src/app/components/public-upload/public-upload.component.scss` (already modified)

Add `.event-input` styles (margin-bottom, label block, input width/padding/border/focus):
```scss
.event-input {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;

  label {
    display: block;
    font-size: 12px;
    color: #666;
    margin-bottom: 6px;
  }

  input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: #666;
    }
  }
}
```

Add `.hint` style under `.complete-message`:
```scss
.hint {
  font-size: 14px;
  color: #999;
  margin-bottom: 24px;
}
```

### 4. New Admin Component: AdminUserUploadsComponent

**File**: `src/app/components/admin-user-uploads/admin-user-uploads.component.ts` (already exists)
**Template**: `src/app/components/admin-user-uploads/admin-user-uploads.component.html` (already exists)
**Styles**: `src/app/components/admin-user-uploads/admin-user-uploads.component.scss` (already exists)

Selector: `app-admin-user-uploads`

Component properties:
- `allUploads: UserUpload[] = []` — all uploads from subscription
- `processingIds: Set<string> = new Set()` — IDs currently being processed (approve/reject)
- `previewUpload: UserUpload | null = null` — upload being previewed
- `filterStatus: 'pending' | 'all' = 'pending'` — current filter

On init, subscribe to `userUploadService.subscribeToAllUploads()`.

Computed properties:
- `filteredUploads` — returns `allUploads.filter(u => u.status === 'pending')` when `filterStatus === 'pending'`, else returns `allUploads`
- `pendingCount` — returns `allUploads.filter(u => u.status === 'pending').length`

Methods:
- `onApprove(upload: UserUpload): Promise<void>` — adds to `processingIds`, calls `userUploadService.approveUpload()`, removes from `processingIds` in finally. Catches and logs errors.
- `onReject(upload: UserUpload): Promise<void>` — adds to `processingIds`, calls `userUploadService.rejectUpload()`, removes from `processingIds` in finally. Catches and logs errors.
- `onPreview(upload: UserUpload): void` — sets `previewUpload`
- `closePreview(): void` — sets `previewUpload = null`
- `isProcessing(id: string): boolean` — returns `processingIds.has(id)`
- `formatFileSize(bytes: number): string` — returns human-readable size string
- `getStatusLabel(upload: UserUpload): string` — returns capitalized status string

Template requirements:
- Filter bar at top with `mat-button-toggle-group` for `pending` / `all`
- `pending-badge` span showing count when `pendingCount > 0`
- `upload-row` div per upload with thumbnail (img for image/*, video for video/*), file info (filename, fileType, fileSize, suggestedEvent, dateAdded), status badge (colored dot + label), and action buttons (preview, approve, reject)
- Approve button disabled if `isProcessing(id) || upload.status !== 'pending'`
- Reject button disabled if `isProcessing(id)`
- Empty state when `filteredUploads.length === 0`

### 5. Route Updates

**File**: `src/app/app-routing.module.ts` (already updated)

Public upload route (no auth guard):
```typescript
{ path: 'upload', component: PublicUploadComponent }
```

Admin uploads route (under admin children):
```typescript
{ path: 'uploads', component: AdminUserUploadsComponent }
```

### 6. Admin Navigation Update

**File**: `src/app/components/admin/admin.component.html` (already updated)

Add nav item after Media nav item:
```html
<li routerLinkActive="active">
  <a routerLink="/admin/uploads">
    <mat-icon>upload_file</mat-icon>
    <span>Uploads</span>
  </a>
</li>
```

### 7. Module Registration

**File**: `src/app/app.module.ts` (already updated)

Add to declarations:
```typescript
PublicUploadComponent,
AdminUserUploadsComponent,
```

---

## Firebase Requirements

### Database Paths

| Path | Read | Write | Auth |
|------|------|-------|------|
| `/userUploads/{id}` | Public (anyone) | Public (anyone) | None |
| `/photoAlbums/{id}` | Public | Admin only | Auth required |
| `/photos/{id}` | Public | Admin only | Auth required |

### Security Rules

**Realtime Database** (set in Firebase Console):
```json
{
  "rules": {
    "userUploads": {
      ".read": true,
      ".write": true
    },
    "photoAlbums": {
      ".read": true,
      ".write": "auth != null"
    },
    "photos": {
      ".read": true,
      ".write": "auth != null"
    },
    "$other": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

**Firebase Storage** (set in Firebase Console):

Rules must allow:
1. Public read/write to `userUploads/**`
2. Authenticated (admin) write to `photos/**`
3. Public read on `photos/**` for displaying approved photos

```rules
rules_version = '2';
service firebase.storage {
  match /b/lecoursville.appspot.com/o {
    match /userUploads/{allPaths} {
      allow read: if true;
      allow write: if true;
    }
    match /photos/{allPaths} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /{bucket}/{allPaths} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### Storage Paths

| Operation | Storage Path |
|-----------|-------------|
| Guest upload destination | `userUploads/{uploadId}/{fileName}` |
| Approved copy destination | `photos/{uploadId}/{fileName}` |
| Video screenshots | `videoScreenshots/{id}.{ext}` |
| Existing photos | `photos/{photoId}.{ext}` |

### Auth Context

- `/upload` — no auth, public
- `/admin/uploads` — requires `AuthAdminGuardService` (admin role check)

---

## Production Risks & Mitigations

1. **Risk**: Firebase Storage `copyTo()` operation fails (e.g., network timeout, permissions issue). **Mitigation**: Error is caught in `approveUpload()`, logged to console, and re-thrown. Upload remains in `'pending'` status so admin can retry. Admin UI shows no explicit error message — console logs are available for debugging.

2. **Risk**: Guest uploads a file with the same name as an existing upload. **Mitigation**: Each upload gets a unique push ID regardless of filename. No collision is possible.

3. **Risk**: Guest uploads an extremely large file (approaching 5GB Firebase limit). **Mitigation**: Client-side file size validation not implemented in this spec. Firebase SDK handles chunking. Large uploads may take a long time on slow connections but will complete or retry without data loss.

4. **Risk**: Firebase Storage delete fails after copy succeeds during approval. **Mitigation**: The original file remains in `userUploads/` with status `'pending'`. Admin can retry approval or manually clean up via Firebase Console.

5. **Risk**: Concurrent approval of the same upload by two admins. **Mitigation**: Not handled in this spec. Assumes single-admin environment or acceptable duplicate processing.

6. **Risk**: RTDB write for PhotoAlbum creation fails after storage copy succeeds. **Mitigation**: Status is updated to `'approved'` only after PhotoAlbum is created. If PhotoAlbum write fails, the exception propagates and status stays `'pending'`.

7. **Risk**: PhotoAlbum created with `suggestedEvent` but the event name is empty or very generic ("Untitled Event"). **Mitigation**: This is acceptable — admin can edit PhotoAlbum title later through admin UI if one exists, or accept the generic name.

---

## Rollout Plan

1. Ensure Firebase Storage and RTDB rules are set per Firebase Requirements section.
2. Deploy the Angular app to Firebase Hosting (or run locally with `ng serve` for testing).
3. Navigate to `/upload` as an unauthenticated user — confirm upload form renders.
4. Upload a test image with an event suggestion.
5. Verify in Firebase Console: file exists in `userUploads/` Storage bucket and RTDB entry has `status: 'pending'`.
6. Navigate to `/admin/uploads` as admin — confirm pending upload appears with preview.
7. Click Approve — confirm file copied to `photos/`, PhotoAlbum created in RTDB, original deleted from `userUploads/`, RTDB entry updated to `status: 'approved'`.
8. Test Reject — upload another file, click Reject, confirm file deleted from storage and RTDB entry removed.
9. Test QR code flow: generate QR code pointing to the upload URL, scan with a mobile device, confirm upload works.

---

## Test Plan

No test files are required for this implementation per user direction.

If tests were to be written, the following cases would be covered:

### UserUploadService (`user-upload.service.spec.ts`)

1. `uploadFile()` calls `storage.upload()` with correct path `userUploads/{pushId}/{fileName}`.
2. `uploadFile()` returns an object with `task` (AngularFireUploadTask) and `uploadId` (string).
3. `uploadFile()` subscribes to `task.snapshotChanges()` and saves metadata to RTDB on finalize.
4. `approveUpload()` calls `storage.storage.refFromURL().copyTo()` then `.delete()`.
5. `approveUpload()` creates a PhotoAlbum entry in RTDB at `photoAlbums/{uploadId}`.
6. `approveUpload()` updates the upload status to `'approved'` in RTDB.
7. `rejectUpload()` calls `storage.storage.refFromURL().delete()` and `db.list().remove()`.
8. `subscribeToAllUploads()` calls the callback with upload array when RTDB data changes.
9. Error during `approveUpload()` is caught, logged, and re-thrown (upload stays `'pending'`).

### PublicUploadComponent (`public-upload.component.spec.ts`)

1. Renders drop-zone and file input elements.
2. Adding files updates `uploadItems` array with correct file entries.
3. Entering an event name updates `suggestedEvent` property.
4. `startUpload()` calls `userUploadService.uploadFile()` with correct arguments.
5. Upload progress updates `uploadItems` via `task.percentageChanges()` subscription.
6. Completion sets `isComplete = true` and shows success message.
7. `clearAll()` resets `uploadItems` and `suggestedEvent`.
8. `reset()` resets `uploadItems`, `isComplete`, and `suggestedEvent`.

### AdminUserUploadsComponent (`admin-user-uploads.component.spec.ts`)

1. On init, subscribes to `userUploadService.allUploads$`.
2. `filteredUploads` returns only pending uploads when `filterStatus === 'pending'`.
3. `pendingCount` returns correct count of pending uploads.
4. `onApprove()` calls `userUploadService.approveUpload()` and adds ID to `processingIds`.
5. `onApprove()` removes ID from `processingIds` in finally block.
6. `onReject()` calls `userUploadService.rejectUpload()` and adds ID to `processingIds`.
7. `onReject()` removes ID from `processingIds` in finally block.
8. `isProcessing()` returns `true` for IDs in `processingIds`.
9. Approve button is disabled when `upload.status !== 'pending'`.
10. Reject button is disabled when `isProcessing(id)` is `true`.
11. `formatFileSize()` returns human-readable strings for B, KB, MB.

---

## Summary of Changes

All implementation has been completed in the feature branch. The following files were created or modified:

### New Files

- `src/app/models/user-upload.ts` — UserUpload model with UploadStatus type and UploaderInfo interface
- `src/app/services/user-upload.service.ts` — Service with uploadFile, approveUpload, rejectUpload, subscribeToAllUploads, subscribeToPendingUploads methods
- `src/app/components/admin-user-uploads/admin-user-uploads.component.ts` — Admin review component with approve/reject/preview
- `src/app/components/admin-user-uploads/admin-user-uploads.component.html` — Template with filter bar, upload rows, empty state
- `src/app/components/admin-user-uploads/admin-user-uploads.component.scss` — Styles for admin upload list

### Modified Files

- `src/app/services/photos.service.ts` — Changed `this.user?.id || 'anonymous'` (line 97) and uncommented RTDB write at line 110
- `src/app/components/public-upload/public-upload.component.ts` — Replaced PhotosService with UserUploadService, added suggestedEvent field
- `src/app/components/public-upload/public-upload.component.html` — Added event name input field, updated success message
- `src/app/components/public-upload/public-upload.component.scss` — Added .event-input and .hint styles
- `src/app/app-routing.module.ts` — Added /admin/uploads route, added import for AdminUserUploadsComponent
- `src/app/app.module.ts` — Added PublicUploadComponent and AdminUserUploadsComponent to declarations
- `src/app/components/admin/admin.component.html` — Added Uploads nav item

### Firebase (Console Configuration Required)

- **RTDB rules**: Add `userUploads` node with `.read: true, .write: true`
- **Storage rules**: Allow public read/write to `userUploads/**`, authenticated write to `photos/**`

### Verification Checklist

- [ ] Guest can navigate to `/upload` with no authentication
- [ ] Guest can select files and see them in the file list
- [ ] Guest can enter an optional event name suggestion
- [ ] Files upload to `userUploads/{id}/{filename}` in Firebase Storage
- [ ] RTDB entry created at `/userUploads/{id}` with `status: 'pending'`
- [ ] Admin can navigate to `/admin/uploads`
- [ ] Pending uploads appear in the admin list with thumbnail preview
- [ ] Admin can click Approve and the file is copied to `photos/`, PhotoAlbum is created, original deleted
- [ ] Admin can click Reject and the file and RTDB entry are deleted
- [ ] Filter toggle between "Pending" and "All" works
- [ ] Progress indicators show during upload
- [ ] Completion message reflects submission for review

---

## Verification

1. **Local dev**: `ng serve` — navigate to `http://localhost:4200/upload` as guest, `http://localhost:4200/admin/uploads` as admin.
2. **Firebase Console**: Verify Storage buckets and RTDB entries after uploads.
3. **QR code test**: Generate QR with `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://lecoursville-dev.web.app/upload` and scan with mobile device.

---

## Open Questions

None — all decisions resolved during clarification rounds.