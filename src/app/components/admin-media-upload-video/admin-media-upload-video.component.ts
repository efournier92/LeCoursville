import { Component, OnInit } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';
import { Video } from 'src/app/models/media/video';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { MediaService } from 'src/app/services/media.service';
import { VideoUploadService } from 'src/app/services/video-upload.service';

@Component({
  selector: 'app-admin-media-upload-video',
  templateUrl: './admin-media-upload-video.component.html',
  styleUrls: ['./admin-media-upload-video.component.scss']
})
export class AdminMediaUploadVideoComponent implements OnInit {
  video: Video = new Video();
  user: User;

  constructor(
    private authService: AuthService,
    private videoUploadService: VideoUploadService,
    private mediaService: MediaService,
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

  onUploadSelectedMedia(): void {
    if (!this.isValidVideoInput()) { return; }

    this.videoUploadService.upload(this.video);

    this.resetSelectedMedia();
  }

  onDeleteSelectedMedia(media: UploadableMedia): void {
    this.mediaService.deleteMedia(media);
    this.resetSelectedMedia();
  }

  onCancelSelectedMedia(): void {
    this.resetSelectedMedia();
  }

  onMediaSelect(video: Video): void {
    this.video = video;
  }

  // HELPER METHODS

  private isValidVideoInput(): boolean {
    return !!this.video.title && !!this.video.date && !!this.video.fileName;
  }

  private resetSelectedMedia(): void {
    this.video = new Video();
  }
}
