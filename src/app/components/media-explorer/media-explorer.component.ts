import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { MediaConstants } from 'src/app/constants/media-constants';
import { SampleMediaService } from 'src/app/constants/sample-media';
import { Media } from 'src/app/models/media';
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
  }

  isVideo(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.TYPES.VIDEO;
  }

  isDocument(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.TYPES.DOCUMENT;
  }

  isPhotoAlbum(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.TYPES.PHOTO_ALBUM;
  }

  isAudioAlbum(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.TYPES.AUDIO_ALBUM;
  }

  onMediaSelect(media: Media): void {
    this.selectedMedia = null;
    // if (media && media.url && media.format)
      this.setCurrentMedia(media);
  }

  setCurrentMedia(media: Media) {
    this.selectedMedia = media;
    this.emitEventToChild(media);
  }

  eventsSubject: Subject<Media> = new Subject<Media>();

  emitEventToChild(media: Media) {
    this.eventsSubject.next(this.selectedMedia);
  }
}
