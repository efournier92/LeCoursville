import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Subject } from 'rxjs';
import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';
import { User } from 'src/app/models/user';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';
import { MediaService } from 'src/app/services/media.service';
import { RoutingService } from 'src/app/services/routing.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { FileDownloadService } from 'src/app/services/file-download.service';
import * as saveAs from 'file-saver';

@Component({
  selector: 'app-media-explorer',
  templateUrl: './media-explorer.component.html',
  styleUrls: ['./media-explorer.component.scss']
})
export class MediaExplorerComponent implements OnInit {
  @Input() mediaTypesToShow: string;

  user: User;
  allMedia: UploadableMedia[] = [];
  loadedMedia: UploadableMedia[];
  selectedMedia: UploadableMedia;
  eventsSubject: Subject<UploadableMedia> = new Subject<UploadableMedia>();

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private analyticsService: AnalyticsService,
    private routingService: RoutingService,
    private activatedRoute: ActivatedRoute,
    private clipboard: Clipboard,
    private downloadService: FileDownloadService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.selectedMedia = undefined;
    this.allMedia = [];

    // this.mediaService.getMedia().valueChanges().subscribe(
    this.mediaService.mediaObservable.subscribe(
      (mediaList: UploadableMedia[]) => {
        this.allMedia = mediaList;
        this.getQueryParams();
        this.subscribeToUserObservable();
      }
    );

    this.analyticsService.logEvent('component_load_media_explorer', { });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC

  onMediaSelect(media: UploadableMedia): void {
    this.resetSelectedMedia();

    if (this.shouldSetCurrentMedia(media)) {
      this.setCurrentMedia(media);
    }

    this.scrollToTop();

    this.analyticsService.logEvent('media_select', { media: this.selectedMedia, user: this.user.id });
  }

  getShareableLink(): string {
    return `${location?.href}?id=${this.selectedMedia?.id}`;
  }

  onGetShareableLink(): void {
    const link = this.getShareableLink();
    this.clipboard.copy(link);
    this.analyticsService.logEvent('media_shareable_link_copy', { shareableLink: link, media: this.selectedMedia, user: this.user.id });
  }

  downloadSelectedMedia(): void {

    // this.downloadService
    //   .download(this.selectedMedia.urls.download)
    //   .subscribe(blob => saveAs(blob, this.selectedMedia.fileName));

    // this.analyticsService.logEvent('media_download', { media: this.selectedMedia, user: this.user.id });

    // window.location.href = this.selectedMedia?.urls?.download;
    window.open(this.selectedMedia?.urls?.download, '_blank');

  }

  navigateToSignIn() {
    this.analyticsService.logEvent('media_sign_in_to_see_more', { media: this.selectedMedia, user: this.user.id });
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

  isVideo(selectedMedia: UploadableMedia): boolean {
    return selectedMedia?.type === MediaConstants.VIDEO.id;
  }

  isDocument(selectedMedia: UploadableMedia): boolean {
    return selectedMedia?.type === MediaConstants.DOC.id;
  }

  isPhotoAlbum(selectedMedia: UploadableMedia): boolean {
    return selectedMedia?.type === MediaConstants.PHOTO_ALBUM.id;
  }

  isAudioAlbum(selectedMedia: UploadableMedia): boolean {
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

  private shouldSetCurrentMedia(media: UploadableMedia) {
    return media?.urls?.download && media?.type;
  }

  private setCurrentMedia(media: UploadableMedia) {
    this.selectedMedia = media;
    this.emitEventToChild(media);
    if (this.authService.isUserSignedIn()) {
      this.routingService.clearQueryParams();
    }
    this.analyticsService.logEvent('media_explorer_select', media);
  }

  private emitEventToChild(media: UploadableMedia) {
    this.eventsSubject.next(media);
  }

  private getQueryParams() {
    this.activatedRoute.queryParams.subscribe(params => {
      this.getMediaIdFromQueryParams(params);
    });
  }

  private getMediaIdFromQueryParams(params) {
    const idFromParams = params.id;
    if (!idFromParams && !this.authService.isUserSignedIn()) {
      this.routingService.NavigateToSignIn();
    }
    if (idFromParams) {
      this.loadMediaByQueryId(idFromParams);
    }
  }

  private loadMediaByQueryId(id: string) {
    const media = this.mediaService.getMediaById(id);
    if (media?.id === id) {
      this.selectedMedia = media;
      if (this.authService.isUserSignedIn()) {
        this.routingService.clearQueryParams();
      }
    }
  }
}
