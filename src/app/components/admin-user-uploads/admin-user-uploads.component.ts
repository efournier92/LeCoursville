import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, Subscription } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { ref, list, getBlob, getMetadata, getDownloadURL } from 'firebase/storage';
import * as JSZip from 'jszip';
import { UserUpload } from '../../models/user-upload';
import { UserUploadService } from '../../services/user-upload.service';
import { PhotoAlbumsService } from '../../services/photo-albums.service';
import { PhotoAlbum } from '../../models/photo-album';
import { PhotoAlbumPickerDialogComponent } from '../photo-album-picker-dialog/photo-album-picker-dialog.component';
import { AnalyticsService } from '../../services/analytics.service';
import { FeatureFlagsService } from '../../services/feature-flags.service';

interface StorageFolder {
  name: string;
  fullPath: string;
  fileCount: number;
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
}

@Component({
  selector: 'app-admin-user-uploads',
  standalone: true,
  templateUrl: './admin-user-uploads.component.html',
  styleUrls: ['./admin-user-uploads.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule,
    PhotoAlbumPickerDialogComponent,
  ],
})
export class AdminUserUploadsComponent implements OnInit, OnDestroy {
  allUploads: UserUpload[] = [];
  allAlbums: PhotoAlbum[] = [];
  processingIds = new Set<string>();
  previewUpload: UserUpload | null = null;
  filterStatus: 'pending' | 'all' | 'browser' = 'pending';

  // Storage Browser tab
  storageBrowserTab: 'list' | 'files' = 'list';
  selectedSection: 'userUploads' | 'photos' | null = null;
  pendingFolders: StorageFolder[] = [];
  approvedFolders: StorageFolder[] = [];
  currentFolderFiles: StorageFile[] = [];
  currentFolderPath: string = '';
  breadcrumbPath: string = '';
  zipDownloadingFolder: string | null = null;
  isLoadingFolders: boolean = false;
  folderError: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private userUploadService: UserUploadService,
    private photoAlbumsService: PhotoAlbumsService,
    private afStorage: AngularFireStorage,
    private dialog: MatDialog,
    private analyticsService: AnalyticsService,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.userUploadService.allUploads$.subscribe(uploads => {
        this.allUploads = uploads || [];
      }),
    );
    this.subscriptions.push(
      this.photoAlbumsService.albums$.subscribe(albums => {
        this.allAlbums = albums || [];
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  get filteredUploads(): UserUpload[] {
    if (this.filterStatus === 'pending') {
      return this.allUploads.filter(u => u.status === 'pending');
    }
    return this.allUploads;
  }

  get pendingCount(): number {
    return this.allUploads.filter(u => u.status === 'pending').length;
  }

  async onApprove(upload: UserUpload): Promise<void> {
    const flags = await firstValueFrom(this.featureFlagsService.getAllFeatureFlags());
    if (!flags['enablePhotoAlbums']?.enabled) {
      // Feature OFF: keep the pre-photo-albums approval behavior.
      this.processingIds.add(upload.id);
      try {
        await this.userUploadService.approveUpload(upload);
      } catch (error) {
        console.error('Approval failed:', error);
      } finally {
        this.processingIds.delete(upload.id);
      }
      return;
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
      return;
    }
    let albumId: string;
    let mode: 'existing' | 'new';
    if (result.action === 'use-existing') {
      albumId = result.albumId;
      mode = 'existing';
    } else {
      const created = await this.photoAlbumsService.createAlbum(result.title);
      albumId = created.id;
      mode = 'new';
    }
    this.processingIds.add(upload.id);
    try {
      await this.userUploadService.approveUploadToAlbum(upload, albumId);
      this.analyticsService.logEvent('photo_admin_approve_with_album', {
        uploadId: upload.id,
        albumId,
        mode,
      });
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      this.processingIds.delete(upload.id);
    }
  }

  async onReject(upload: UserUpload): Promise<void> {
    this.processingIds.add(upload.id);
    try {
      await this.userUploadService.rejectUpload(upload);
    } catch (error) {
      console.error('Rejection failed:', error);
    } finally {
      this.processingIds.delete(upload.id);
    }
  }

  onPreview(upload: UserUpload): void {
    this.previewUpload = upload;
  }

  closePreview(): void {
    this.previewUpload = null;
  }

  isProcessing(id: string): boolean {
    return this.processingIds.has(id);
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
    this.isLoadingFolders = true;
    this.folderError = null;
    this.pendingFolders = [];
    this.approvedFolders = [];

    this.loadFolderSection('userUploads').then(() => {
      return this.loadFolderSection('photos');
    }).finally(() => {
      this.isLoadingFolders = false;
    });
  }

  private getStorageRef(section: 'userUploads' | 'photos') {
    return ref(this.afStorage.storage, section);
  }

  private getFolderRef(section: 'userUploads' | 'photos', folderName: string) {
    return ref(this.afStorage.storage, `${section}/${folderName}`);
  }

  private async loadFolderSection(section: 'userUploads' | 'photos'): Promise<void> {
    const storageRef = this.getStorageRef(section);
    try {
      const result = await list(storageRef, { maxResults: 100 });
      const folders: StorageFolder[] = result.prefixes.map(prefix => ({
        name: this.getFolderNameFromPath(prefix.fullPath),
        fullPath: prefix.fullPath,
        fileCount: 0,
        section,
      }));
      await Promise.all(folders.map(async f => {
        try {
          const folderRef = this.getFolderRef(section, f.name);
          const files = await list(folderRef, { maxResults: 1 });
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
    const storageRef = ref(this.afStorage.storage, fullPath);
    try {
      const result = await list(storageRef, { maxResults: 200 });
      const fileRefs = result.items;
      const files: StorageFile[] = fileRefs.map(item => ({
        name: item.name,
        fullPath: item.fullPath,
        size: 0,
        contentType: '',
        downloadUrl: null,
        isImage: item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) !== null,
        ref: item,
      }));
      await Promise.all(files.map(async (file) => {
        try {
          file.downloadUrl = await getDownloadURL(file.ref);
        } catch {
          file.downloadUrl = null;
        }
        try {
          const metadata = await getMetadata(file.ref);
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
    const storageRef = ref(this.afStorage.storage, folder.fullPath);

    try {
      const result = await list(storageRef, { maxResults: 500 });
      const files = result.items;

      const blobResults = await Promise.all(
        files.map(async (item) => {
          try {
            const blob = await getBlob(item);
            return { name: item.name, blob };
          } catch (error) {
            console.warn(`Failed to fetch ${item.name}:`, error);
            return null;
          }
        })
      );

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

  getFolderIcon(folder: StorageFolder): string {
    return folder.section === 'userUploads' ? 'hourglass_empty' : 'check_circle';
  }

  getSectionIcon(section: 'userUploads' | 'photos'): string {
    return section === 'userUploads' ? 'hourglass_empty' : 'check_circle';
  }
}
