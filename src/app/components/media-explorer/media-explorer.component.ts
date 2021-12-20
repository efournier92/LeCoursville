import { Component, OnInit } from '@angular/core';
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

  ngOnInit(): void {
    this.selectedMedia = undefined;
    this.allMedia = [];

    this.getQueryParams();
    this.subscribeToAuth();
  }

  private subscribeToAuth() {
    this.authService.userObservable.subscribe(
      (user: User) => {
        this.updateUser(user);
      }
    )
  }

  private updateUser(user: User) {
    if (user && user.id)
      this.user = user;
  }

  isVideo(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.VIDEO.id;
  }

  isDocument(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.DOC.id;
  }

  isPhotoAlbum(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.PHOTO_ALBUM.id;
  }

  isAudioAlbum(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.AUDIO_ALBUM.id;
  }

  getLinkToShare(): string {
    return location.href;
  }

  navigateToSignIn() {
    this.routingService.NavigateToSignIn();
  }

  onMediaSelect(media: Media): void {
    this.resetSelectedMedia();

    this.scrollToTop();

    if (this.shouldSetCurrentMedia(media))
      this.setCurrentMedia(media);
  }

  downloadSelectedMedia(): void {
    window.open(this.selectedMedia.urls.download);
  }

  private resetSelectedMedia(): void {
    this.selectedMedia = null;
  }

  private scrollToTop(): void {
    window.scroll(0,0);
  }

  private shouldSetCurrentMedia(media: Media) {
    return media && media.urls.location && media.type
  }

  private setCurrentMedia(media: Media) {
    this.selectedMedia = media;
    this.emitEventToChild(media);
    this.routingService.updateQueryParams(this.selectedMedia.id);
    this.analyticsService.logMediaSelect(media);
  }

  private emitEventToChild(media: Media) {
    this.eventsSubject.next(this.selectedMedia);
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
