import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface AdminPhotoAlbumUploadDialogData {
  albumTitle: string;
  fileCount: number;
}

export type AdminPhotoAlbumUploadDialogResult =
  | { action: 'start'; title: string }
  | { action: 'cancel' }
  | undefined;

@Component({
  selector: 'app-admin-photo-album-upload-dialog',
  standalone: true,
  templateUrl: './admin-photo-album-upload-dialog.component.html',
  styleUrls: ['./admin-photo-album-upload-dialog.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
})
export class AdminPhotoAlbumUploadDialogComponent {
  title: string;
  isUploading = false;

  constructor(
    public dialogRef: MatDialogRef<AdminPhotoAlbumUploadDialogComponent, AdminPhotoAlbumUploadDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: AdminPhotoAlbumUploadDialogData,
  ) {
    this.title = data.albumTitle || '';
  }

  isValid(): boolean {
    return !this.isUploading && !!this.title.trim();
  }

  onCancel(): void {
    if (this.isUploading) {
      return;
    }
    this.dialogRef.close({ action: 'cancel' });
  }

  onStart(): void {
    if (!this.isValid()) {
      return;
    }
    this.isUploading = true;
    this.dialogRef.close({ action: 'start', title: this.title.trim() });
  }
}
