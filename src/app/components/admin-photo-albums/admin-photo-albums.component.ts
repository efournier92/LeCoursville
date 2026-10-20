import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { Photo } from 'src/app/models/photo';
import { PhotoAlbum } from 'src/app/models/photo-album';
import { paginate, Page } from 'src/app/admin/pagination';
import { NoResultsMessageComponent } from 'src/app/components/no-results-message/no-results-message.component';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';
import { PageToolbarComponent } from 'src/app/components/shared/page-toolbar/page-toolbar.component';
import { PhotoUploadProgressComponent } from 'src/app/components/photo-upload-progress/photo-upload-progress.component';
import { PhotoAlbumsService } from 'src/app/services/photo-albums.service';
import { PhotosService, PhotoUpload } from 'src/app/services/photos.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import {
  AdminPhotoAlbumUploadDialogComponent,
  AdminPhotoAlbumUploadDialogData,
  AdminPhotoAlbumUploadDialogResult,
} from '../admin-photo-album-upload-dialog/admin-photo-album-upload-dialog.component';
import { PhotoAlbumEditDialogComponent } from '../photo-album-edit-dialog/photo-album-edit-dialog.component';

@Component({
    selector: 'app-admin-photo-albums',
    templateUrl: './admin-photo-albums.component.html',
    styleUrls: ['./admin-photo-albums.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NoResultsMessageComponent,
    LvLoadErrorComponent,
    PageToolbarComponent,
    PhotoUploadProgressComponent
]
})
export class AdminPhotoAlbumsComponent implements OnInit, OnDestroy {
  @ViewChild('folderInput') folderInput?: ElementRef<HTMLInputElement>;

  albums: PhotoAlbum[] = [];
  photos: Photo[] = [];
  photoCounts: { [albumId: string]: number } = {};
  searchTerm = '';
  sortType: 'recent' | 'title' = 'recent';
  status: 'loading' | 'error' | 'ready' = 'loading';
  page = 1;
  readonly pageSize = 12;
  skeletonIterations = [1, 2, 3, 4, 5, 6];

  editingAlbumId: string | null = null;
  editingTitle = '';

  // Per-album photo management (drill-in panel)
  selectedAlbum: PhotoAlbum | null = null;
  selectedAlbumPhotos: Photo[] = [];
  editingPhotoId: string | null = null;
  editDraft: Photo | null = null;

  activeUploads: { upload: PhotoUpload; file: File }[] = [];
  private currentUploadAlbumId: string | null = null;
  private firstUploadedPhotoId: string | null = null;

  isDragOver = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private photoAlbumsService: PhotoAlbumsService,
    private photosService: PhotosService,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    private analyticsService: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.loadAlbums();

    this.subscriptions.push(
      this.photosService.nonMessagePhotos$.subscribe(photos => {
        this.photos = photos || [];
        this.recomputePhotoCounts();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private loadAlbums(): void {
    this.subscriptions.push(
      this.photoAlbumsService.albums$.subscribe(albums => {
        // null is the service's not-yet-loaded seed; only a real snapshot
        // (even an empty one) resolves the page.
        if (albums === null) {
          return;
        }
        this.albums = albums || [];
        this.recomputePhotoCounts();
        this.status = 'ready';
      }, () => {
        this.status = 'error';
      }),
    );
  }

  onRetry(): void {
    this.status = 'loading';
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
    this.loadAlbums();
    this.subscriptions.push(
      this.photosService.nonMessagePhotos$.subscribe(photos => {
        this.photos = photos || [];
        this.recomputePhotoCounts();
      }),
    );
  }

  private recomputePhotoCounts(): void {
    const next: { [albumId: string]: number } = {};
    for (const album of this.albums) {
      next[album.id] = this.photos.filter(p => p.albumId === album.id).length;
    }
    this.photoCounts = next;
  }

  getFilteredAlbums(): PhotoAlbum[] {
    const term = this.searchTerm.trim().toLowerCase();
    let result = this.albums.filter(album => {
      if (!term) {
        return true;
      }
      return album.title.toLowerCase().includes(term);
    });
    if (this.sortType === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result = [...result].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return result;
  }

  get pageData(): Page<PhotoAlbum> {
    return paginate(this.getFilteredAlbums(), this.page, this.pageSize);
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.page = 1;
  }

  onSortChange(sort: 'recent' | 'title'): void {
    this.sortType = sort;
    this.page = 1;
  }

  nextPage(): void {
    this.page = Math.min(this.page + 1, this.pageData.pageCount);
  }

  prevPage(): void {
    this.page = Math.max(this.page - 1, 1);
  }

  getPhotoCount(album: PhotoAlbum): number {
    return this.photoCounts[album.id] || 0;
  }

  getCoverUrl(album: PhotoAlbum): string | null {
    if (album.coverPhotoId) {
      const cover = this.photos.find(p => p.id === album.coverPhotoId);
      if (cover?.url) {
        return cover.url;
      }
    }
    const first = this.photos.find(p => p.albumId === album.id && p.url);
    return first?.url || null;
  }

  onUploadClick(): void {
    this.folderInput?.nativeElement.click();
  }

  onFolderPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const files = this.filterImageFiles(Array.from(input.files));
    this.openUploadDialog(files);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const dt = event.dataTransfer;
    if (!dt) {
      return;
    }
    this.collectFilesFromDataTransfer(dt.items, files => {
      const filtered = this.filterImageFiles(files);
      this.openUploadDialog(filtered);
    });
  }

  private filterImageFiles(files: File[]): File[] {
    // Firefox folder picks can arrive with an empty MIME type; fall back to
    // the file extension so the upload flow works cross-browser.
    const imageExt = /\.(png|jpe?g|gif|webp|avif|bmp|heic|tiff?)$/i;
    return files.filter(f => f.type.startsWith('image/') || (!f.type && imageExt.test(f.name)));
  }

  private openUploadDialog(files: File[]): void {
    if (files.length === 0) {
      return;
    }
    const albumTitle = basenameOfPickedFolder(files);
    const dialogRef = this.dialog.open<AdminPhotoAlbumUploadDialogComponent, AdminPhotoAlbumUploadDialogData, AdminPhotoAlbumUploadDialogResult>(
      AdminPhotoAlbumUploadDialogComponent,
      {
        data: { albumTitle, fileCount: files.length },
        width: '480px',
      },
    );
    dialogRef.afterClosed().subscribe(async result => {
      if (!result || result.action !== 'start') {
        return;
      }
      const album = await this.photoAlbumsService.createAlbum(result.title);
      this.currentUploadAlbumId = album.id;
      this.firstUploadedPhotoId = null;
      this.analyticsService.logEvent('photo_album_create', { albumId: album.id, title: album.title });
      for (const file of files) {
        const upload = this.photosService.uploadPhotoToAlbum(file, album.id);
        this.activeUploads.push({ upload, file });
      }
    });
  }

  completePhotoUpload(photo: Photo): void {
    if (!this.firstUploadedPhotoId) {
      this.firstUploadedPhotoId = photo.id;
    }
    this.activeUploads = this.activeUploads.filter(u => u.upload.photo.id !== photo.id);
    if (this.activeUploads.length === 0 && this.currentUploadAlbumId && this.firstUploadedPhotoId) {
      const albumId = this.currentUploadAlbumId;
      const coverId = this.firstUploadedPhotoId;
      this.currentUploadAlbumId = null;
      this.firstUploadedPhotoId = null;
      this.photosService.setAlbumCover(albumId, coverId);
    }
  }

  cancelActiveUploads(): void {
    for (const entry of this.activeUploads) {
      try {
        entry.upload.task.cancel();
      } catch {
        // task may already be settled; ignore
      }
    }
    this.activeUploads = [];
    this.currentUploadAlbumId = null;
    this.firstUploadedPhotoId = null;
  }

  onAddMoreClick(album: PhotoAlbum): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : [];
      const filtered = this.filterImageFiles(files);
      if (filtered.length === 0) {
        document.body.removeChild(input);
        return;
      }
      for (const file of filtered) {
        const upload = this.photosService.uploadPhotoToAlbum(file, album.id);
        this.activeUploads.push({ upload, file });
      }
      document.body.removeChild(input);
    });
    document.body.appendChild(input);
    input.click();
  }

  onEditAlbum(album: PhotoAlbum): void {
    this.editingAlbumId = album.id;
    this.editingTitle = album.title;
  }

  onSaveEdit(): void {
    if (!this.editingAlbumId || !this.editingTitle.trim()) {
      return;
    }
    const id = this.editingAlbumId;
    const title = this.editingTitle.trim();
    this.photoAlbumsService.updateAlbum(id, { title }).then(() => {
      this.editingAlbumId = null;
      this.editingTitle = '';
    });
  }

  onCancelEdit(): void {
    this.editingAlbumId = null;
    this.editingTitle = '';
  }

  onCreateEmptyAlbum(): void {
    this.dialog.open(PhotoAlbumEditDialogComponent, {
      data: { album: null },
      width: '480px',
    }).afterClosed().subscribe(async (result: any) => {
      if (result?.action === 'save' && result.title) {
        const album = await this.photoAlbumsService.createAlbum(result.title);
        this.analyticsService.logEvent('photo_album_create', { albumId: album.id, title: album.title });
      }
    });
  }

  openAlbumPhotos(album: PhotoAlbum): void {
    this.selectedAlbum = album;
    this.selectedAlbumPhotos = [];
    this.editingPhotoId = null;
    this.editDraft = null;
    this.subscriptions.push(
      this.photosService.getPhotosByAlbum(album.id).subscribe(photos => {
        this.selectedAlbumPhotos = photos || [];
      }),
    );
  }

  closeAlbumPhotos(): void {
    this.selectedAlbum = null;
    this.selectedAlbumPhotos = [];
    this.editingPhotoId = null;
    this.editDraft = null;
  }

  isEditingPhoto(photo: Photo): boolean {
    return this.editingPhotoId === photo.id;
  }

  onEditPhoto(photo: Photo): void {
    this.editingPhotoId = photo.id;
    this.editDraft = JSON.parse(JSON.stringify(photo));
  }

  onSavePhotoEdit(): void {
    if (!this.editDraft) {
      return;
    }
    this.photosService.updatePhoto(this.editDraft).then(() => {
      this.editingPhotoId = null;
      this.editDraft = null;
    });
  }

  onCancelPhotoEdit(): void {
    this.editingPhotoId = null;
    this.editDraft = null;
  }

  async onDeletePhoto(photo: Photo): Promise<void> {
    if (!this.selectedAlbum) {
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete photo?',
      message: `Delete ${photo.info ? `“${photo.info}”` : 'this photo'} from “${this.selectedAlbum.title}”? This cannot be undone.`,
      confirmLabel: 'Delete photo',
      destructive: true,
    });
    if (!confirmed || !this.selectedAlbum) {
      return;
    }
    const wasCover = this.selectedAlbum.coverPhotoId === photo.id;
    this.photosService.deletePhoto(photo);
    if (wasCover) {
      await this.photosService.setAlbumCover(this.selectedAlbum.id, null);
    }
    await this.photoAlbumsService.updateAlbum(this.selectedAlbum.id, {});
  }

  onSetAsCover(photo: Photo): void {
    if (!this.selectedAlbum) {
      return;
    }
    this.photosService.setAlbumCover(this.selectedAlbum.id, photo.id);
  }

  async onDeleteAlbum(album: PhotoAlbum): Promise<void> {
    const photoCount = this.getPhotoCount(album);
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete album?',
      message: `Delete “${album.title}” and its ${photoCount} photo${photoCount === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete album',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const photoIds = this.photos.filter(p => p.albumId === album.id).map(p => p.id);
    await this.photoAlbumsService.deleteAlbumCascade(album.id, photoIds);
    this.analyticsService.logEvent('photo_album_delete', { albumId: album.id, photoCount: photoIds.length });
    if (this.selectedAlbum?.id === album.id) {
      this.closeAlbumPhotos();
    }
  }

  private collectFilesFromDataTransfer(items: DataTransferItemList, cb: (files: File[]) => void): void {
    const files: File[] = [];
    let pending = 0;
    let finishedInitialScan = false;
    const checkDone = () => {
      if (finishedInitialScan && pending === 0) {
        cb(files);
      }
    };
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') {
        continue;
      }
      const entry = (item as any).webkitGetAsEntry?.();
      if (!entry) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
        continue;
      }
      pending++;
      this.walkEntry(entry, files, () => {
        pending--;
        checkDone();
      });
    }
    finishedInitialScan = true;
    checkDone();
  }

  private walkEntry(entry: any, files: File[], done: () => void): void {
    if (entry.isFile) {
      entry.file((file: File) => {
        files.push(file);
        done();
      }, done);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let pendingEntries = 1;
      const finishEntry = () => {
        pendingEntries--;
        if (pendingEntries === 0) {
          done();
        }
      };
      const readBatch = () => {
        reader.readEntries((entries: any[]) => {
          if (!entries || entries.length === 0) {
            finishEntry();
            return;
          }
          pendingEntries += entries.length;
          entries.forEach((child: any) => this.walkEntry(child, files, finishEntry));
          readBatch();
        }, finishEntry);
      };
      readBatch();
    } else {
      done();
    }
  }
}

function basenameOfPickedFolder(files: File[]): string {
  if (files.length === 0) {
    return '';
  }
  const first = files[0];
  const path = (first as any).webkitRelativePath || first.name;
  const parts = String(path).split('/');
  return parts[0] || first.name;
}
