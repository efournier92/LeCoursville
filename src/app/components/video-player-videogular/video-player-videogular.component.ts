import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Video } from 'src/app/models/media/video';
import { AnalyticsService } from 'src/app/services/analytics.service';

/**
 * Native HTML5 video player (replaces the deprecated @videogular/ngx-videogular
 * wrapper, which does not support Angular 17+).
 */
@Component({
    selector: 'app-video-player-videogular',
    templateUrl: './video-player-videogular.component.html',
    styleUrls: ['./video-player-videogular.component.scss'],
    standalone: false
})
export class VideoPlayerVideogularComponent implements OnInit, OnDestroy {
  @Input() video: Video;
  @Input() events: Observable<Video>;

  @ViewChild('nativeVideo', { static: false }) nativeVideo: ElementRef<HTMLVideoElement>;

  currentVideo: Video;

  private eventsSubscription: Subscription;

  constructor(
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.currentVideo = this.video;

    this.subscribeToParentMediaChanges();

    this.analyticsService.logEvent('component_load_video_player_videogular', {
      title: this.video?.title, id: this.video?.id,
    });
  }

  ngOnDestroy() {
    this.eventsSubscription?.unsubscribe();
  }

  // SUBSCRIPTIONS

  private subscribeToParentMediaChanges() {
    if (!this.events) {
      return;
    }
    this.eventsSubscription = this.events.subscribe((media) => {
      this.currentVideo = media;
      this.nativeVideo?.nativeElement?.play();
    });
  }
}
