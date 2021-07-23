import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Media } from 'src/app/models/media';
import { MediaTypesService } from 'src/app/services/media-types-service.service';
import { MediaService } from 'src/app/services/media.service';

@Component({
  selector: 'app-media-list',
  templateUrl: './media-list.component.html',
  styleUrls: ['./media-list.component.scss']
})
export class MediaListComponent implements OnInit {
  filteredMedia: Array<Media>;
  allMedia: Array<Media>;
  @Output() mediaClickEvent = new EventEmitter<Media>();
  
  constructor(
    private mediaService: MediaService,
    private mediaTypesService: MediaTypesService
  ) { }

  ngOnInit(): void {
    this.mediaService.mediaObservable.subscribe(
      (mediaList) => {
          this.allMedia = mediaList;
          const hiddenTypes = this.mediaTypesService.getHiddenTypes();
          this.filteredMedia = this.allMedia.filter(media => media.type !== "photo" && media.type !== "audio-track");
      }
    )
  }

  onMediaSelect(media: Media): void {
    this.mediaClickEvent.emit(media);
  }

  onSelectMediaType(selectedTypes: string[]): void {
    this.filterByTypes(selectedTypes);
  }

  private filterByTypes(selectedTypes: string[]): void {
    const hiddenTypes = this.mediaTypesService.getHiddenTypes();

    this.filteredMedia = this.allMedia.filter(
      (media: Media) => !hiddenTypes.includes(media.type) && selectedTypes.includes(media.type)
    );
  }

  onSearchInputChange(query: string): void {
    this.filterByQuery(query);
  }

  private filterByQuery(query: string): void {
    this.filteredMedia = this.allMedia.filter(
      (media: Media) => {
        return this.doesAnyKeyIncludeQuery(media, query);
      }
    );
  }

  private doesAnyKeyIncludeQuery(media: Media, query: string): boolean {
    return Object.keys(media).some(
      (key: string) => {
          let value = media[key];
          if (!this.isString(value))
            return;

          if (value)
            value = value.toLowerCase();

          if (query)
            query = query.toLowerCase();

          return value && value.includes(query);
    });
  }

  private isString(input: any) {
    return typeof input === "string";
  }

}
