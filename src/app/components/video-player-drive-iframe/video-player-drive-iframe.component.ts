import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Video } from 'src/app/models/media/video';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RoutingService } from 'src/app/services/routing.service';

@Component({
  selector: 'app-video-player-drive-iframe',
  templateUrl: './video-player-drive-iframe.component.html',
  styleUrls: ['./video-player-drive-iframe.component.scss']
})
export class VideoPlayerDriveIframeComponent implements OnInit, OnDestroy {
  @Input() video: Video;
  @Input() events: Observable<Video>;

  videos: Video[];
  videogular: any;
  isLoading: boolean;
  videoUrl: SafeResourceUrl;

  private eventsSubscription: Subscription;

  constructor(
    private sanitizer: DomSanitizer,
    private routingService: RoutingService,
  ) { }

  ngOnInit(): void {
    this.updateVideoUrl(this.video);

    this.eventsSubscription = this.events.subscribe(
      (video: Video) => {
        this.updateVideoUrl(video);
      }
    );
  }

  ngOnDestroy(): void {
    this.eventsSubscription.unsubscribe();
  }

  getLinkToShare(): string {
    return this.routingService.getCurrentLocation();
  }

  private updateVideoUrl(video: Video): void {
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(video.urls.download);
  }
}
