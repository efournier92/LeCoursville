import { Component, Input, OnInit } from '@angular/core';
import { Track } from 'ngx-audio-player';
import { Observable } from 'rxjs';
import { Subscription } from 'rxjs';
import { SampleMediaService } from 'src/app/constants/sample-media';
import { AudioAlbum, Media } from 'src/app/models/media';
import { MediaService } from 'src/app/services/media.service';

@Component({
  selector: 'app-audio-player',
  templateUrl: './audio-player.component.html',
  styleUrls: ['./audio-player.component.scss']
})
export class AudioPlayerComponent implements OnInit {
  @Input() album: AudioAlbum = new AudioAlbum();
  tracks: Track[] = new Array<Track>();

  private eventsSubscription: Subscription;
  @Input() events: Observable<Media>;

  constructor(
    private mediaService: MediaService,
  ) { }

  ngOnInit(): void {
    // this.msaapPlaylist = this.tracks

    // this.tracks = this.album.listing;

    this.album.listing.forEach(
      (id: string) => {
        this.mediaService.getById(id).subscribe(
          (media: Media) => {
          if (media.id) {
              const track = this.mapMediaToTrack(media);
              this.tracks.push(track);
              this.tracks.sort((a, b) => (a.title > b.title) ? 1 : -1)
            }
          }
        );
      }
    );

    // this.eventsSubscription = this.events.subscribe((media) => {
    //   this.tracks = media.listing;
    // });
  }

  mapMediaToTrack(media: Media) {
    return {
      title: media.name,
      link: media.url,
      artist: media.author,
      duration: 123
    }
  }

  msaapDisplayTitle = true;
  msaapDisplayPlayList = true;
  msaapPageSizeOptions = [2, 4, 6];
  msaapDisplayVolumeControls = true;
  msaapDisplayRepeatControls = true;
  msaapDisplayArtist = false;
  msaapDisplayDuration = false;
  msaapDisablePositionSlider = true;

  // Material Style Advance Audio Player Playlist
  // msaapPlaylist: Track[] = [
  //   {
  //     title: 'Audio One Title',
  //     link: 'https://www.googleapis.com/drive/v3/files/14uYyXC74ObyOdRSwkUTN_rbUh6XrR1MH?alt=media&key=AIzaSyB0O5xzuR9PvyU_5YHq8byjOcMk1adqbVg',
  //     artist: 'Audio One Artist',
  //     duration: 123
  //   },
  //   {
  //     title: 'Audio Two Title',
  //     link: 'https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_700KB.mp3',
  //     artist: 'Audio Two Artist',
  //     duration: 123
  //   },
  //   {
  //     title: 'Audio Three Title',
  //     link: 'https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_700KB.mp3',
  //     artist: 'Audio Three Artist',
  //     duration: 123
  //   },
  // ];

  onEnded(event: any) {
    
  }

}
