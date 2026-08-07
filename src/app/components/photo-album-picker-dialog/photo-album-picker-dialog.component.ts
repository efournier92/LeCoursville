import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyDialogModule as MatDialogModule, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { PhotoAlbum } from 'src/app/models/photo-album';

export interface PhotoAlbumPickerDialogData {
  suggestedTitle: string;
  albums: PhotoAlbum[];
}

export type PhotoAlbumPickerDialogResult =
  | { action: 'use-existing'; albumId: string }
  | { action: 'create-new'; title: string }
  | undefined;

@Component({
  selector: 'app-photo-album-picker-dialog',
  standalone: true,
  templateUrl: './photo-album-picker-dialog.component.html',
  styleUrls: ['./photo-album-picker-dialog.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
  ],
})
export class PhotoAlbumPickerDialogComponent {
  mode: 'existing' | 'new' = 'new';
  selectedAlbumId: string | null = null;
  newTitle: string;

  constructor(
    public dialogRef: MatDialogRef<PhotoAlbumPickerDialogComponent, PhotoAlbumPickerDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: PhotoAlbumPickerDialogData,
  ) {
    this.newTitle = data.suggestedTitle || '';
    if (data.albums && data.albums.length > 0) {
      this.selectedAlbumId = data.albums[0].id;
    }
  }

  isValid(): boolean {
    if (this.mode === 'existing') {
      return !!this.selectedAlbumId;
    }
    return !!this.newTitle.trim();
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (!this.isValid()) {
      return;
    }
    if (this.mode === 'existing' && this.selectedAlbumId) {
      this.dialogRef.close({ action: 'use-existing', albumId: this.selectedAlbumId });
    } else if (this.mode === 'new') {
      this.dialogRef.close({ action: 'create-new', title: this.newTitle.trim() });
    }
  }
}
