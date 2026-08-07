import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
    templateUrl: './photo-album-edit-dialog.component.html',
    styleUrls: ['./photo-album-edit-dialog.component.scss'],
    imports: [
        FormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
    ]
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
