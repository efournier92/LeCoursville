import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { User } from 'src/app/models/user';
import { AudioAlbumUploadService } from 'src/app/services/audio-album-upload.service';
import { AuthService } from 'src/app/services/auth.service';
import { MediaService } from 'src/app/services/media.service';
import { UploadableMedia } from 'src/app/models/media/media';
import { MediaConstants } from 'src/app/constants/media-constants';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
    selector: 'app-admin-media-upload-audio-album',
    templateUrl: './admin-media-upload-audio-album.component.html',
    styleUrls: ['./admin-media-upload-audio-album.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminMediaUploadAudioAlbumComponent implements OnInit {
  album: AudioAlbum = new AudioAlbum();
  user: User;
  folderName: string;
  tracksString: string;
  deleteError: string | null = null;
  formError: string | null = null;
  uploadSuccess: string | null = null;
  uploading = false;

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private audioAlbumUploadService: AudioAlbumUploadService,
    private confirmDialog: ConfirmDialogService,
  ) { }

  // LIFECYCLE EVENTS

  ngOnInit(): void {
    this.album = new AudioAlbum();
    this.subscribeToUserObservable();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  isUserAdmin(): boolean {
    return !!(this.user?.roles?.admin || this.user?.roles?.super);
  }

  onMediaSelect(album: AudioAlbum): void {
    this.album = album;
  }

  async onUploadSelectedMedia(): Promise<void> {
    const validationError = this.getAlbumInputError();
    if (validationError) {
      this.formError = validationError;
      this.uploadSuccess = null;
      return;
    }

    const title = this.album.title;
    this.formError = null;
    this.uploadSuccess = null;
    this.uploading = true;
    try {
      await this.audioAlbumUploadService.upload(this.album, this.album.folderName, this.tracksString);
      this.resetSelectedMedia();
      this.uploadSuccess = `Saved “${title}”.`;
    } catch (error) {
      console.error('Album upload failed:', error);
      this.formError = `Couldn’t save “${title}”. Please try again.`;
    } finally {
      this.uploading = false;
    }
  }

  async onDeleteSelectedMedia(media: UploadableMedia): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete album?',
      message: `Delete “${media.title || media.folderName || 'this album'}”? This cannot be undone.`,
      confirmLabel: 'Delete album',
      destructive: true,
    });
    if (!confirmed) { return; }
    this.deleteError = null;
    try {
      await this.mediaService.deleteMedia(media);
      this.resetSelectedMedia();
    } catch {
      this.deleteError = `Couldn’t delete “${media.title || media.folderName || 'this album'}”. Please try again.`;
    }
  }

  onCancelSelectedMedia(): void {
    this.resetSelectedMedia();
  }

  inputClearedEvent(): void {
    console.log('Input cleared');
  }

  inputFileChangeEvent($event: any): void {
    console.log('File changed: ', $event);
  }

  getAudioAlbumTypeId(): string {
    return MediaConstants.AUDIO_ALBUM.id;
  }

  isAlbumAlreadyUploaded(): boolean {
    return !!this.album?.id;
  }

  // HELPER METHODS

  private getAlbumInputError(): string | null {
    const missing: string[] = [];
    if (!this.album.title) { missing.push('title'); }
    if (!this.album.folderName) { missing.push('folder name'); }
    return missing.length > 0 ? `Enter the ${missing.join(' and ')} before uploading.` : null;
  }

  private resetSelectedMedia(): void {
    this.album = new AudioAlbum();
    this.album.folderName = '';
    this.tracksString = '';
  }
}
