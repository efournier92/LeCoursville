import { Component, Input, OnInit, AfterViewChecked } from '@angular/core';
import { InitDetail } from 'lightgallery/lg-events';
import { LightGallery } from 'lightgallery/lightgallery';
import { Media } from 'src/app/models/media/media';
import { PhotoAlbum } from 'src/app/models/media/photo-album';
import lgZoom from 'lightgallery/plugins/zoom';
import lgAutoplay from 'lightgallery/plugins/autoplay';
import { MediaService } from 'src/app/services/media.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-photo-album',
  templateUrl: './photo-album.component.html',
  styleUrls: ['./photo-album.component.scss']
})
export class PhotoAlbumComponent implements OnInit, AfterViewChecked {
  @Input() album: PhotoAlbum;

  photos: Media[] = new Array<Media>();
  needsRefresh: any;

  private lightGallery: LightGallery;

  lightGallerySettings = {
    plugins: [lgZoom, lgAutoplay],
    counter: true,
    thumbnail: true,
    showZoomInOutIcons: true,
    autoplay: true,
    progressBar: true,
    showCloseIcon: true
  };

  constructor(
    private mediaService: MediaService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.initializeAlbumListing();
    this.analyticsService.logEvent('component_load_media_photo_album', { });
  }

  ngAfterViewChecked(): void {
    if (this.needsRefresh) {
        this.lightGallery.refresh();
        this.needsRefresh = false;
    }
  }

  // PUBLIC METHODS

  onLightGalleryInit = (detail: InitDetail): void => {
    this.lightGallery = detail.instance;
  }

  // HELPER METHODS
  private initializeAlbumListing() {
    this.album.listing.forEach(
      (id: string) => {
        // this.subscribeToGetMediaObservable(id);
      }
    );
  }

  private subscribeToGetMediaObservable(id: string) {
    // this.mediaService.getById(id).subscribe(
    //   (media: Media) => {
    //     if (media.id) {
    //       this.photos.push(media);
    //       this.needsRefresh = true;
    //     }
    //   }
    // );
  }
}
