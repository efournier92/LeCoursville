import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PhotoAlbum } from 'src/app/models/photo-album';

export interface PhotoAlbumEditDialogData {
  album: PhotoAlbum | null;
  save: (title: string) => Promise<unknown>;
}

export type PhotoAlbumEditDialogResult =
  | { action: 'save'; title: string }
  | { action: 'cancel' }
  | undefined;

@Component({
    selector: 'app-photo-album-edit-dialog',
    templateUrl: './photo-album-edit-dialog.component.html',
    styleUrls: ['./photo-album-edit-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
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
  saving = false;
  error: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<PhotoAlbumEditDialogComponent, PhotoAlbumEditDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: PhotoAlbumEditDialogData,
  ) {
    this.title = data.album?.title || '';
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }

  async onSave(): Promise<void> {
    const title = this.title.trim();
    if (!title || this.saving) {
      return;
    }
    this.saving = true;
    this.error = null;
    try {
      await this.data.save(title);
      this.dialogRef.close({ action: 'save', title });
    } catch {
      // Keep the dialog open with the typed title so the admin can retry.
      this.error = `Couldn’t save “${title}”. Please try again.`;
    } finally {
      this.saving = false;
    }
  }
}
