import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
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
})
export class PhotoAlbumDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  albumId = '';
  album: PhotoAlbum | null = null;
  photos: Photo[] = [];
  searchTerm = '';
  sortType: 'recent' | 'yearTaken' = 'recent';
  showSpinner = true;
  skeletonIterations = [1, 2, 3, 4, 5, 6];

  private openedFromQuery = false;
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

    this.subscriptions.push(
      this.photoAlbumsService.getAlbum(this.albumId).subscribe(album => {
        this.album = album;
      }),
    );

    this.subscriptions.push(
      this.photosService.getPhotosByAlbum(this.albumId).subscribe(photos => {
        this.photos = photos || [];
        this.showSpinner = false;
        const targetId = this.route.snapshot.queryParamMap.get('photo');
        if (targetId && !this.openedFromQuery) {
          this.openedFromQuery = true;
          setTimeout(() => this.openPhotoSwipe(targetId), 0);
        }
      }),
    );
  }

  ngAfterViewInit(): void {
    if (this.albumId) {
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
