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
  showFallback = false;

  private eventsSubscription: Subscription;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly LOAD_TIMEOUT_MS = 8000;

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
    this.clearLoadTimer();
    this.eventsSubscription.unsubscribe();
  }

  onIframeLoad(): void {
    this.clearLoadTimer();
  }

  retry(): void {
    this.showFallback = false;
    this.videoErrorMessage = '';
    this.updateVideoUrl(this.video);
  }

  private updateVideoUrl(video: Video): void {
    this.clearLoadTimer();
    this.showFallback = false;
    const previewUrl = this.toPreviewUrl(video.urls.download);
    if (!previewUrl) {
      this.videoUrl = null;
      this.showFallback = true;
      this.videoErrorMessage =
        'This video could not be played because its Drive link could not be recognized.';
      return;
    }
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(previewUrl);
    this.videoErrorMessage = '';
    this.startLoadTimer();
  }

  // Cross-origin error pages still fire `load`, so the app cannot inspect
  // Drive's response. A missing load event is the one failure it can detect.
  private startLoadTimer(): void {
    this.loadTimer = setTimeout(() => {
      this.showFallback = true;
      this.videoErrorMessage =
        'This video is taking longer than expected to load.';
    }, VideoPlayerDriveIframeComponent.LOAD_TIMEOUT_MS);
  }

  private clearLoadTimer(): void {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
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
