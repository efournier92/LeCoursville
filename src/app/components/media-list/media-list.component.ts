import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';
import { MediaService } from 'src/app/services/media.service';
import { MediaIconsService } from 'src/assets/img/media-placeholders/services/media-icons.service';

@Component({
  selector: 'app-media-list',
  templateUrl: './media-list.component.html',
  styleUrls: ['./media-list.component.scss']
})
export class MediaListComponent implements OnInit {
  @Input() mediaTypesToShow: string[];

  @Output() mediaClickEvent = new EventEmitter<Media>();

  allMedia: Array<Media> = [];
  filteredMedia: Array<Media>;
  private loadedMedia: Array<Media> = [];

  constructor(
    private mediaService: MediaService,
    private mediaIconsService: MediaIconsService,
  ) { }

  ngOnInit(): void {
    this.subscribeToMediaObservable();

    if (!this.mediaTypesToShow) {
      this.mediaTypesToShow = this.getDefaultMediaTypes();
    }

    if (this.mediaTypesToShow) {
      this.filteredMedia = this.filterAllMediaByType();
    }
  }

  private getDefaultMediaTypes(): string[] {
    return [
      MediaConstants.VIDEO.id,
      MediaConstants.AUDIO_ALBUM.id,
      MediaConstants.PHOTO_ALBUM.id,
      MediaConstants.DOC.id
    ];
  }

  subscribeToMediaObservable() {
    this.mediaService.mediaObservable.subscribe(
      (mediaList) => {
        this.allMedia = mediaList;
        this.filteredMedia = this.filterAllMediaByType();
      }
    );
  }

  filterAllMediaByType() {
    return this.mediaService.filterByTypes(this.mediaTypesToShow, this.allMedia);
  }

  getPlaceholderName(mediaType: string): string {
    return this.mediaIconsService.getPlaceholderNameByMediaType(mediaType);
  }

  onImageLoaded(media: any): void {
    media.isIconLoaded = true;
  }

  onMediaSelect(media: Media): void {
    this.mediaClickEvent.emit(media);
  }

  onSelectMediaType(selectedTypes: string[]): void {
    this.filteredMedia = this.mediaService.filterByTypes(selectedTypes, this.allMedia);
  }

  onSearchInputChange(query: string): void {
    this.filteredMedia = this.mediaService.filterByQuery(query, this.allMedia);
  }

  onLoadMore(): void {
    this.filteredMedia = this.mediaService.loadMoreMedia(1000, this.allMedia, this.loadedMedia);
  }

  shouldShowLoadMore(): boolean {
    return this.allMedia?.length && this.loadedMedia.length !== this.allMedia.length;
  }
}
