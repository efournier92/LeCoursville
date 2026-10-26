import { Component, Input, OnChanges, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { UploadableMedia } from 'src/app/models/media/media';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { MediaService } from 'src/app/services/media.service';

interface AudioTrack {
  title: string;
  artist: string;
  url: string;
}

/**
 * Audio player with a component-owned transport around a native HTML5 element
 * (replaces the deprecated ngx-audio-player wrapper, unsupported on Angular 17+).
 */
@Component({
    selector: 'app-audio-player',
    templateUrl: './audio-player.component.html',
    styleUrls: ['./audio-player.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AudioPlayerComponent implements OnChanges {
  @Input() album: AudioAlbum = new AudioAlbum();

  @ViewChild('mediaElement', { static: false }) mediaElement: ElementRef<HTMLAudioElement>;

  tracks: AudioTrack[] = [];
  currentTrack: AudioTrack | null = null;
  isPlaying = false;
  elapsed = 0;
  duration = 0;
  volume = 1;
  muted = false;

  constructor(
    private mediaService: MediaService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnChanges(): void {
    this.tracks = [];
    this.currentTrack = null;
    this.resetTransport();
    this.addTracksToPlaylist();
  }

  // PUBLIC METHODS

  selectTrack(track: AudioTrack): void {
    if (!track.url) {
      return;
    }
    this.currentTrack = track;
    this.resetTransport();
    const audio = this.mediaElement?.nativeElement;
    if (!audio) {
      return;
    }
    audio.load();
    this.startPlayback(audio);
  }

  togglePlay(): void {
    const audio = this.mediaElement?.nativeElement;
    if (!audio || !this.currentTrack?.url) {
      return;
    }
    if (this.isPlaying) {
      audio.pause();
      this.isPlaying = false;
      return;
    }
    this.startPlayback(audio);
  }

  onTimeUpdate(): void {
    const audio = this.mediaElement?.nativeElement;
    if (!audio) {
      return;
    }
    this.elapsed = audio.currentTime || 0;
    this.syncDuration(audio);
  }

  onLoadedMetadata(): void {
    const audio = this.mediaElement?.nativeElement;
    if (audio) {
      this.syncDuration(audio);
    }
  }

  onEnded(): void {
    const index = this.currentTrack ? this.tracks.indexOf(this.currentTrack) : -1;
    const next = index >= 0 ? this.tracks[index + 1] : undefined;
    if (next) {
      this.selectTrack(next);
      return;
    }
    const audio = this.mediaElement?.nativeElement;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.isPlaying = false;
    this.elapsed = 0;
  }

  onVolumeChange(): void {
    const audio = this.mediaElement?.nativeElement;
    if (!audio) {
      return;
    }
    this.volume = audio.volume;
    this.muted = audio.muted;
  }

  onSeek(event: Event): void {
    const audio = this.mediaElement?.nativeElement;
    const value = Number((event.target as HTMLInputElement).value);
    if (!audio || Number.isNaN(value)) {
      return;
    }
    audio.currentTime = value;
    this.elapsed = value;
  }

  onVolumeInput(event: Event): void {
    const audio = this.mediaElement?.nativeElement;
    const value = Number((event.target as HTMLInputElement).value);
    if (!audio || Number.isNaN(value)) {
      return;
    }
    audio.volume = value;
    audio.muted = value === 0;
    this.volume = value;
    this.muted = value === 0;
  }

  toggleMute(): void {
    const audio = this.mediaElement?.nativeElement;
    if (!audio) {
      return;
    }
    audio.muted = !audio.muted;
    this.muted = audio.muted;
  }

  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    return `${minutes}:${(total % 60).toString().padStart(2, '0')}`;
  }

  seekValueText(): string {
    return `${this.formatTime(this.elapsed)} of ${this.formatTime(this.duration)}`;
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

  private startPlayback(audio: HTMLAudioElement): void {
    this.isPlaying = true;
    const playback = audio.play();
    // A rejected play promise is an expected autoplay block, not an error.
    playback?.catch(() => {
      this.isPlaying = false;
    });
  }

  private resetTransport(): void {
    this.isPlaying = false;
    this.elapsed = 0;
    this.duration = 0;
  }

  private syncDuration(audio: HTMLAudioElement): void {
    if (Number.isFinite(audio.duration)) {
      this.duration = audio.duration;
    }
  }
}
