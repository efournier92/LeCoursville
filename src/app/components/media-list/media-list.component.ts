import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media';
import { MediaTypesService } from 'src/app/services/media-types-service.service';
import { MediaService } from 'src/app/services/media.service';
import { MediaIconsService } from 'src/assets/img/media-placeholders/services/media-icons.service';

@Component({
  selector: 'app-media-list',
  templateUrl: './media-list.component.html',
  styleUrls: ['./media-list.component.scss']
})
export class MediaListComponent implements OnInit {
  allMedia: Array<Media> = [];
  filteredMedia: Array<Media>;
  private loadedMedia: Array<Media> = [];
  
  @Output() mediaClickEvent = new EventEmitter<Media>();

  constructor(
    private mediaService: MediaService,
    private mediaIconsService: MediaIconsService,
  ) { }

  ngOnInit(): void {
    this.subscribeToMediaObservable();
  }

  subscribeToMediaObservable() {
    this.mediaService.mediaObservable.subscribe(
      (mediaList) => {
          this.allMedia = mediaList;
          this.filteredMedia = this.mediaService.tryLoadingFirstBatch(this.allMedia, this.loadedMedia);
      }
    )
  }

  getPlaceholderName(mediaType: string): string  {
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
    this.filteredMedia = this.mediaService.loadMoreMedia(10, this.allMedia, this.loadedMedia);
  }

  shouldShowLoadMore(): boolean {
    return this.allMedia?.length && this.loadedMedia.length !== this.allMedia.length;
  }

}
