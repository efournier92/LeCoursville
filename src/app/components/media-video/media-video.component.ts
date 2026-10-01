import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { User } from 'src/app/models/user';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
    selector: 'app-media-video',
    templateUrl: './media-video.component.html',
    styleUrls: ['./media-video.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MediaVideoComponent implements OnInit {
  selectedAlbum: any;
  user: User;

  constructor(
    private authService: AuthService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user,
      // Template is a static wrapper around app-media-explorer; user only
      // feeds analytics ids, so there is no blank state to cover.
      () => {},
    );
  }

  // PUBLIC METHODS

  getVideoTypeId(): string {
    return MediaConstants.VIDEO.id;
  }

  onMediaSelect(video: AudioAlbum): void {
    this.selectedAlbum = video;
    this.analyticsService.logEvent('video_select', {
      title: video?.title, id: video?.id, userId: this.user?.id,
    });
  }
}
