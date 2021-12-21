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
  selectedMedia: Media;
  loadedMedia: Media[];
  eventsSubject: Subject<Media> = new Subject<Media>();

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private analyticsService: AnalyticsService,
    private routingService: RoutingService,
    private activatedRoute: ActivatedRoute,
  ) { }

  // LIFECYCLE

  ngOnInit(): void {
    this.selectedMedia = undefined;
    this.allMedia = [];

    this.getQueryParams();
    this.subscribeToAuth();
  }

  // PUBLIC

  onMediaSelect(media: Media): void {
    this.resetSelectedMedia();

    if (this.shouldSetCurrentMedia(media))
      this.setCurrentMedia(media);

    this.scrollToTop();
  }

  getShareableLink(): string {
    return location?.href;
  }

  downloadSelectedMedia(): void {
    window.location.href = this.selectedMedia?.urls?.download;
  }

  navigateToSignIn() {
    this.routingService.NavigateToSignIn();
  }

  // MEDIA CHECKS

  shouldDisplayMediaList(): boolean {
    return !!this.user?.id;
  }

  isVideo(selectedMedia: Media): boolean {
    return selectedMedia?.type == MediaConstants.VIDEO.id;
  }

  isDocument(selectedMedia: Media): boolean {
    return selectedMedia?.type == MediaConstants.DOC.id;
  }

  isPhotoAlbum(selectedMedia: Media): boolean {
    return selectedMedia?.type == MediaConstants.PHOTO_ALBUM.id;
  }

  isAudioAlbum(selectedMedia: Media): boolean {
    return selectedMedia?.type == MediaConstants.AUDIO_ALBUM.id;
  }
  
  // HELPERS

  private subscribeToAuth() {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.updateUser(user);
      }
    )
  }

  private updateUser(user: User) {
    if (user?.id)
      this.user = user;
  }
  
  private resetSelectedMedia(): void {
    this.selectedMedia = null;
  }

  private scrollToTop(): void {
    window.scroll(0,0);
  }

  private shouldSetCurrentMedia(media: Media) {
    return media?.urls?.location && media?.type
  }

  private setCurrentMedia(media: Media) {
    this.selectedMedia = media;
    this.emitEventToChild(media);
    this.routingService.updateQueryParams(this.selectedMedia.id);
    this.analyticsService.logEvent("media_explorer_select", media);
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
    const idFromParams = params["id"];
    if (idFromParams)
      this.loadMediaByQueryId(idFromParams);
  }

  private loadMediaByQueryId(id: string) {
    this.mediaService.getById(id).subscribe(
      (media: Media) => {
        if (media && media.id == id)
          this.selectedMedia = media;
      }
    );
  }
}
