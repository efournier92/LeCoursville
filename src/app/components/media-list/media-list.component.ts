import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Media } from 'src/app/models/media';
import { MediaService } from 'src/app/services/media.service';

@Component({
  selector: 'app-media-list',
  templateUrl: './media-list.component.html',
  styleUrls: ['./media-list.component.scss']
})
export class MediaListComponent implements OnInit {
  filteredMedia: Array<Media>;
  allMedia: Array<Media>;
  @Output() mediaClickEvent = new EventEmitter<Media>();
  
  constructor(
    private mediaService: MediaService,
  ) { }

  ngOnInit(): void {
    this.mediaService.mediaObservable.subscribe(
      (mediaList) => {
        // if (!this.allMedia)
          this.allMedia = mediaList;
          this.filteredMedia = this.allMedia.filter(media => media.type !== "photo" && media.type !== "audio-track");
      }
    )
  }

  onMediaSelect(media: Media): void {
    this.mediaClickEvent.emit(media);
  }

}
