import { Component, OnInit } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { User } from 'src/app/models/user';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-media-video',
  templateUrl: './media-video.component.html',
  styleUrls: ['./media-video.component.scss']
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
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  getVideoTypeId(): string {
    return MediaConstants.VIDEO.id;
  }

  onMediaSelect(album: AudioAlbum): void {
    this.selectedAlbum = album;
    this.analyticsService.logEvent('video_select', { audioAlbum: album, user: this.user.id });
  }
}
