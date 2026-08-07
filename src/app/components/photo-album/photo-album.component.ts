import { Component, Input, OnInit } from '@angular/core';
import { UploadableMedia } from 'src/app/models/media/media';
import { PhotoAlbum } from 'src/app/models/photo-album';
import { AnalyticsService } from 'src/app/services/analytics.service';

/**
 * @deprecated Legacy media-explorer album viewer. Its lightgallery integration
 * was a hollow shell (the media subscription has been commented out for
 * months), and the curated album experience now lives in the photo-albums
 * feature (/photos, /photos/:albumId). Kept as a plain image grid so any
 * existing usage in the media explorer does not break.
 */
@Component({
    selector: 'app-photo-album',
    templateUrl: './photo-album.component.html',
    styleUrls: ['./photo-album.component.scss'],
    standalone: false
})
export class PhotoAlbumComponent implements OnInit {
  @Input() album: PhotoAlbum;

  photos: UploadableMedia[] = [];

  constructor(
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.analyticsService.logEvent('component_load_media_photo_album', { });
  }
}
