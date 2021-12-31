import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { MediaConstants } from 'src/app/constants/media-constants';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { User } from 'src/app/models/user';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-media-audio',
  templateUrl: './media-audio.component.html',
  styleUrls: ['./media-audio.component.scss']
})
export class MediaAudioComponent implements OnInit {
  selectedAlbum: AudioAlbum;
  eventsSubject: Subject<AudioAlbum> = new Subject<AudioAlbum>();
  user: User;

  constructor(
    private authService: AuthService,
    private analyticsService: AnalyticsService
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

  getAudioAlbumTypeId(): string {
    return MediaConstants.AUDIO_ALBUM.id;
  }

  onMediaSelect(album: AudioAlbum): void {
    this.selectedAlbum = album;
    this.analyticsService.logEvent('audio_album_select', { audioAlbum: album, user: this.user.id });
  }
}
