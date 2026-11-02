import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Photo } from 'src/app/models/photo';
import { PhotoAlbum } from 'src/app/models/photo-album';
import { PhotoAlbumsService } from 'src/app/services/photo-albums.service';
import { PhotosService } from 'src/app/services/photos.service';
import { PhotoswipeService } from 'src/app/services/photoswipe.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

/**
 * User-facing album detail at /photos/:albumId. View-only: photo curation
 * (edit metadata, set cover, delete, add photos) happens on the admin side
 * at /admin/photo-albums.
 */
@Component({
    selector: 'app-photo-album-detail',
    templateUrl: './photo-album-detail.component.html',
    styleUrls: ['./photo-album-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PhotoAlbumDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  albumId = '';
  album: PhotoAlbum | null = null;
  photos: Photo[] = [];
  searchTerm = '';
  sortType: 'recent' | 'yearTaken' = 'recent';
  status: 'loading' | 'error' | 'ready' = 'loading';
  skeletonIterations = [1, 2, 3, 4, 5, 6];
  photoDimensions: { [id: string]: { width: number; height: number } } = {};

  private openedFromQuery = false;
  private lightboxOpened = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private photoAlbumsService: PhotoAlbumsService,
    private photosService: PhotosService,
    private photoswipeService: PhotoswipeService,
    private analyticsService: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.albumId = this.route.snapshot.paramMap.get('albumId') || '';
    this.subscribeToData();
  }

  private subscribeToData(): void {
    this.subscriptions.push(
      this.photoAlbumsService.getAlbum(this.albumId).subscribe(album => {
        this.album = album;
      }, () => this.onLoadError()),
    );

    this.subscriptions.push(
      this.photosService.getPhotosByAlbum(this.albumId).subscribe(photos => {
        this.photos = photos || [];
        if (this.status === 'loading') {
          this.status = 'ready';
        }
        // Children are only in the DOM after this change detection pass, so
        // (re)build the lightbox once the gallery markup exists.
        setTimeout(() => this.syncGallery(), 0);
        const targetId = this.route.snapshot.queryParamMap.get('photo');
        if (targetId && !this.openedFromQuery) {
          this.openedFromQuery = true;
          setTimeout(() => this.openPhotoSwipe(targetId), 0);
        }
      }, () => this.onLoadError()),
    );
  }

  private onLoadError(): void {
    // Whichever stream errors first wins; later emits must not clear it.
    if (this.status === 'loading') {
      this.status = 'error';
    }
  }

  onRetry(): void {
    this.status = 'loading';
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
    this.subscribeToData();
  }

  ngAfterViewInit(): void {
    this.syncGallery();
  }

  // PhotoSwipe crops a slide when it is told a square size; feed it the real
  // pixel dimensions measured from the image instead of a fixed 1600x1600.
  onPhotoImageLoad(photo: Photo, event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.naturalWidth || !img.naturalHeight) {
      return;
    }
    this.photoDimensions[photo.id] = {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
    if (
      !this.lightboxOpened &&
      Object.keys(this.photoDimensions).length === this.photos.length
    ) {
      this.syncGallery();
    }
  }

  private syncGallery(): void {
    if (this.photos.length) {
      this.photoswipeService.initForGallery('#gallery-' + this.albumId);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.photoswipeService.destroy();
  }

  getFilteredPhotos(): Photo[] {
    const term = this.searchTerm.trim().toLowerCase();
    let result = this.photos.filter(photo => {
      if (!term) {
        return true;
      }
      const haystack = `${photo.info || ''} ${photo.location || ''} ${photo.year || ''} ${photo.takenBy || ''}`.toLowerCase();
      return haystack.includes(term);
    });
    if (this.sortType === 'yearTaken') {
      result = [...result].sort((a, b) => (a.year || 0) - (b.year || 0));
    } else {
      result = [...result].sort((a, b) => {
        const ad = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const bd = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return bd - ad;
      });
    }
    return result;
  }

  hasMetadata(photo: Photo): boolean {
    return !!(photo.info || photo.takenBy || photo.location || photo.year);
  }

  openPhotoSwipe(photoId: string): void {
    const idx = this.photos.findIndex(p => p.id === photoId);
    if (idx >= 0) {
      this.lightboxOpened = true;
      this.photoswipeService.openAtIndex(idx);
      this.analyticsService.logEvent('photo_view', {
        albumId: this.albumId,
        photoId,
        index: idx,
      });
    }
  }

  onPhotoClick(photo: Photo): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { photo: photo.id },
      queryParamsHandling: 'merge',
    });
    this.openPhotoSwipe(photo.id);
  }

  onStartSlideshow(): void {
    this.router.navigate(['/photos', this.albumId, 'slideshow']);
  }
}
