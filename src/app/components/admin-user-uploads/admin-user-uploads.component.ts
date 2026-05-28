import { Component, OnInit } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { UserUpload } from '../../models/user-upload';
import { UserUploadService } from '../../services/user-upload.service';

@Component({
  selector: 'app-admin-user-uploads',
  standalone: true,
  templateUrl: './admin-user-uploads.component.html',
  styleUrls: ['./admin-user-uploads.component.scss'],
  imports: [MatCardModule, MatButtonToggleModule],
})
export class AdminUserUploadsComponent implements OnInit {
  allUploads: UserUpload[] = [];
  processingIds = new Set<string>();
  previewUpload: UserUpload | null = null;
  filterStatus: 'pending' | 'all' = 'pending';

  constructor(private userUploadService: UserUploadService) {}

  ngOnInit(): void {
    this.userUploadService.subscribeToAllUploads(uploads => {
      this.allUploads = uploads;
    });
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
    this.processingIds.add(upload.id);
    try {
      await this.userUploadService.approveUpload(upload);
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
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getStatusLabel(upload: UserUpload): string {
    return upload.status.charAt(0).toUpperCase() + upload.status.slice(1);
  }
}