import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { Track } from 'ngx-audio-player';
import { Media } from 'src/app/models/media/media';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { MediaService } from 'src/app/services/media.service';

@Component({
  selector: 'app-audio-player',
  templateUrl: './audio-player.component.html',
  styleUrls: ['./audio-player.component.scss']
})
export class AudioPlayerComponent implements OnInit, OnChanges {
  @Input() album: AudioAlbum = new AudioAlbum();

  playlist: Track[] = [];
  allTracks: Track[] = [];

  constructor(
    private mediaService: MediaService,
  ) { }

  ngOnInit(): void { }

  ngOnChanges(): void {
    this.allTracks = [];
    this.playlist = [];
    this.addTracksToPlaylist();
  }

  addTracksToPlaylist(): void {
    this.album.listing.forEach(
      (id: string) => {
        this.mediaService.getById(id).subscribe(
          (media: Media) => {
            if (media.id) {
              const track = this.mapMediaToTrack(media);
              this.allTracks.push(track);
            }
            if (this.isFinishedLoading()) {
              this.finalizePlaylist();
            }
          }
        );
      }
    );
  }

  private finalizePlaylist(): void {
    this.allTracks.sort((a, b) => (a.title > b.title) ? 1 : -1);
    this.playlist = this.allTracks;
  }

  private isFinishedLoading(): boolean {
    return this.allTracks.length === this.album.listing.length;
  }

  private mapMediaToTrack(media: Media): Track {
    return {
      title: media.title,
      artist: media.artist,
      link: media.urls.download,
    };
  }
}
