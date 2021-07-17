import { Component, Input, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Video } from 'src/app/models/media';

@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss']
})
export class VideoPlayerComponent implements OnInit {
  @Input() video: Video;
  videos: Video[];
  videogular: any;

  private eventsSubscription: Subscription;
  @Input() events: Observable<Video>;

  constructor() { }

  ngOnInit(): void {
    this.videos = [this.video];
    this.eventsSubscription = this.events.subscribe((media) => {
      this.videos = [media];
      this.videogular.play();
    });
  }

  ngOnDestroy() {
    this.eventsSubscription.unsubscribe();
  }

  initVideoPlayer(data: any) {
    this.videogular = data;
  }

}
