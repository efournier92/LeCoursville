import { Component, Input, OnInit } from '@angular/core';
import { Track } from 'ngx-audio-player';
import { SampleMediaService } from 'src/app/constants/sample-media';
import { MusicAlbum } from 'src/app/models/media';

@Component({
  selector: 'app-audio-player',
  templateUrl: './audio-player.component.html',
  styleUrls: ['./audio-player.component.scss']
})
export class AudioPlayerComponent implements OnInit {
  @Input() album: MusicAlbum = new MusicAlbum();
  tracks: Track[] = new Array<Track>();

  constructor() { }

  ngOnInit(): void {
    const sampleMediaService = new SampleMediaService();

    this.tracks = sampleMediaService.getTracks();
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
  msaapPlaylist: Track[] = [
    {
      title: 'Audio One Title',
      link: 'https://www.googleapis.com/drive/v3/files/14uYyXC74ObyOdRSwkUTN_rbUh6XrR1MH?alt=media&key=AIzaSyB0O5xzuR9PvyU_5YHq8byjOcMk1adqbVg',
      artist: 'Audio One Artist',
      duration: 123
    },
    {
      title: 'Audio Two Title',
      link: 'https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_700KB.mp3',
      artist: 'Audio Two Artist',
      duration: 123
    },
    {
      title: 'Audio Three Title',
      link: 'https://file-examples-com.github.io/uploads/2017/11/file_example_MP3_700KB.mp3',
      artist: 'Audio Three Artist',
      duration: 123
    },
  ];

  onEnded(event: any) {
    
  }

}
