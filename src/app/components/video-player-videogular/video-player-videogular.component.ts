import { Component, Input, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Video } from 'src/app/models/media';

@Component({
  selector: 'app-video-player-videogular',
  templateUrl: './video-player-videogular.component.html',
  styleUrls: ['./video-player-videogular.component.scss']
})
export class VideoPlayerVideogularComponent implements OnInit {
  @Input() video: Video;
  videos: Video[];
  videogular: any;

  private eventsSubscription: Subscription;
  @Input() events: Observable<Video>;
  isLoading: boolean;

  constructor() { }

  ngOnInit(): void {
    this.videos = [this.video];

    this.subscribeToParentMediaChanges();
  }

  ngOnDestroy() {
    this.eventsSubscription.unsubscribe();
  }

  initVideoPlayer(data: any) {
    this.videogular = data;

    data.getDefaultMedia().subscriptions.loadStart.subscribe(
      () => {
        this.isLoading = true;
      }
    );
  }

  private subscribeToParentMediaChanges() {
    this.events.subscribe((media) => {
      this.videos = [media];
      this.videogular.play();
    });
  }
}
