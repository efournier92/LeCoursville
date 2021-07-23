import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { MediaService } from 'src/app/services/media.service';

@Component({
  selector: 'app-media-explorer',
  templateUrl: './media-explorer.component.html',
  styleUrls: ['./media-explorer.component.scss']
})
export class MediaExplorerComponent implements OnInit {
  media: Media[] = new Array<Media>();
  selectedMedia: Media;

  constructor(
    private mediaService: MediaService,
    private analyticsService: AnalyticsService,
  ) { }

  ngOnInit(): void {
    // this.media = sampleMediaService.get();
    this.selectedMedia = undefined;

    this.mediaService.mediaObservable.subscribe(
      (mediaList) => {
        this.media = mediaList;
        console.log(mediaList);
      }
    )
    
    this.analyticsService.logPageView('media-explorer');
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

  onMediaSelect(media: Media): void {
    this.selectedMedia = null;
    // if (media && media.url && media.format)
      this.setCurrentMedia(media);
  }

  setCurrentMedia(media: Media) {
    this.selectedMedia = media;
    this.analyticsService.logMediaSelect(media);
    this.emitEventToChild(media);
  }

  eventsSubject: Subject<Media> = new Subject<Media>();

  emitEventToChild(media: Media) {
    this.eventsSubject.next(this.selectedMedia);
  }
}
