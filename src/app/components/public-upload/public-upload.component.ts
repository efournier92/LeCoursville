import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserUploadService } from '../../services/user-upload.service';

interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  url?: string;
  error?: string;
}

@Component({
  selector: 'app-public-upload',
  standalone: true,
  templateUrl: './public-upload.component.html',
  styleUrls: ['./public-upload.component.scss'],
  imports: [CommonModule, FormsModule, MatIconModule],
})
export class PublicUploadComponent implements OnInit, OnDestroy {
  uploadItems: UploadItem[] = [];
  isDragging = false;
  isProcessing = false;
  isComplete = false;
  suggestedEvent = '';
  uploaderName = '';
  private userSub?: Subscription;
  private eventFromUrl = '';

  constructor(
    private userUploadService: UserUploadService,
    private authService: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Check localStorage directly since user may not be set yet on first render
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (storedUser?.name) {
      this.uploaderName = storedUser.name;
    }

    // Also listen for auth state in case user signs in after this component initializes
    this.userSub = this.authService.userObservable.subscribe((user: any) => {
      if (user?.name && !this.uploaderName) {
        this.uploaderName = user.name;
      }
    });

    // Prefill event name from query param
    this.route.queryParams.subscribe(params => {
      if (params['event']) {
        this.suggestedEvent = params['event'];
        this.eventFromUrl = params['event'];
      }
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const items = event.dataTransfer?.items;
    if (!items) return;

    const files: File[] = [];
    this.readDataTransferItems(items, files).then(() => {
      if (files.length > 0) {
        this.addFilesAsList(files);
        this.scrollToFileList();
      }
    });
  }

  private async readDataTransferItems(items: DataTransferItemList, files: File[]): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await this.readEntry(entry, files);
      }
    }
  }

  private readEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
    return new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file: File) => {
          files.push(file);
          resolve();
        });
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader();
        const readDir = () => {
          dirReader.readEntries(async (entries: FileSystemEntry[]) => {
            if (entries.length === 0) {
              resolve();
              return;
            }
            for (const e of entries) {
              await this.readEntry(e, files);
            }
            readDir();
          });
        };
        readDir();
      } else {
        resolve();
      }
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(input.files);
    }
    input.value = '';
    this.scrollToFileList();
  }

  scrollToFileList(): void {
    setTimeout(() => {
      const fileListEl = document.querySelector('.file-list');
      fileListEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  openFilePicker(input: HTMLInputElement): void {
    input.click();
  }

  openFolderPicker(input: HTMLInputElement, event: Event): void {
    event.stopPropagation();
    input.click();
  }

  onFolderSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const files: File[] = [];
    const items = input.files;
    for (let i = 0; i < items.length; i++) {
      files.push(items[i]);
    }
    this.addFilesAsList(files);
    input.value = '';
    this.scrollToFileList();
  }

  addFiles(files: FileList): void {
    for (let i = 0; i < files.length; i++) {
      this.uploadItems.push({
        file: files[i],
        progress: 0,
        status: 'pending'
      });
    }
  }

  addFilesAsList(files: File[]): void {
    for (const file of files) {
      this.uploadItems.push({
        file,
        progress: 0,
        status: 'pending'
      });
    }
  }

  removeItem(index: number): void {
    this.uploadItems.splice(index, 1);
  }

  clearAll(): void {
    this.uploadItems = [];
    this.suggestedEvent = this.eventFromUrl;
    this.resetInputs();
  }

  reset(): void {
    this.uploadItems = [];
    this.isComplete = false;
    this.suggestedEvent = this.eventFromUrl;
    this.resetInputs();
  }

  private resetInputs(): void {
    const fileInput = document.querySelector('#fileInput') as HTMLInputElement;
    const folderInput = document.querySelector('#folderInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    if (folderInput) folderInput.value = '';
  }

  async startUpload(): Promise<void> {
    if (this.uploadItems.length === 0) return;

    this.isProcessing = true;
    let completed = 0;
    const total = this.uploadItems.length;

    for (const item of this.uploadItems) {
      item.status = 'uploading';
      item.progress = 0;

      const sanitizedName = this.uploaderName.replace(/[^a-zA-Z0-9]/g, '');
      const { task } = await this.userUploadService.uploadFile(
        item.file,
        this.suggestedEvent,
        { anonymousId: this.generateAnonymousId() },
        sanitizedName
      );

      task.percentageChanges().subscribe({
        next: (percent) => {
          if (item.status === 'uploading') {
            item.progress = percent || 0;
          }
        },
        error: () => {
          item.status = 'error';
          item.error = 'Upload failed';
          this.checkComplete(++completed, total);
        }
      });

      task.then(() => {
        item.status = 'complete';
        this.checkComplete(++completed, total);
      }).catch(() => {
        item.status = 'error';
        item.error = 'Upload failed';
        this.checkComplete(++completed, total);
      });
    }
  }

  private checkComplete(completed: number, total: number): void {
    if (completed === total) {
      this.isProcessing = false;
      this.isComplete = true;
    }
  }

  private generateAnonymousId(): string {
    return 'anon_' + Math.random().toString(36).substring(2, 15);
  }

  getStatusIcon(item: UploadItem): string {
    switch (item.status) {
      case 'complete': return '✓';
      case 'error': return '✗';
      case 'uploading': return '↻';
      default: return '○';
    }
  }

  getFileType(file: File): string {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    return 'file';
  }

  getFileIcon(file: File): string {
    if (file.type.startsWith('video/')) return 'videocam';
    if (file.type.startsWith('audio/')) return 'music_note';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'picture_as_pdf';
    return 'insert_drive_file';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}