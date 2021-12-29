import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { MediaConstants } from 'src/app/constants/media-constants';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-audio',
  templateUrl: './audio.component.html',
  styleUrls: ['./audio.component.scss']
})
export class AudioComponent implements OnInit {
  selectedAlbum: AudioAlbum;
  eventsSubject: Subject<AudioAlbum> = new Subject<AudioAlbum>();

  constructor(
    private analyticsService: AnalyticsService
  ) { }

  ngOnInit(): void { }

  getAudioAlbumTypeId(): string {
    return MediaConstants.AUDIO_ALBUM.id;
  }

  onMediaSelect(album: AudioAlbum): void {
    this.selectedAlbum = album;
    this.analyticsService.logEvent('audio_album_select', album);
  }
}
