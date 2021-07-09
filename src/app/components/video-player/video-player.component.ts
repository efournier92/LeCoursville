import { Component, Input, OnInit } from '@angular/core';
import { Video } from 'src/app/models/video';

@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss']
})
export class VideoPlayerComponent implements OnInit {
  @Input() videos: Video[];
  videogular: any;

  constructor() { }

  ngOnInit(): void {
  }

  initVideoPlayer(data: any) {
    this.videogular = data;
  }

}
