import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';
import { User } from 'src/app/models/user';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';
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

  user: User;
  allMedia: Array<Media> = [];
  filteredMedia: Array<Media>;

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private mediaIconsService: MediaIconsService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.subscribeToMediaObservable();
    this.initializeList();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private subscribeToMediaObservable(): void {
    this.mediaService.mediaObservable.subscribe(
      (mediaList) => {
        this.allMedia = mediaList;
        this.filteredMedia = this.filterAllMediaByType();
      }
    );
  }

  // PUBLIC METHODS

  getPlaceholderName(mediaType: string): string {
    return this.mediaIconsService.getPlaceholderNameByMediaType(mediaType);
  }

  shouldDisplayMedia(media: Media): boolean {
    return media?.isHidden !== true;
  }

  onImageLoaded(media: any): void {
    media.isIconLoaded = true;
  }

  onMediaSelect(media: Media): void {
    this.mediaClickEvent.emit(media);
    this.analyticsService.logEvent('media_list_select', { selectedMedia: media, user: this.user });
  }

  onSelectMediaType(selectedTypes: string[]): void {
    this.filteredMedia = this.mediaService.filterByTypes(selectedTypes, this.allMedia);
    this.analyticsService.logEvent('media_list_select_type', { selectedMediaType: selectedTypes, user: this.user });
  }

  onSearchInputChange(query: string): void {
    this.filteredMedia = this.mediaService.filterByQuery(query, this.allMedia);
    this.analyticsService.logEvent('media_list_search', { searchQuery: query, user: this.user });
  }

  // HELPER METHODS

  private initializeList(): void {
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

  private filterAllMediaByType() {
    return this.mediaService.filterByTypes(this.mediaTypesToShow, this.allMedia);
  }

}
