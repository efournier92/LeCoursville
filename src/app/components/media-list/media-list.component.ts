import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';
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
  @Input() isAdminMode = false;

  @Output() mediaClickEvent = new EventEmitter<UploadableMedia>();

  user: User;
  allMedia: UploadableMedia[] = [];
  filteredMedia: UploadableMedia[];

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
        this.filteredMedia = this.sortMedia(this.filteredMedia);
      }
    );
  }

  // PUBLIC METHODS

  getPlaceholderName(mediaType: string): string {
    return this.mediaIconsService.getPlaceholderNameByMediaType(mediaType);
  }

  shouldDisplayMedia(media: UploadableMedia): boolean {
    return this.isAdminMode || media?.isHidden !== true;
  }

  onImageLoaded(media: any): void {
    media.isIconLoaded = true;
  }

  onMediaSelect(media: UploadableMedia): void {
    this.mediaClickEvent.emit(media);
    this.analyticsService.logEvent('media_list_select', {
      mediaTitle: media?.title, mediaId: media?.id, userId: this.user?.id, userName: this.user?.name,
    });
  }

  onSelectMediaType(selectedTypes: string[]): void {
    this.filteredMedia = this.mediaService.filterByTypes(selectedTypes, this.allMedia);
    this.filteredMedia = this.sortMedia(this.filteredMedia);
    this.analyticsService.logEvent('media_list_select_type', {
      selectedMediaType: selectedTypes.toString(), userId: this.user?.id, userName: this.user?.name,
    });
  }

  onSearchInputChange(query: string): void {
    this.filteredMedia = this.mediaService.filterByQuery(query, this.allMedia);
    this.filteredMedia = this.sortMedia(this.filteredMedia);
    this.analyticsService.logEvent('media_list_search', {
      searchQuery: query, userId: this.user?.id, userName: this.user?.name,
    });
  }

  // HELPER METHODS

  private initializeList(): void {
    if (!this.mediaTypesToShow) {
      this.mediaTypesToShow = this.getDefaultMediaTypes();
    }

    if (this.mediaTypesToShow) {
      this.filteredMedia = this.filterAllMediaByType();
      this.filteredMedia = this.sortMedia(this.filteredMedia);
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

  private sortMedia(mediaList: UploadableMedia[]): UploadableMedia[] {
    return mediaList.sort(this.compareMediaByTimestamp);
  }

  private compareMediaByTimestamp(a: UploadableMedia, b: UploadableMedia): number {
    return a.date.localeCompare(b.date);
  }

}
