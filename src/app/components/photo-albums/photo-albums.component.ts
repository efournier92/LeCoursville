import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Photo } from 'src/app/models/photo';
import { PhotoAlbum } from 'src/app/models/photo-album';
import { PhotoAlbumsService } from 'src/app/services/photo-albums.service';
import { PhotosService } from 'src/app/services/photos.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

/**
 * User-facing album grid at /photos. View-only: album curation (create,
 * rename, delete, upload) happens on the admin side at /admin/photo-albums.
 */
@Component({
    selector: 'app-photo-albums',
    templateUrl: './photo-albums.component.html',
    styleUrls: ['./photo-albums.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PhotoAlbumsComponent implements OnInit, OnDestroy {
  albums: PhotoAlbum[] = [];
  photos: Photo[] = [];
  searchTerm = '';
  sortType: 'recent' | 'title' = 'recent';

  private subscriptions: Subscription[] = [];

  constructor(
    private photoAlbumsService: PhotoAlbumsService,
    private photosService: PhotosService,
    private router: Router,
    private analyticsService: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.photoAlbumsService.albums$.subscribe(albums => {
        this.albums = albums || [];
      }),
    );

    this.subscriptions.push(
      this.photosService.nonMessagePhotos$.subscribe(photos => {
        this.photos = photos || [];
      }),
    );

    this.analyticsService.logEvent('photo_album_view', {});
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  resolveCover(album: PhotoAlbum): string | null {
    if (album.coverPhotoId) {
      const cover = this.photos.find(p => p.id === album.coverPhotoId);
      if (cover?.url) {
        return cover.url;
      }
    }
    const first = this.photos.find(p => p.albumId === album.id && p.url);
    return first?.url || null;
  }

  getPhotoCount(album: PhotoAlbum): number {
    return this.photos.filter(p => p.albumId === album.id).length;
  }

  getFilteredAlbums(): PhotoAlbum[] {
    const term = this.searchTerm.trim().toLowerCase();
    let result = this.albums.filter(album => {
      if (!term) {
        return true;
      }
      return album.title.toLowerCase().includes(term);
    });
    if (this.sortType === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result = [...result].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return result;
  }

  onAlbumClick(album: PhotoAlbum): void {
    this.analyticsService.logEvent('photo_album_open', { albumId: album.id });
    this.router.navigate(['/photos', album.id]);
  }
}
