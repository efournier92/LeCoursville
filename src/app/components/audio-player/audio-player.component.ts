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

  // LIFECYCLE HOOKS

  ngOnInit(): void { }

  ngOnChanges(): void {
    this.allTracks = [];
    this.playlist = [];
    this.addTracksToPlaylist();
  }

  // HELPER METHODS

  addTracksToPlaylist(): void {
    this.album.listing.forEach(
      (id: string) => {
        const audioTrack = this.mediaService.getMediaById(id);
        if (audioTrack.id) {
          const track = this.mapMediaToTrack(audioTrack);
          this.playlist.push(track);
        }
      }
    );
  }

  private mapMediaToTrack(media: Media): Track {
    return {
      title: media.title,
      artist: media.artist,
      link: media.urls.download,
    };
  }
}
