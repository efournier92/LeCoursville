import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, Subscription } from 'rxjs';
import { ref, list, listAll, getBlob, getMetadata, getDownloadURL } from 'firebase/storage';
import { FirebaseService } from '../../services/firebase.service';
import JSZip from 'jszip';
import { UserUpload } from '../../models/user-upload';
import { UserUploadService } from '../../services/user-upload.service';
import { PhotoAlbumsService } from '../../services/photo-albums.service';
import { PhotoAlbum } from '../../models/photo-album';
import { PhotoAlbumPickerDialogComponent } from '../photo-album-picker-dialog/photo-album-picker-dialog.component';
import { AnalyticsService } from '../../services/analytics.service';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { paginate, pageRange, Page } from '../../admin/pagination';
import { LvLoadErrorComponent } from '../load-error/load-error.component';
import { NoResultsMessageComponent } from '../no-results-message/no-results-message.component';
import { PageToolbarComponent } from '../shared/page-toolbar/page-toolbar.component';
import { AdminFilterBarComponent } from '../shared/admin-filter-bar/admin-filter-bar.component';

interface StorageFolder {
  name: string;
  fullPath: string;
  /** null when the file listing failed, so the UI does not claim "0 files". */
  fileCount: number | null;
  section: 'userUploads' | 'photos';
}

interface StorageFile {
  name: string;
  fullPath: string;
  size: number;
  contentType: string;
  downloadUrl: string | null;
  isImage: boolean;
  ref: any;
  detailsLoaded?: boolean;
}

@Component({
    selector: 'app-admin-user-uploads',
    templateUrl: './admin-user-uploads.component.html',
    styleUrls: ['./admin-user-uploads.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatDialogModule,
        MatIconModule,
        MatTooltipModule,
        LvLoadErrorComponent,
        NoResultsMessageComponent,
        PageToolbarComponent,
        AdminFilterBarComponent,
    ]
})
export class AdminUserUploadsComponent implements OnInit, OnDestroy {
  allUploads: UserUpload[] = [];
  allAlbums: PhotoAlbum[] = [];
  processingIds = new Set<string>();
  previewUpload: UserUpload | null = null;
  filterStatus: 'pending' | 'all' | 'browser' = 'pending';
  uploadsLoading = true;
  uploadsError: string | null = null;
  pageError: string | null = null;
  page = 1;
  readonly pageSize = 10;
  @ViewChild('previewDialog') previewDialog!: TemplateRef<any>;
  private previewDialogRef: MatDialogRef<unknown> | null = null;
  private uploadsSubscription: Subscription | null = null;

  // Storage Browser tab
  storageBrowserTab: 'list' | 'files' = 'list';
  selectedSection: 'userUploads' | 'photos' | null = null;
  pendingFolders: StorageFolder[] = [];
  approvedFolders: StorageFolder[] = [];
  pendingFoldersCapped = false;
  approvedFoldersCapped = false;
  currentFolderFiles: StorageFile[] = [];
  currentFolderFilesCapped = false;
  currentFolderPath: string = '';
  breadcrumbPath: string = '';
  zipDownloadingFolder: string | null = null;
  zipNotice: string | null = null;
  isLoadingFolders: boolean = false;
  isLoadingFiles: boolean = false;
  folderError: string | null = null;
  filesError: string | null = null;

  private subscriptions: Subscription[] = [];
  /** Folder listings and their resolved URLs, so re-opening costs zero reads. */
  private readonly folderCache = new Map<string, { files: StorageFile[]; capped: boolean }>();

  constructor(
    private userUploadService: UserUploadService,
    private photoAlbumsService: PhotoAlbumsService,
    private firebase: FirebaseService,
    private dialog: MatDialog,
    private analyticsService: AnalyticsService,
    private featureFlagsService: FeatureFlagsService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadUploads();
    this.subscriptions.push(
      this.photoAlbumsService.albums$.subscribe(albums => {
        this.allAlbums = albums || [];
      }),
    );
  }

  ngOnDestroy(): void {
    this.previewDialogRef?.close();
    this.uploadsSubscription?.unsubscribe();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private loadUploads(): void {
    this.uploadsLoading = true;
    this.uploadsError = null;
    this.uploadsSubscription?.unsubscribe();
    this.uploadsSubscription = this.userUploadService.allUploads$.subscribe({
      next: uploads => {
        this.allUploads = uploads || [];
        this.uploadsLoading = false;
      },
      error: () => {
        this.uploadsLoading = false;
        this.uploadsError = 'Couldn’t load uploads.';
      },
    });
  }

  onRetryUploads(): void {
    this.page = 1;
    this.loadUploads();
  }

  get filteredUploads(): UserUpload[] {
    if (this.filterStatus === 'pending') {
      return this.allUploads.filter(u => u.status === 'pending');
    }
    return this.allUploads;
  }

  get pageData(): Page<UserUpload> {
    return paginate(this.filteredUploads, this.page, this.pageSize);
  }

  get showingRange(): string {
    return pageRange(this.pageData);
  }

  nextPage(): void {
    this.page = Math.min(this.page + 1, this.pageData.pageCount);
  }

  prevPage(): void {
    this.page = Math.max(this.page - 1, 1);
  }

  get pendingCount(): number {
    return this.allUploads.filter(u => u.status === 'pending').length;
  }

  async onApprove(upload: UserUpload): Promise<boolean> {
    this.pageError = null;
    let flags: any;
    try {
      flags = await firstValueFrom(this.featureFlagsService.getAllFeatureFlags());
    } catch {
      this.pageError = `Couldn’t approve “${upload.fileName}”. Please try again.`;
      return false;
    }
    if (!flags['enablePhotoAlbums']?.enabled) {
      // Feature OFF: keep the pre-photo-albums approval behavior.
      this.processingIds.add(upload.id);
      try {
        await this.userUploadService.approveUpload(upload);
        return true;
      } catch (error) {
        console.error('Approval failed:', error);
        this.pageError = `Couldn’t approve “${upload.fileName}”. Please try again.`;
        return false;
      } finally {
        this.processingIds.delete(upload.id);
      }
    }
    const dialogRef = this.dialog.open(PhotoAlbumPickerDialogComponent, {
      data: {
        suggestedTitle: upload.eventName || 'Untitled Album',
        albums: this.allAlbums,
      },
      width: '480px',
      panelClass: 'photo-album-picker-dialog',
    });
    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return false;
    }
    let albumId: string;
    let mode: 'existing' | 'new';
    if (result.action === 'use-existing') {
      albumId = result.albumId;
      mode = 'existing';
    } else {
      try {
        const created = await this.photoAlbumsService.createAlbum(result.title);
        albumId = created.id;
        mode = 'new';
      } catch {
        this.pageError = `Couldn’t create the album for “${upload.fileName}”. Please try again.`;
        return false;
      }
    }
    this.processingIds.add(upload.id);
    try {
      await this.userUploadService.approveUploadToAlbum(upload, albumId);
      this.analyticsService.logEvent('photo_admin_approve_with_album', {
        uploadId: upload.id,
        albumId,
        mode,
      });
      return true;
    } catch (error) {
      console.error('Approval failed:', error);
      this.pageError = `Couldn’t approve “${upload.fileName}”. Please try again.`;
      return false;
    } finally {
      this.processingIds.delete(upload.id);
    }
  }

  async onReject(upload: UserUpload): Promise<boolean> {
    this.pageError = null;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Reject upload?',
      message: `Reject “${upload.fileName}” from ${this.getUploaderName(upload) || 'this guest'}? This permanently deletes the file; it cannot be undone.`,
      confirmLabel: 'Reject upload',
      destructive: true,
    });
    if (!confirmed) {
      return false;
    }
    this.processingIds.add(upload.id);
    try {
      await this.userUploadService.rejectUpload(upload);
      return true;
    } catch (error) {
      console.error('Rejection failed:', error);
      this.pageError = `Couldn’t reject “${upload.fileName}”. Please try again.`;
      return false;
    } finally {
      this.processingIds.delete(upload.id);
    }
  }

  onPreview(upload: UserUpload): void {
    this.previewUpload = upload;
    this.previewDialogRef = this.dialog.open(this.previewDialog, {
      width: 'min(92vw, 720px)',
      panelClass: 'upload-preview-dialog',
    });
  }

  closePreviewDialog(): void {
    this.previewDialogRef?.close();
    this.previewDialogRef = null;
  }

  async onApproveFromPreview(upload: UserUpload): Promise<void> {
    const approved = await this.onApprove(upload);
    if (approved) {
      this.closePreviewDialog();
    }
  }

  async onRejectFromPreview(upload: UserUpload): Promise<void> {
    const rejected = await this.onReject(upload);
    if (rejected) {
      this.closePreviewDialog();
    }
  }

  setFilter(status: 'pending' | 'all'): void {
    this.filterStatus = status;
    this.page = 1;
  }

  backToReview(): void {
    this.filterStatus = 'pending';
    this.storageBrowserTab = 'list';
    this.currentFolderFiles = [];
    this.currentFolderFilesCapped = false;
    this.filesError = null;
  }

  isProcessing(id: string): boolean {
    return this.processingIds.has(id);
  }

  getUploaderName(upload: UserUpload): string {
    return upload.uploader?.name || upload.uploader?.email || '';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getStatusLabel(upload: UserUpload): string {
    return upload.status.charAt(0).toUpperCase() + upload.status.slice(1);
  }

  // Storage Browser methods

  switchToStorageBrowser(): void {
    this.filterStatus = 'browser';
    this.storageBrowserTab = 'list';
    this.loadFolders();
  }

  loadFolders(): void {
    this.folderCache.clear();
    this.isLoadingFolders = true;
    this.folderError = null;
    this.pendingFolders = [];
    this.approvedFolders = [];
    this.pendingFoldersCapped = false;
    this.approvedFoldersCapped = false;

    this.loadFolderSection('userUploads').then(() => {
      return this.loadFolderSection('photos');
    }).finally(() => {
      this.isLoadingFolders = false;
    });
  }

  private getStorageRef(section: 'userUploads' | 'photos') {
    return ref(this.firebase.storage, section);
  }

  private getFolderRef(section: 'userUploads' | 'photos', folderName: string) {
    return ref(this.firebase.storage, `${section}/${folderName}`);
  }

  private async loadFolderSection(section: 'userUploads' | 'photos'): Promise<void> {
    const storageRef = this.getStorageRef(section);
    try {
      const result = await list(storageRef, { maxResults: 100 });
      const folders: StorageFolder[] = result.prefixes.map(prefix => ({
        name: this.getFolderNameFromPath(prefix.fullPath),
        fullPath: prefix.fullPath,
        fileCount: null,
        section,
      }));
      await Promise.all(folders.map(async f => {
        try {
          // listAll gives the exact count; the old maxResults:1 read always reported "1 file".
          const files = await listAll(this.getFolderRef(section, f.name));
          f.fileCount = files.items.length;
        } catch {
          f.fileCount = null;
        }
      }));
      const capped = !!result.nextPageToken;
      if (section === 'userUploads') {
        this.pendingFolders = folders;
        this.pendingFoldersCapped = capped;
      } else {
        this.approvedFolders = folders;
        this.approvedFoldersCapped = capped;
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

  onFolderRowKeydown(event: KeyboardEvent, folder: StorageFolder): void {
    // Ignore keys from the inner ZIP button so it does not open the folder.
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onFolderClick(folder);
    }
  }

  async loadFilesInFolder(fullPath: string): Promise<void> {
    const cached = this.folderCache.get(fullPath);
    if (cached) {
      this.currentFolderFiles = cached.files;
      this.currentFolderFilesCapped = cached.capped;
      this.isLoadingFiles = false;
      this.filesError = null;
      return;
    }
    this.currentFolderFiles = [];
    this.currentFolderFilesCapped = false;
    this.isLoadingFiles = true;
    this.filesError = null;
    try {
      const storageRef = ref(this.firebase.storage, fullPath);
      const result = await list(storageRef, { maxResults: 200 });
      const capped = !!result.nextPageToken;
      const files: StorageFile[] = result.items.map(item => ({
        name: item.name,
        fullPath: item.fullPath,
        size: 0,
        contentType: '',
        downloadUrl: null,
        isImage: item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) !== null,
        ref: item,
      }));
      // Only the displayed folder resolves URLs; only thumbnails need one, and
      // metadata waits for the lazy image load (or the icon card's render).
      await Promise.all(files.map(file => this.prepareFile(file)));
      this.currentFolderFiles = files;
      this.currentFolderFilesCapped = capped;
      this.folderCache.set(fullPath, { files, capped });
    } catch (error) {
      console.error('Failed to list files:', error);
      this.filesError = 'Failed to load files in this folder. Check storage rules.';
    } finally {
      this.isLoadingFiles = false;
    }
  }

  private async prepareFile(file: StorageFile): Promise<void> {
    if (file.isImage) {
      try {
        file.downloadUrl = await getDownloadURL(file.ref);
      } catch {
        file.downloadUrl = null;
        // No thumbnail will render, so read the size now rather than never.
        await this.loadFileDetails(file);
      }
      return;
    }
    await this.loadFileDetails(file);
  }

  /** Called by the thumbnail's load event, so metadata is read only for shown files. */
  onThumbnailLoaded(file: StorageFile): void {
    this.loadFileDetails(file);
  }

  private async loadFileDetails(file: StorageFile): Promise<void> {
    if (file.detailsLoaded) {
      return;
    }
    file.detailsLoaded = true;
    try {
      const metadata = await getMetadata(file.ref);
      file.size = metadata.size;
      file.contentType = metadata.contentType || '';
    } catch {
      file.size = 0;
    }
  }

  retryLoadFiles(): void {
    if (this.currentFolderPath) {
      this.loadFilesInFolder(this.currentFolderPath);
    }
  }

  backToFolderList(): void {
    this.storageBrowserTab = 'list';
    this.currentFolderFiles = [];
    this.currentFolderFilesCapped = false;
    this.filesError = null;
    this.currentFolderPath = '';
    this.breadcrumbPath = '';
    this.selectedSection = null;
  }

  async downloadFolderAsZip(folder: StorageFolder): Promise<void> {
    this.zipDownloadingFolder = folder.name;
    this.zipNotice = null;
    const zip = new JSZip();
    const storageRef = ref(this.firebase.storage, folder.fullPath);

    try {
      const result = await listAll(storageRef);
      const zipped = result.items.slice(0, 500);

      const blobs: ({ name: string; blob: Blob } | null)[] = [];
      let nextIndex = 0;
      const fetchNext = async () => {
        while (nextIndex < zipped.length) {
          const index = nextIndex++;
          const item = zipped[index];
          try {
            blobs[index] = { name: item.name, blob: await getBlob(item) };
          } catch (error) {
            blobs[index] = null;
            console.warn(`Failed to fetch ${item.name}:`, error);
          }
        }
      };
      // Bounded fetch concurrency keeps a large folder from pulling every blob at once.
      await Promise.all(Array.from({ length: Math.min(4, zipped.length) }, fetchNext));

      const failed = blobs.filter(blob => blob === null).length;
      this.zipNotice = this.buildZipNotice(folder.name, result.items.length, zipped.length, failed);

      for (const r of blobs) {
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

  private buildZipNotice(folderName: string, total: number, included: number, failed: number): string | null {
    const notices: string[] = [];
    if (total > included) {
      notices.push(`ZIP contains the first ${included} of ${total} files from “${folderName}”.`);
    }
    if (failed > 0) {
      // The ZIP still downloads; make the partial result explicit instead of
      // silently dropping the blobs that failed to fetch.
      notices.push(`${failed} file${failed === 1 ? '' : 's'} could not be added.`);
    }
    return notices.length > 0 ? notices.join(' ') : null;
  }
}
