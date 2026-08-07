import { Component, Input, OnChanges, ViewChild, ElementRef } from '@angular/core';
import { UploadableMedia } from 'src/app/models/media/media';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { MediaService } from 'src/app/services/media.service';

interface AudioTrack {
  title: string;
  artist: string;
  url: string;
}

/**
 * Native HTML5 audio player (replaces the deprecated ngx-audio-player wrapper,
 * which does not support Angular 17+).
 */
@Component({
    selector: 'app-audio-player',
    templateUrl: './audio-player.component.html',
    styleUrls: ['./audio-player.component.scss'],
    standalone: false
})
export class AudioPlayerComponent implements OnChanges {
  @Input() album: AudioAlbum = new AudioAlbum();

  @ViewChild('nativeAudio', { static: false }) nativeAudio: ElementRef<HTMLAudioElement>;

  tracks: AudioTrack[] = [];
  currentTrack: AudioTrack | null = null;

  constructor(
    private mediaService: MediaService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnChanges(): void {
    this.tracks = [];
    this.currentTrack = null;
    this.addTracksToPlaylist();
  }

  // PUBLIC METHODS

  selectTrack(track: AudioTrack): void {
    if (!track.url) {
      return;
    }
    this.currentTrack = track;
    const audio = this.nativeAudio?.nativeElement;
    if (audio) {
      audio.load();
      audio.play().catch(() => {});
    }
  }

  // HELPER METHODS

  addTracksToPlaylist(): void {
    this.album?.listing?.forEach(
      (id: string) => {
        const audioTrack = this.mediaService.getMediaById(id);
        if (audioTrack.id && audioTrack.urls?.download) {
          this.tracks.push({
            title: audioTrack.title,
            artist: audioTrack.artist,
            url: audioTrack.urls.download,
          });
        }
      }
    );
    if (this.tracks.length > 0) {
      this.currentTrack = this.tracks[0];
    }
  }
}
