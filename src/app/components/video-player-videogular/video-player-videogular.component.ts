import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Video } from 'src/app/models/media/video';

@Component({
  selector: 'app-video-player-videogular',
  templateUrl: './video-player-videogular.component.html',
  styleUrls: ['./video-player-videogular.component.scss']
})
export class VideoPlayerVideogularComponent implements OnInit, OnDestroy {
  @Input() video: Video;
  @Input() events: Observable<Video>;

  videos: Video[];
  videogular: any;
  isLoading: boolean;

  private eventsSubscription: Subscription;

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
