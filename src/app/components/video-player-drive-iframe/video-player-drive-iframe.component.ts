import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Video } from 'src/app/models/media';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'; 

@Component({
  selector: 'app-video-player-drive-iframe',
  templateUrl: './video-player-drive-iframe.component.html',
  styleUrls: ['./video-player-drive-iframe.component.scss']
})
export class VideoPlayerDriveIframeComponent implements OnInit {
  @Input() video: Video;
  videos: Video[];
  videogular: any;
  isLoading: boolean;
  videoUrl: SafeResourceUrl;
  @ViewChild('videoElement') videoElement: ElementRef<HTMLElement>;

  private eventsSubscription: Subscription;
  @Input() events: Observable<Video>;

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

  ngOnDestroy() {
    this.eventsSubscription.unsubscribe();
  }

  private updateVideoUrl(video: Video) {
    const url = video.url;
    // const url = video.url + "?autoplay=1";
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.playVideo();
  }

  private playVideo() {
    setTimeout(() => {
      let el: HTMLElement = this.videoElement.nativeElement;
      el.click();
      setTimeout(() => {
        el.click();
      }, 1000);
  }, 3000);
  }

  // ngOnDestroy() {
  //   this.eventsSubscription.unsubscribe();
  // }

  // initVideoPlayer(data: any) {
  //   this.videogular = data;

  //   data.getDefaultMedia().subscriptions.loadStart.subscribe(
  //     () => {
  //       this.isLoading = true;
  //       console.log("CAN PLAY!");
  //       // Set the video to the beginning
  //       // this.api.getDefaultMedia().currentTime = 0;
  //     }
  //   );

  //   // https://github.com/videogular/videogular2/blob/master/docs/getting-started/using-the-api.md
  //   data.getDefaultMedia().subscriptions.play.subscribe(
  //     () => {
  //       this.isLoading = false;
  //       console.log("CAN PLAY!");
  //       // Set the video to the beginning
  //       // this.api.getDefaultMedia().currentTime = 0;
  //     }
  //   );
  // }
}
