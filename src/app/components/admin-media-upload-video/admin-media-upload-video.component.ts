import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';
import { Video } from 'src/app/models/media/video';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { MediaService } from 'src/app/services/media.service';
import { VideoUploadService } from 'src/app/services/video-upload.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
    selector: 'app-admin-media-upload-video',
    templateUrl: './admin-media-upload-video.component.html',
    styleUrls: ['./admin-media-upload-video.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminMediaUploadVideoComponent implements OnInit {
  video: Video = new Video();
  user: User;
  deleteError: string | null = null;
  formError: string | null = null;
  uploadSuccess: string | null = null;
  uploading = false;

  constructor(
    private authService: AuthService,
    private videoUploadService: VideoUploadService,
    private mediaService: MediaService,
    private confirmDialog: ConfirmDialogService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  getVideoTypeId(): string[] {
    return [ MediaConstants.VIDEO.id ];
  }

  async onUploadSelectedMedia(): Promise<void> {
    const validationError = this.getVideoInputError();
    if (validationError) {
      this.formError = validationError;
      this.uploadSuccess = null;
      return;
    }

    const title = this.video.title;
    this.formError = null;
    this.uploadSuccess = null;
    this.uploading = true;
    try {
      await this.videoUploadService.upload(this.video);
      this.resetSelectedMedia();
      this.uploadSuccess = `Saved “${title}”.`;
    } catch (error) {
      console.error('Video upload failed:', error);
      this.formError = `Couldn’t save “${title}”. Please try again.`;
    } finally {
      this.uploading = false;
    }
  }

  async onDeleteSelectedMedia(media: UploadableMedia): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete video?',
      message: `Delete “${media.title || media.fileName || 'this video'}”? This cannot be undone.`,
      confirmLabel: 'Delete video',
      destructive: true,
    });
    if (!confirmed) { return; }
    this.deleteError = null;
    try {
      await this.mediaService.deleteMedia(media);
      this.resetSelectedMedia();
    } catch {
      this.deleteError = `Couldn’t delete “${media.title || media.fileName || 'this video'}”. Please try again.`;
    }
  }

  onCancelSelectedMedia(): void {
    this.resetSelectedMedia();
  }

  onMediaSelect(video: Video): void {
    this.video = video;
  }

  // HELPER METHODS

  private getVideoInputError(): string | null {
    const missing: string[] = [];
    if (!this.video.title) { missing.push('title'); }
    if (!this.video.fileName) { missing.push('file name'); }
    if (!this.video.date) { missing.push('date'); }
    return missing.length > 0 ? `Enter the ${this.joinList(missing)} before uploading.` : null;
  }

  private joinList(items: string[]): string {
    if (items.length <= 1) { return items.join(''); }
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  }

  private resetSelectedMedia(): void {
    this.video = new Video();
  }
}
