import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
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
    templateUrl: './photo-album-picker-dialog.component.html',
    styleUrls: ['./photo-album-picker-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule
]
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
