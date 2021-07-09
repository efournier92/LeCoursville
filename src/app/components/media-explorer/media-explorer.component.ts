import { Component, OnInit } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { SampleVideoService } from 'src/app/constants/sample-videos';
import { Media } from 'src/app/models/video';

@Component({
  selector: 'app-media-explorer',
  templateUrl: './media-explorer.component.html',
  styleUrls: ['./media-explorer.component.scss']
})
export class MediaExplorerComponent implements OnInit {
  media: Media[] = new Array<Media>();
  selectedMedia: Media;
  pdfThing: string;

  constructor() { }

  ngOnInit(): void {
    const sampleVideoService = new SampleVideoService();

    this.media = sampleVideoService.get();
    this.selectedMedia = undefined;
    this.pdfThing = "https://drive.google.com/file/d/1stIuTD7_C6rBA0CuTfD4Fz7HnqmyyJ4k/view?usp=sharing";
  }

  isVideo(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.TYPES.VIDEO;
  }

  isDocument(selectedMedia: Media): boolean {
    return selectedMedia && selectedMedia.type == MediaConstants.TYPES.DOCUMENT;
  }

  onMediaSelect(media: Media): void {
    if (media && media.url && media.format)
      this.setCurrentMedia(media);
  }

  setCurrentMedia(media: Media) {
    this.selectedMedia = media;
  }

}
