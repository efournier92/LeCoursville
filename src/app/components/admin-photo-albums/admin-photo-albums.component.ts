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
import { paginate, pageRange, Page } from 'src/app/admin/pagination';
import { NoResultsMessageComponent } from 'src/app/components/no-results-message/no-results-message.component';
import { LvLoadErrorComponent } from 'src/app/components/load-error/load-error.component';
import { PageToolbarComponent } from 'src/app/components/shared/page-toolbar/page-toolbar.component';
import { AdminFilterBarComponent } from 'src/app/components/shared/admin-filter-bar/admin-filter-bar.component';
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
import {
  PhotoAlbumEditDialogComponent,
  PhotoAlbumEditDialogData,
} from '../photo-album-edit-dialog/photo-album-edit-dialog.component';

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
    AdminFilterBarComponent,
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

  // Per-album photo management (drill-in panel)
  selectedAlbum: PhotoAlbum | null = null;
  selectedAlbumPhotos: Photo[] = [];
  editingPhotoId: string | null = null;
  editDraft: Photo | null = null;

  activeUploads: { upload: PhotoUpload; file: File }[] = [];
  private currentUploadAlbumId: string | null = null;
  private firstUploadedPhotoId: string | null = null;

  isDragOver = false;
  actionError: string | null = null;
  photosLoadError = false;
  isDeletingAlbum = false;

  private subscriptions: Subscription[] = [];
  private albumPhotosSubscription: Subscription | null = null;

  constructor(
    private photoAlbumsService: PhotoAlbumsService,
    private photosService: PhotosService,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    private analyticsService: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.loadAlbums();
    this.subscribeToPhotos();
  }

  ngOnDestroy(): void {
    this.albumPhotosSubscription?.unsubscribe();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private loadAlbums(): void {
    this.subscriptions.push(
      this.photoAlbumsService.error$.subscribe(hasError => {
        if (hasError) {
          this.status = 'error';
        }
      }),
      this.photoAlbumsService.albums$.subscribe(albums => {
        // null is the service's not-yet-loaded seed; only a real snapshot
        // (even an empty one) resolves the page. The error signal owns the
        // failure state, so ignore the settled [] that follows it.
        if (albums === null || this.status === 'error') {
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
    this.photoAlbumsService.reload();
    this.loadAlbums();
    this.subscribeToPhotos();
  }

  private subscribeToPhotos(): void {
    this.photosLoadError = false;
    this.subscriptions.push(
      this.photosService.nonMessagePhotos$.subscribe({
        next: photos => {
          this.photos = photos || [];
          this.photosLoadError = false;
          this.recomputePhotoCounts();
        },
        error: () => {
          this.photosLoadError = true;
          this.actionError = 'Couldn’t load photos, so album deletion is disabled to avoid orphaning them.';
        },
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

  get showingRange(): string {
    return pageRange(this.pageData);
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
      this.actionError = null;
      try {
        const album = await this.photoAlbumsService.createAlbum(result.title);
        this.currentUploadAlbumId = album.id;
        this.firstUploadedPhotoId = null;
        this.analyticsService.logEvent('photo_album_create', { albumId: album.id, title: album.title });
        for (const file of files) {
          const upload = this.photosService.uploadPhotoToAlbum(file, album.id);
          this.activeUploads.push({ upload, file });
        }
      } catch {
        // Keep the picked files and the page error visible so the admin can retry.
        this.actionError = `Couldn’t start the upload for “${result.title}”. Please try again.`;
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
    this.openAlbumEditDialog(album);
  }

  onCreateEmptyAlbum(): void {
    this.openAlbumEditDialog(null);
  }

  private openAlbumEditDialog(album: PhotoAlbum | null): void {
    const data: PhotoAlbumEditDialogData = {
      album,
      save: async (title: string) => {
        if (album) {
          await this.photoAlbumsService.updateAlbum(album.id, { title });
          if (this.selectedAlbum?.id === album.id) {
            this.selectedAlbum = { ...this.selectedAlbum, title };
          }
          return;
        }
        const created = await this.photoAlbumsService.createAlbum(title);
        this.analyticsService.logEvent('photo_album_create', { albumId: created.id, title: created.title });
      },
    };
    this.dialog.open<PhotoAlbumEditDialogComponent, PhotoAlbumEditDialogData>(PhotoAlbumEditDialogComponent, {
      data,
      width: '480px',
    });
  }

  openAlbumPhotos(album: PhotoAlbum): void {
    this.albumPhotosSubscription?.unsubscribe();
    this.selectedAlbum = album;
    this.selectedAlbumPhotos = [];
    this.editingPhotoId = null;
    this.editDraft = null;
    this.albumPhotosSubscription = this.photosService.getPhotosByAlbum(album.id).subscribe({
      next: photos => {
        if (this.selectedAlbum?.id !== album.id) {
          return;
        }
        this.selectedAlbumPhotos = photos || [];
      },
      error: () => {
        if (this.selectedAlbum?.id === album.id) {
          this.actionError = `Couldn’t load photos for “${album.title}”.`;
        }
      },
    });
  }

  closeAlbumPhotos(): void {
    this.albumPhotosSubscription?.unsubscribe();
    this.albumPhotosSubscription = null;
    this.selectedAlbum = null;
    this.selectedAlbumPhotos = [];
    this.editingPhotoId = null;
    this.editDraft = null;
  }

  onAlbumCardKeydown(event: KeyboardEvent, album: PhotoAlbum): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openAlbumPhotos(album);
    }
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
    if (this.isDeletingAlbum) {
      return;
    }
    this.actionError = null;
    if (this.photosLoadError) {
      this.actionError = `Couldn’t load photos, so “${album.title}” was not deleted; its photos would be orphaned. Reload and try again.`;
      return;
    }
    const photoCount = this.getPhotoCount(album);
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete album?',
      message: `Delete “${album.title}” and its ${photoCount} photo${photoCount === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete album',
      destructive: true,
    });
    if (!confirmed || this.isDeletingAlbum) {
      return;
    }
    this.isDeletingAlbum = true;
    const albumPhotos = this.photos.filter(p => p.albumId === album.id);
    try {
      await this.photoAlbumsService.deleteAlbumCascade(album.id, albumPhotos.map(p => p.id));
      for (const photo of albumPhotos) {
        this.photosService.deletePhoto(photo);
      }
      this.analyticsService.logEvent('photo_album_delete', { albumId: album.id, photoCount: albumPhotos.length });
      // Only drop the drill-in panel once the cascade actually succeeded.
      if (this.selectedAlbum?.id === album.id) {
        this.closeAlbumPhotos();
      }
    } catch {
      this.actionError = `Couldn’t delete “${album.title}”. Please try again.`;
    } finally {
      this.isDeletingAlbum = false;
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
