import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Photo } from 'src/app/models/photo';
import { PhotosService } from 'src/app/services/photos.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

const KEN_BURNS_CLASSES = ['kenburns-tl-br', 'kenburns-tr-bl', 'kenburns-bl-tr', 'kenburns-br-tl'];

@Component({
  selector: 'app-photo-slideshow',
  templateUrl: './photo-slideshow.component.html',
  styleUrls: ['./photo-slideshow.component.scss'],
})
export class PhotoSlideshowComponent implements OnInit, OnDestroy {
  albumId = '';
  photos: Photo[] = [];
  shuffled: Photo[] = [];
  currentIndex = 0;
  slideDurationMs = 8000;
  isPlaying = true;
  kenBurnsClass = '';
  private photosViewed = 0;
  private intervalHandle: any = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private photosService: PhotosService,
    private analyticsService: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.albumId = this.route.snapshot.paramMap.get('albumId') || '';
    const durationParam = this.route.snapshot.queryParamMap.get('duration');
    if (durationParam) {
      const seconds = Number(durationParam);
      if (seconds === 5 || seconds === 8 || seconds === 12 || seconds === 15) {
        this.slideDurationMs = seconds * 1000;
      }
    }

    this.subscriptions.push(
      this.photosService.getPhotosByAlbum(this.albumId).subscribe(photos => {
        this.photos = photos || [];
        this.restart();
        this.analyticsService.logEvent('photo_slideshow_start', {
          albumId: this.albumId,
          durationMs: this.slideDurationMs,
          photoCount: this.shuffled.length,
        });
      }),
    );
  }

  ngOnDestroy(): void {
    this.clearInterval();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  currentPhoto(): Photo | null {
    if (!this.shuffled.length) {
      return null;
    }
    return this.shuffled[this.currentIndex % this.shuffled.length];
  }

  private restart(): void {
    this.shuffled = this.shuffle([...this.photos]);
    this.currentIndex = 0;
    this.isPlaying = true;
    this.photosViewed = 0;
    this.applyKenBurns();
    this.startInterval();
  }

  private shuffle(arr: Photo[]): Photo[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private pickNext(): void {
    if (!this.shuffled.length) {
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.shuffled.length;
    this.photosViewed += 1;
    this.applyKenBurns();
    this.startInterval();
  }

  private applyKenBurns(): void {
    // Changing animation-name is what restarts the CSS animation on the same
    // <img> element, so avoid picking the same direction twice in a row.
    let idx: number;
    do {
      idx = Math.floor(Math.random() * KEN_BURNS_CLASSES.length);
    } while (KEN_BURNS_CLASSES[idx] === this.kenBurnsClass && KEN_BURNS_CLASSES.length > 1);
    this.kenBurnsClass = KEN_BURNS_CLASSES[idx];
  }

  private startInterval(): void {
    this.clearInterval();
    if (!this.isPlaying) {
      return;
    }
    this.intervalHandle = setTimeout(() => this.pickNext(), this.slideDurationMs);
  }

  private clearInterval(): void {
    if (this.intervalHandle) {
      clearTimeout(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  togglePlay(): void {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.startInterval();
    } else {
      this.clearInterval();
    }
  }

  next(): void {
    this.pickNext();
  }

  prev(): void {
    if (!this.shuffled.length) {
      return;
    }
    this.currentIndex = (this.currentIndex - 1 + this.shuffled.length) % this.shuffled.length;
    this.photosViewed += 1;
    this.applyKenBurns();
    this.startInterval();
  }

  exit(): void {
    this.analyticsService.logEvent('photo_slideshow_exit', {
      albumId: this.albumId,
      photosViewed: this.photosViewed,
    });
    this.router.navigate(['/photos', this.albumId]);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.exit();
    } else if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      this.togglePlay();
    } else if (event.key === 'ArrowRight') {
      this.next();
    } else if (event.key === 'ArrowLeft') {
      this.prev();
    }
  }
}
