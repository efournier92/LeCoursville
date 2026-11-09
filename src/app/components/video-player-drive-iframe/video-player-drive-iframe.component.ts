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
  videoUrl: SafeResourceUrl | null;
  videoErrorMessage = '';

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
    const previewUrl = this.toPreviewUrl(video.urls.download);
    if (!previewUrl) {
      this.videoUrl = null;
      this.videoErrorMessage =
        'This video could not be played because its Drive link could not be recognized.';
      return;
    }
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(previewUrl);
    this.videoErrorMessage = '';
  }

  // Drive only embeds /preview; /view, /edit, /open, and /uc links need
  // normalizing. Anything else returns null so the caller fails visibly
  // instead of framing an unvalidated URL.
  private toPreviewUrl(url: string): string | null {
    if (!url) {
      return null;
    }
    const fileId = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    if (fileId) {
      return this.previewUrl(fileId[1], url);
    }
    const openId = url.match(/[?&]id=([^&#]+)/);
    if (
      openId &&
      /^(https:\/\/)?(docs|drive)\.google\.com\/(open|uc)([?#&]|$)/.test(url)
    ) {
      return this.previewUrl(openId[1], url);
    }
    return null;
  }

  private previewUrl(fileId: string, url: string): string {
    const resourceKey = url.match(/[?&]resourcekey=([^&#]+)/);
    return `https://drive.google.com/file/d/${fileId}/preview${
      resourceKey ? `?resourcekey=${resourceKey[1]}` : ''
    }`;
  }
}
