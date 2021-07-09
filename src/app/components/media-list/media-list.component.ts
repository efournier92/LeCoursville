import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Media } from 'src/app/models/video';

@Component({
  selector: 'app-media-list',
  templateUrl: './media-list.component.html',
  styleUrls: ['./media-list.component.scss']
})
export class MediaListComponent implements OnInit {
  filteredMedia: Array<Media>;
  @Input() allMedia: Array<Media>;
  @Output() mediaClickEvent = new EventEmitter<Media>();
  
  constructor() { }

  ngOnInit(): void {
    this.filteredMedia = this.allMedia;
  }

  onMediaSelect(media: Media): void {
    this.mediaClickEvent.emit(media);
  }

}
