import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';
import { User } from 'src/app/models/user';
import { AdminService } from 'src/app/services/admin.service';
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
  searchQuery: string;
  sortTypes: string[];
  selectedSortType: string;

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private mediaIconsService: MediaIconsService,
    private analyticsService: AnalyticsService,
    private adminService: AdminService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.subscribeToMediaObservable();
    this.initializeList();
    this.searchQuery = '';
    this.sortTypes = ['Date Added', 'Date Recorded'];
    this.selectedSortType = this.sortTypes[0];
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
        this.filteredMedia = this.filterMediaByType(this.mediaTypesToShow, this.allMedia);
        this.filteredMedia = this.sortMedia(this.filteredMedia);
        function randomDate(start, end) {
            return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        }
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
      id: media?.id, title: media?.title, userId: this.user?.id,
    });
  }

  onSelectMediaType(selectedTypes: string[]): void {
    this.filteredMedia = this.mediaService.filterByTypes(selectedTypes, this.allMedia);
    this.filteredMedia = this.sortMedia(this.filteredMedia);
    this.analyticsService.logEvent('media_list_select_type', {
      type: selectedTypes.toString(), userId: this.user?.id,
    });
  }

  onSearchInputChange(event: any): void {
    const query = this.searchQuery;
    this.filteredMedia = this.filterMediaByType(this.mediaTypesToShow, this.allMedia);
    this.filteredMedia = this.mediaService.filterByQuery(query, this.filteredMedia);
    this.filteredMedia = this.sortMedia(this.filteredMedia);
    this.analyticsService.logEvent('media_list_search', {
      query, userId: this.user?.id,
    });
  }

  onSortBySelectionChange(event: any): void {
    this.selectedSortType = event?.value;
    this.filteredMedia = this.sortMedia(this.filteredMedia);
  }

  // HELPER METHODS

  private initializeList(): void {
    if (!this.mediaTypesToShow) {
      this.mediaTypesToShow = this.getDefaultMediaTypes();
    }

    if (this.mediaTypesToShow) {
      this.filteredMedia = this.filterMediaByType(this.mediaTypesToShow, this.allMedia);
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

  private filterMediaByType(mediaTypesToShow: string[], mediaToFilter: UploadableMedia[]) {
    return this.mediaService.filterByTypes(mediaTypesToShow, mediaToFilter);
  }

  private sortMedia(mediaList: UploadableMedia[]): UploadableMedia[] {
    if (this.selectedSortType === 'Date Added') {
      mediaList = mediaList.sort(this.compareMediaByDateUpdated);
    } else {
      mediaList = mediaList.sort(this.compareMediaByTimestamp);
    }
    return this.bumpStickies(mediaList);
  }

  private bumpStickies(mediaList: UploadableMedia[]): UploadableMedia[] {
    mediaList.forEach((media, index) => {
      if (media.isSticky) {
        const stickyItem = mediaList.splice(index, 1) [0];
        mediaList.splice(0, 0, stickyItem);
      }
    });

    return mediaList;
  }

  private compareMediaByDateUpdated(a: UploadableMedia, b: UploadableMedia): number {
    return b.dateUpdated?.getTime() - a.dateUpdated?.getTime();
  }

  private compareMediaByTimestamp(a: UploadableMedia, b: UploadableMedia): number {
    return a.date.localeCompare(b.date);
  }
}
