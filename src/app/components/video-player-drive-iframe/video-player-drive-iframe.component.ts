import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Video } from 'src/app/models/media/video';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
    selector: 'app-video-player-drive-iframe',
    templateUrl: './video-player-drive-iframe.component.html',
    styleUrls: ['./video-player-drive-iframe.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
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

  private updateVideoUrl(video: Video): void {
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.toPreviewUrl(video.urls.download),
    );
  }

  // Drive only embeds /preview; /view and /edit links refuse to frame.
  private toPreviewUrl(url: string): string {
    if (!url) {
      return url;
    }
    const openId = url.match(/[?&]id=([^&#]+)/);
    if (openId && /^(https:\/\/)?(docs|drive)\.google\.com\/open/.test(url)) {
      return `https://drive.google.com/file/d/${openId[1]}/preview`;
    }
    const fileId = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId[1]}/preview`;
    }
    return url;
  }
}
