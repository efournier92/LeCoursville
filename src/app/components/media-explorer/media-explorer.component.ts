import { Component, OnInit } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { SampleMediaService } from 'src/app/constants/sample-media';
import { Media } from 'src/app/models/media';

@Component({
  selector: 'app-media-explorer',
  templateUrl: './media-explorer.component.html',
  styleUrls: ['./media-explorer.component.scss']
})
export class MediaExplorerComponent implements OnInit {
  media: Media[] = new Array<Media>();
  selectedMedia: Media;

  constructor() { }

  ngOnInit(): void {
    const sampleMediaService = new SampleMediaService();

    this.media = sampleMediaService.get();
    this.selectedMedia = undefined;
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

  onMediaSelect(media: Media): void {
    // if (media && media.url && media.format)
      this.setCurrentMedia(media);
  }

  setCurrentMedia(media: Media) {
    this.selectedMedia = media;
  }

}
