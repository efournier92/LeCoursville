import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyDialogModule as MatDialogModule, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { PhotoAlbum } from 'src/app/models/photo-album';

export interface PhotoAlbumEditDialogData {
  album: PhotoAlbum | null;
}

export type PhotoAlbumEditDialogResult =
  | { action: 'save'; title: string }
  | { action: 'cancel' }
  | undefined;

@Component({
  selector: 'app-photo-album-edit-dialog',
  standalone: true,
  templateUrl: './photo-album-edit-dialog.component.html',
  styleUrls: ['./photo-album-edit-dialog.component.scss'],
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
})
export class PhotoAlbumEditDialogComponent {
  title: string;

  constructor(
    public dialogRef: MatDialogRef<PhotoAlbumEditDialogComponent, PhotoAlbumEditDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: PhotoAlbumEditDialogData,
  ) {
    this.title = data.album?.title || '';
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }

  onSave(): void {
    if (!this.title.trim()) {
      return;
    }
    this.dialogRef.close({ action: 'save', title: this.title.trim() });
  }
}
