import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Subject } from 'rxjs';
import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';
import { User } from 'src/app/models/user';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';
import { MediaService } from 'src/app/services/media.service';
import { RoutingService } from 'src/app/services/routing.service';

@Component({
  selector: 'app-media-explorer',
  templateUrl: './media-explorer.component.html',
  styleUrls: ['./media-explorer.component.scss']
})
export class MediaExplorerComponent implements OnInit {
  @Input() mediaType: string;
  user: User;
  allMedia: Media[] = new Array<Media>();
  loadedMedia: Media[];
  selectedMedia: Media;
  eventsSubject: Subject<Media> = new Subject<Media>();

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private analyticsService: AnalyticsService,
    private routingService: RoutingService,
    private activatedRoute: ActivatedRoute,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.selectedMedia = undefined;
    this.allMedia = [];

    this.getQueryParams();
    this.subscribeToUserObservable();
    this.analyticsService.logEvent('component_load_media_explorer', { });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC

  onMediaSelect(media: Media): void {
    this.resetSelectedMedia();

    if (this.shouldSetCurrentMedia(media)) {
      this.setCurrentMedia(media);
    }

    this.scrollToTop();

    this.analyticsService.logEvent('media_select', { user: this.user, media: this.selectedMedia });
  }

  getShareableLink(): string {
    this.analyticsService.logEvent('media_shareable_link_copy', { user: this.user, media: this.selectedMedia });
    return `${location?.href}?id=${this.selectedMedia?.id}`;
  }

  downloadSelectedMedia(): void {
    this.analyticsService.logEvent('media_download', { user: this.user, media: this.selectedMedia });

    window.location.href = this.selectedMedia?.urls?.download;
  }

  navigateToSignIn() {
    this.analyticsService.logEvent('media_sign_in_to_see_more', { user: this.user, media: this.selectedMedia });
    this.routingService.NavigateToSignIn();
  }

  // MEDIA CHECKS

  hasSelectedMedia(): boolean {
    return !!this.selectedMedia?.id;
  }

  shouldShowShareableLinkButton() {
    return this.hasSelectedMedia();
  }

  shouldShowDownloadButton() {
    return this.hasSelectedMedia();
  }

  shouldDisplayMediaList(): boolean {
    return !!this.user?.id;
  }

  isVideo(selectedMedia: Media): boolean {
    return selectedMedia?.type === MediaConstants.VIDEO.id;
  }

  isDocument(selectedMedia: Media): boolean {
    return selectedMedia?.type === MediaConstants.DOC.id;
  }

  isPhotoAlbum(selectedMedia: Media): boolean {
    return selectedMedia?.type === MediaConstants.PHOTO_ALBUM.id;
  }

  isAudioAlbum(selectedMedia: Media): boolean {
    return selectedMedia?.type === MediaConstants.AUDIO_ALBUM.id;
  }

  // HELPERS

  private updateUser(user: User) {
    if (user?.id) {
      this.user = user;
    }
  }

  private resetSelectedMedia(): void {
    this.selectedMedia = null;
  }

  private scrollToTop(): void {
    window.scroll(0, 0);
  }

  private shouldSetCurrentMedia(media: Media) {
    return media?.urls?.download && media?.type;
  }

  private setCurrentMedia(media: Media) {
    this.selectedMedia = media;
    this.emitEventToChild(media);
    this.routingService.clearQueryParams();
    this.analyticsService.logEvent('media_explorer_select', media);
  }

  private emitEventToChild(media: Media) {
    this.eventsSubject.next(media);
  }

  private getQueryParams() {
    this.activatedRoute.queryParams.subscribe(params => {
      this.getMediaIdFromQueryParams(params);
    });
  }

  private getMediaIdFromQueryParams(params) {
    const idFromParams = params.id;
    if (idFromParams) {
      this.loadMediaByQueryId(idFromParams);
    }
  }

  private loadMediaByQueryId(id: string) {
    this.mediaService.getById(id).subscribe(
      (media: Media) => {
        if (media?.id === id) {
          this.selectedMedia = media;
          this.routingService.clearQueryParams();
        }
      }
    );
  }
}
