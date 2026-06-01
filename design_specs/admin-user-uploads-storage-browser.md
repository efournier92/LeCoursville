# Agent Design Spec: Admin User Uploads — Storage Browser

## Branch & Directories

- **Base directory**: `/Users/e/mnt/bnk/cs/lecoursville`
- **Frontend**: Angular 15 SPA at `src/app/`
- **Firebase Backend**: Realtime Database + Firebase Storage (dev + prod separate projects)

---

## Context & Motivation

The existing `AdminUserUploadsComponent` at `src/app/components/admin-user-uploads/` shows a flat list of uploads from Firebase RTDB, with approve/reject actions. It has no visibility into the actual Firebase Storage directory structure. Admins need to browse the physical folders in Firebase Storage (both `userUploads/` for pending uploads and `photos/` for approved uploads), see what files live in each folder, and download any folder as a ZIP for archival or review purposes.

This creates a Storage Browser tab alongside the existing Pending/All filter, without modifying the approval flow or PhotoAlbum model (both deferred).

---

## Glossary

- **Storage Browser**: The new tab in AdminUserUploadsComponent that lists Firebase Storage directories as virtual folders.
- **userUploads/**: Firebase Storage path prefix `userUploads/{batchName}/{files}` — holds pending uploads organized by batch folder name.
- **photos/**: Firebase Storage path prefix `photos/{batchName}/{files}` — holds approved uploads organized by the same batch folder naming scheme.
- **batchName**: The folder name under both `userUploads/` and `photos/` that groups files from a single upload session (e.g., `SummerPicnic_JohnDoe_2026-05-25-143022`).
- **JSZip**: Client-side ZIP generation library. Used to package multiple files from a storage folder into a single downloadable ZIP.

---

## Current State

### AdminUserUploadsComponent

**File**: `src/app/components/admin-user-uploads/admin-user-uploads.component.ts` (lines 1-82)

The component currently has:
- `allUploads: UserUpload[]` — loaded from RTDB via `userUploadService.subscribeToAllUploads()`
- `processingIds: Set<string>` — tracks in-flight approve/reject operations
- `previewUpload: UserUpload | null` — upload shown in dialog
- `filterStatus: 'pending' | 'all'` — toggles between pending-only and all uploads

The template uses a `mat-button-toggle-group` with two options: "Pending" and "All". The component never makes direct Firebase Storage calls — all data flows through `UserUploadService`.

### UserUploadService

**File**: `src/app/services/user-upload.service.ts` (lines 1-164)

Storage paths used:
- `userUploads/{folderName}/{fileName}` — upload destination
- `photos/{folderName}/{fileName}` — approved copy destination

The service uses `AngularFireStorage` (injected) and accesses the native `storage` SDK via `.storage` property for `copyTo()` and `delete()` operations.

### PhotoAlbum Model

**File**: `src/app/models/media/photo-album.ts` (lines 1-43)

No changes to this model are required by this spec.

### Existing Tab Pattern

**File**: `src/app/components/admin-user-uploads/admin-user-uploads.component.html` (lines 19-27)

The filter bar uses `mat-button-toggle-group` with two toggles. This pattern will be reused for the new three-tab UI (Pending, All, Storage Browser).

---

## Goals

1. Admins can switch to a "Storage Browser" tab in AdminUserUploadsComponent.
2. The browser lists all folder names under `userUploads/` (pending batches) and `photos/` (approved batches) as clickable rows.
3. Folders are grouped under two section headers: "Pending Uploads (userUploads)" and "Approved Uploads (photos)".
4. Each folder row shows: folder name, file count, and a ZIP download button.
5. Clicking a folder row opens an inner file browser showing all files in that folder.
6. The file browser shows: file icon/thumbnail (image preview or generic icon), filename, and file size.
7. Breadcrumb navigation ("← Back to folders") lets the admin return from a file browser to the folder list.
8. The ZIP download fetches all files in the selected folder and packages them into a ZIP downloaded via the browser.
9. The ZIP operation shows a progress indicator while fetching and packaging files.
10. The existing Pending/All tabs continue to work without modification.

---

## Non-Goals

1. No bulk approve/reject from the Storage Browser — use the Pending/All tabs for moderation actions.
2. No file deletion or move operations from the Storage Browser.
3. No PhotoAlbum consolidation or "Copy to Album" feature — deferred per user direction.
4. No folder renaming or creation from the admin UI.
5. No drag-and-drop file organization.

---

## Prerequisites

- `AngularFireStorage` is already injected in `UserUploadService` and available component-side via DI.
- `AuthAdminGuardService` already protects the `/admin/uploads` route.
- `AdminUserUploadsComponent` already exists with its template and styles.
- `UserUploadService` already uses `AngularFireStorage` for file operations.
- Firebase Storage rules allow admin listing and reading of `userUploads/` and `photos/` paths.

---

## Design Principles

1. Use the Firebase Storage JS SDK (via `AngularFireStorage.storage`) for `list()` and `getBlob()` operations — not AngularFire wrappers.
2. Folder listing uses `storage.ref(path).list({ maxResults: 100 })` with pagination token support.
3. File preview uses `storage.ref(path).getDownloadURL()` for images, shown inline.
4. ZIP generation uses JSZip — fetched as blobs, added to zip, then trigger browser download via `URL.createObjectURL()`.
5. State is held in component properties — no new services required.
6. Follow existing component patterns: `OnInit`, `OnDestroy` for subscription cleanup, `Set<string>` for tracking in-flight operations.
7. Use Angular Material components already imported: `MatButtonToggleModule`, `MatCardModule`.
8. Use `MatIcon` (already available via Material Icons) for folder, file, download, and back icons.

---

## Front End Requirements

### 1. Component Changes — AdminUserUploadsComponent

**File**: `src/app/components/admin-user-uploads/admin-user-uploads.component.ts`

**Imports to add**:
```typescript
import { AngularFireStorage } from '@angular/fire/compat/storage';
import * as JSZip from 'jszip';
```

**New component properties** (after existing properties, around line 18):
```typescript
// Storage Browser tab
storageBrowserTab: 'list' | 'files' = 'list'; // 'list' = folder list, 'files' = file browser
selectedSection: 'userUploads' | 'photos' | null = null; // which storage path is active
pendingFolders: StorageFolder[] = []; // folders in userUploads/
approvedFolders: StorageFolder[] = []; // folders in photos/
currentFolderFiles: StorageFile[] = [];
currentFolderPath: string = '';
breadcrumbPath: string = ''; // e.g. "userUploads / SummerPicnic_JohnDoe_2026-05-25"
zipDownloadingFolder: string | null = null; // folder name currently being zipped
isLoadingFolders: boolean = false;
folderError: string | null = null;
```

**New interfaces** (add above component class):
```typescript
interface StorageFolder {
  name: string;        // folder name (last path segment)
  fullPath: string;    // full storage path e.g. "userUploads/SummerPicnic_JohnDoe_2026-05-25"
  fileCount: number;
  section: 'userUploads' | 'photos';
}

interface StorageFile {
  name: string;
  fullPath: string;
  size: number;        // bytes, from listItem metadata
  contentType: string;
  downloadUrl: string | null; // populated on demand for preview
  isImage: boolean;
}
```

**New methods** to add (inside component class):

```typescript
switchToStorageBrowser(): void {
  this.storageBrowserTab = 'list';
  this.loadFolders();
}

loadFolders(): void {
  this.isLoadingFolders = true;
  this.folderError = null;
  this.pendingFolders = [];
  this.approvedFolders = [];

  // Load userUploads folders
  this.loadFolderSection('userUploads').then(() => {
    // Load photos folders
    return this.loadFolderSection('photos');
  }).finally(() => {
    this.isLoadingFolders = false;
  });
}

private async loadFolderSection(section: 'userUploads' | 'photos'): Promise<void> {
  const storageRef = this.afStorage.storage.ref(section);
  try {
    const result = await storageRef.list({ maxResults: 100 }).next();
    const folders: StorageFolder[] = result.prefixes.map(prefix => ({
      name: this.getFolderNameFromPath(prefix.fullPath),
      fullPath: prefix.fullPath,
      fileCount: 0, // estimated or deferred
      section,
    }));
    // Get file counts per folder by checking each prefix
    await Promise.all(folders.map(async f => {
      try {
        const files = await storageRef.child(f.name).list({ maxResults: 1 }).next();
        f.fileCount = files.items.length;
      } catch {
        f.fileCount = 0;
      }
    }));
    if (section === 'userUploads') {
      this.pendingFolders = folders;
    } else {
      this.approvedFolders = folders;
    }
  } catch (error) {
    console.error(`Failed to list ${section}:`, error);
    this.folderError = `Failed to load ${section} folders. Check storage rules.`;
  }
}

private getFolderNameFromPath(fullPath: string): string {
  const parts = fullPath.split('/');
  return parts[parts.length - 1];
}

async onFolderClick(folder: StorageFolder): Promise<void> {
  this.selectedSection = folder.section;
  this.currentFolderPath = folder.fullPath;
  this.breadcrumbPath = `${folder.section} / ${folder.name}`;
  this.storageBrowserTab = 'files';
  await this.loadFilesInFolder(folder.fullPath);
}

async loadFilesInFolder(fullPath: string): Promise<void> {
  this.currentFolderFiles = [];
  const storageRef = this.afStorage.storage.ref(fullPath);
  try {
    const result = await storageRef.list({ maxResults: 200 });
    const files: StorageFile[] = result.items.map(item => ({
      name: item.name,
      fullPath: item.fullPath,
      size: 0,
      contentType: '',
      downloadUrl: null,
      isImage: item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) !== null,
    }));
    // Load download URLs and sizes for images (defer for non-images)
    await Promise.all(files.map(async (file) => {
      try {
        const [url] = await file.ref.getDownloadURL();
        file.downloadUrl = url;
      } catch {
        file.downloadUrl = null;
      }
      try {
        const metadata = await file.ref.getMetadata();
        file.size = metadata.size;
        file.contentType = metadata.contentType || '';
      } catch {
        file.size = 0;
      }
    }));
    this.currentFolderFiles = files;
  } catch (error) {
    console.error('Failed to list files:', error);
  }
}

backToFolderList(): void {
  this.storageBrowserTab = 'list';
  this.currentFolderFiles = [];
  this.currentFolderPath = '';
  this.breadcrumbPath = '';
  this.selectedSection = null;
}

async downloadFolderAsZip(folder: StorageFolder): Promise<void> {
  this.zipDownloadingFolder = folder.name;
  const zip = new JSZip();
  const storageRef = this.afStorage.storage.ref(folder.fullPath);

  try {
    const result = await storageRef.list({ maxResults: 500 });
    const files = result.items;

    // Fetch all blobs in parallel
    const blobResults = await Promise.all(
      files.map(async (item) => {
        try {
          const blob = await item.getBlob();
          return { name: item.name, blob };
        } catch (error) {
          console.warn(`Failed to fetch ${item.name}:`, error);
          return null;
        }
      })
    );

    // Add successful fetches to zip
    for (const r of blobResults) {
      if (r) {
        zip.folder(folder.name)?.file(r.name, r.blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${folder.name}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('ZIP download failed:', error);
    alert('Failed to generate ZIP. Check browser console for details.');
  } finally {
    this.zipDownloadingFolder = null;
  }
}

formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

getFolderIcon(folder: StorageFolder): string {
  return folder.section === 'userUploads' ? 'hourglass_empty' : 'check_circle';
}

getSectionIcon(section: 'userUploads' | 'photos'): string {
  return section === 'userUploads' ? 'hourglass_empty' : 'check_circle';
}
```

**Existing method updates**:
- `formatFileSize()` already exists at line 73 — no change needed.

**Add to constructor**:
```typescript
constructor(
  private userUploadService: UserUploadService,
  private afStorage: AngularFireStorage,  // add AngularFireStorage
) {}
```

**OnDestroy**: Add `ngOnDestroy()` to clean up any active subscriptions (none currently added, but pattern should be present).

### 2. Template Changes

**File**: `src/app/components/admin-user-uploads/admin-user-uploads.component.html`

**Replace the filter bar** (lines 18-27) with a three-tab toggle:

```html
<div class="filter-bar">
  <mat-button-toggle-group [(value)]="filterStatus" (change)="onFilterChange($event.value)">
    <mat-button-toggle value="pending">
      Pending
    </mat-button-toggle>
    <mat-button-toggle value="all">
      All
    </mat-button-toggle>
    <mat-button-toggle value="browser" (click)="switchToStorageBrowser()">
      Storage Browser
    </mat-button-toggle>
  </mat-button-toggle-group>
</div>
```

**Add below the filter bar** — replace the existing uploads-list with a conditional:

```html
<!-- Existing Pending/All list (shown when filterStatus is 'pending' or 'all') -->
<div class="uploads-list" *ngIf="filterStatus !== 'browser' && filteredUploads.length > 0">
  ...existing upload rows...
</div>

<!-- Storage Browser: Folder List (shown when storageBrowserTab === 'list') -->
<div class="storage-browser" *ngIf="filterStatus === 'browser' && storageBrowserTab === 'list'">

  <!-- Loading state -->
  <div class="browser-loading" *ngIf="isLoadingFolders">
    <mat-icon>sync</mat-icon>
    <p>Loading folders...</p>
  </div>

  <!-- Error state -->
  <div class="browser-error" *ngIf="folderError">
    <mat-icon>error_outline</mat-icon>
    <p>{{ folderError }}</p>
    <button mat-button (click)="loadFolders()">Retry</button>
  </div>

  <!-- Pending Uploads Section -->
  <div class="folder-section" *ngIf="!isLoadingFolders && pendingFolders.length > 0">
    <div class="section-header">
      <mat-icon>hourglass_empty</mat-icon>
      <span>Pending Uploads (userUploads)</span>
      <span class="folder-count">{{ pendingFolders.length }}</span>
    </div>
    <div class="folder-list">
      <div class="folder-row" *ngFor="let folder of pendingFolders" (click)="onFolderClick(folder)">
        <mat-icon class="folder-icon">folder</mat-icon>
        <div class="folder-info">
          <div class="folder-name">{{ folder.name }}</div>
          <div class="folder-meta">{{ folder.fileCount }} files</div>
        </div>
        <button mat-icon-button
                matTooltip="Download as ZIP"
                [disabled]="zipDownloadingFolder === folder.name"
                (click)="downloadFolderAsZip(folder); $event.stopPropagation()">
          <mat-icon *ngIf="zipDownloadingFolder !== folder.name">zip_download</mat-icon>
          <mat-icon *ngIf="zipDownloadingFolder === folder.name">sync</mat-icon>
        </button>
      </div>
    </div>
  </div>

  <!-- Approved Uploads Section -->
  <div class="folder-section" *ngIf="!isLoadingFolders && approvedFolders.length > 0">
    <div class="section-header">
      <mat-icon>check_circle</mat-icon>
      <span>Approved Uploads (photos)</span>
      <span class="folder-count">{{ approvedFolders.length }}</span>
    </div>
    <div class="folder-list">
      <div class="folder-row" *ngFor="let folder of approvedFolders" (click)="onFolderClick(folder)">
        <mat-icon class="folder-icon">folder</mat-icon>
        <div class="folder-info">
          <div class="folder-name">{{ folder.name }}</div>
          <div class="folder-meta">{{ folder.fileCount }} files</div>
        </div>
        <button mat-icon-button
                matTooltip="Download as ZIP"
                [disabled]="zipDownloadingFolder === folder.name"
                (click)="downloadFolderAsZip(folder); $event.stopPropagation()">
          <mat-icon *ngIf="zipDownloadingFolder !== folder.name">zip_download</mat-icon>
          <mat-icon *ngIf="zipDownloadingFolder === folder.name">sync</mat-icon>
        </button>
      </div>
    </div>
  </div>

  <!-- Empty state -->
  <div class="empty-state" *ngIf="!isLoadingFolders && pendingFolders.length === 0 && approvedFolders.length === 0">
    <mat-icon>folder_open</mat-icon>
    <p>No upload folders found</p>
  </div>
</div>

<!-- Storage Browser: File List (shown when storageBrowserTab === 'files') -->
<div class="file-browser" *ngIf="filterStatus === 'browser' && storageBrowserTab === 'files'">
  <div class="breadcrumb">
    <button mat-button (click)="backToFolderList()">
      <mat-icon>arrow_back</mat-icon>
      Back to folders
    </button>
    <span class="breadcrumb-path">{{ breadcrumbPath }}</span>
  </div>

  <div class="files-grid" *ngIf="currentFolderFiles.length > 0">
    <div class="file-card" *ngFor="let file of currentFolderFiles">
      <div class="file-thumbnail">
        <img *ngIf="file.isImage && file.downloadUrl" [src]="file.downloadUrl" [alt]="file.name" />
        <mat-icon *ngIf="!file.isImage || !file.downloadUrl">insert_drive_file</mat-icon>
      </div>
      <div class="file-name" [matTooltip]="file.name">{{ file.name }}</div>
      <div class="file-size">{{ formatFileSize(file.size) }}</div>
    </div>
  </div>

  <div class="empty-state" *ngIf="currentFolderFiles.length === 0">
    <mat-icon>folder_open</mat-icon>
    <p>This folder is empty</p>
  </div>
</div>
```

### 3. Style Changes

**File**: `src/app/components/admin-user-uploads/admin-user-uploads.component.scss`

**Add after existing styles** (append before closing `}`):

```scss
// Storage Browser
.storage-browser {
  padding: 0;
}

.browser-loading,
.browser-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #666;

  mat-icon {
    font-size: 48px;
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
  }

  p {
    margin: 0;
    font-size: 16px;
  }
}

.browser-error {
  color: #c62828;
}

.folder-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-weight: 500;
  font-size: 14px;
  color: #333;

  mat-icon {
    font-size: 20px;
    width: 20px;
    height: 20px;
    color: #666;
  }

  .folder-count {
    margin-left: auto;
    background: #e0e0e0;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    color: #666;
  }
}

.folder-list {
  display: flex;
  flex-direction: column;
}

.folder-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.15s ease;

  &:hover {
    background: #fafafa;
  }

  .folder-icon {
    color: #ffa726;
    flex-shrink: 0;
  }

  .folder-info {
    flex: 1;
    min-width: 0;
  }

  .folder-name {
    font-weight: 500;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }

  .folder-meta {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
  }
}

// File Browser
.file-browser {
  padding: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;

  button {
    mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  }

  .breadcrumb-path {
    font-size: 13px;
    color: #666;
    font-family: monospace;
  }
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
  padding: 16px;
}

.file-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .file-thumbnail {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #ccc;
    }
  }

  .file-name {
    font-size: 12px;
    color: #333;
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
  }
}
```

### 4. Package Dependency

**File**: `src/package.json` (verify and add if missing)

Check for `jszip` in dependencies. If not present, add:
```json
"jszip": "^3.10.1"
```

Run `npm install jszip` to install. The import in the component uses `import * as JSZip from 'jszip'` which is the default JSZip import style.

---

## Firebase Requirements

### Storage Operations Used

| Operation | Firebase Storage Path | Auth |
|-----------|----------------------|------|
| List folders (prefixes) | `userUploads/` and `photos/` | Admin auth |
| List files in folder | `userUploads/{folderName}` and `photos/{folderName}` | Admin auth |
| Get file blob | `userUploads/{folderName}/{fileName}` and `photos/{folderName}/{fileName}` | Admin auth |
| Get download URL | Same as above | Admin auth |

### Storage Rules Required

```rules
rules_version = '2';
service firebase.storage {
  match /b/lecoursville.appspot.com/o {
    // userUploads — already fully open, list + read + write
    match /userUploads/{allPaths} {
      allow read: if true;
      allow write: if true;
    }
    // photos — admin needs list (prefixes) and read access
    match /photos/{allPaths} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /{bucket}/{allPaths} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

The `list()` operation (which returns prefixes for folder navigation) requires read permission. Ensure the storage rules for `photos/` allow `request.auth != null` for list operations.

---

## Production Risks & Mitigations

1. **Risk**: Firebase Storage `list()` returns a paginated result set. If a user has hundreds of folders, only the first 100 are shown. **Mitigation**: Use `next()` token to handle pagination if needed. For initial release, 100 folders should be sufficient. Add "Load more" if the 100-limit becomes a problem.

2. **Risk**: ZIP download fails for large folders (many files or large file sizes) due to browser memory limits. **Mitigation**: Show warning for folders with more than 50 files. Fetch files sequentially for large batches to avoid overwhelming the browser.

3. **Risk**: `getBlob()` for a file in Firebase Storage fails (file deleted externally, permissions changed). The ZIP should still complete with the files it managed to fetch. **Mitigation**: Individual file fetch failures are caught and skipped with a `console.warn`. ZIP still generated with successful files.

4. **Risk**: `listAll()` on a very large folder times out. **Mitigation**: Use `list({ maxResults: 200 })` with explicit limits rather than `listAll()`. Catch errors and show user-friendly message.

5. **Risk**: Storage rules for `photos/` do not allow list operation — the folder browser would show empty results. **Mitigation**: Document the required rules change clearly. Add error detection: if both sections return 0 folders with no error, show a notice about checking storage rules.

---

## Rollout Plan

1. Add `jszip` to `package.json` and run `npm install`.
2. Update `admin-user-uploads.component.ts` with Storage Browser properties, interfaces, and methods.
3. Update `admin-user-uploads.component.html` with the new tab toggle and browser UI.
4. Update `admin-user-uploads.component.scss` with browser styles.
5. Update Firebase Storage rules in Firebase Console to allow `photos/` list operations for authenticated users.
6. Run `ng serve` and verify the Storage Browser tab loads, shows folders, allows file browsing, and produces working ZIP downloads.
7. Test with both empty folder and large folder scenarios.

---

## Test Plan

### Component: AdminUserUploadsComponent

**Spec file**: `src/app/components/admin-user-uploads/admin-user-uploads.component.spec.ts`

**New test cases**:

1. `switchToStorageBrowser()` sets `storageBrowserTab = 'list'` and calls `loadFolders()`.
2. `loadFolders()` sets `isLoadingFolders = true` while loading, then false after completion.
3. `loadFolders()` populates `pendingFolders` from `userUploads/` prefix list.
4. `loadFolders()` populates `approvedFolders` from `photos/` prefix list.
5. `onFolderClick(folder)` sets `storageBrowserTab = 'files'`, sets `breadcrumbPath`, and calls `loadFilesInFolder()`.
6. `loadFilesInFolder(path)` populates `currentFolderFiles` with StorageFile objects.
7. `backToFolderList()` resets `storageBrowserTab` to `'list'` and clears file state.
8. `downloadFolderAsZip(folder)` sets `zipDownloadingFolder`, generates ZIP, triggers download, clears `zipDownloadingFolder` in finally.
9. `downloadFolderAsZip()` handles individual file fetch failures gracefully (continues with other files).
10. `formatFileSize()` returns correct strings for B, KB, MB.
11. `getFolderIcon()` returns `'hourglass_empty'` for userUploads, `'check_circle'` for photos.
12. Tab toggle in template shows folder list when `storageBrowserTab === 'list'` and file browser when `'files'`.
13. Folder rows show correct folder name, file count, and section icon.
14. File cards show image thumbnail when `file.isImage && file.downloadUrl`, else generic icon.
15. Breadcrumb shows correct path when a folder is selected.
16. ZIP download button is disabled while `zipDownloadingFolder === folder.name`.

### Integration (no Firebase mock available):

The Storage Browser relies on live Firebase Storage calls which cannot be easily mocked in unit tests. The test spec should:
- Verify the component renders without errors (no `null` reference on storage calls)
- Verify the tab toggle switches correctly between views
- Verify `formatFileSize()` utility with known inputs

---

## Summary of Changes

### Modified Files

- `src/app/components/admin-user-uploads/admin-user-uploads.component.ts` — Add AngularFireStorage injection, StorageBrowser tab state, folder listing methods, file browser methods, ZIP download method, StorageFolder and StorageFile interfaces
- `src/app/components/admin-user-uploads/admin-user-uploads.component.html` — Replace filter bar with 3-tab toggle (Pending/All/Storage Browser), add Storage Browser folder list and file browser templates
- `src/app/components/admin-user-uploads/admin-user-uploads.component.scss` — Add styles for folder list, folder rows, section headers, file browser, breadcrumb, file cards, loading/error/empty states

### New Dependency

- `package.json` — add `jszip: ^3.10.1`

### Firebase Console (Manual)

- **Storage rules**: Update `photos/` rule to allow `list` operations for authenticated users (add explicit `allow list: if request.auth != null`)

---

## Verification

1. **Local dev**: `ng serve` — navigate to `/admin/uploads` as admin. Click "Storage Browser" tab. Verify folders appear under both sections (userUploads and photos). Click a folder to see files. Click back to return to folder list. Click ZIP button on a folder to trigger download.
2. **Empty state**: If no folders exist, verify the empty state message appears.
3. **Error state**: If Firebase storage rules are missing, verify the error message appears with a Retry button.
4. **ZIP contents**: Open the downloaded ZIP and verify it contains the correct files with correct names.
5. **Large folder**: Find or create a folder with 20+ files and verify ZIP downloads without crashing the browser.

---

## Open Questions

None — all decisions resolved during spec clarification.