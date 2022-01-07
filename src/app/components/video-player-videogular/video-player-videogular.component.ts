import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Video } from 'src/app/models/media/video';
import { AnalyticsService } from 'src/app/services/analytics.service';

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

  constructor(
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.videos = [this.video];

    this.subscribeToParentMediaChanges();

    this.analyticsService.logEvent('component_load_video_player_videogular', {
      title: this.video?.title, id: this.video?.id,
    });
  }

  ngOnDestroy() {
    this.eventsSubscription.unsubscribe();
  }

  // SUBSCRIPTIONS

  private subscribeToParentMediaChanges() {
    this.events.subscribe((media) => {
      this.videos = [media];
      this.videogular.play();
    });
  }

  // PUBLIC METHODS

  initVideoPlayer(data: any) {
    this.videogular = data;

    data.getDefaultMedia().subscriptions.loadStart.subscribe(
      () => {
        this.isLoading = true;
      }
    );
  }
}
