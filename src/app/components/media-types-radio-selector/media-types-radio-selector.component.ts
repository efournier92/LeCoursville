import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MediaConstants, MediaType } from "src/app/constants/media-constants";
import { MediaTypesService } from 'src/app/services/media-types-service.service';

@Component({
  selector: 'app-media-types-radio-selector',
  templateUrl: './media-types-radio-selector.component.html',
  styleUrls: ['./media-types-radio-selector.component.scss']
})
export class MediaTypesRadioSelectorComponent implements OnInit {
  allTypes: MediaType[] = new Array<MediaType>();
  selectedType: string;
  @Output() selectMediaTypeEvent = new EventEmitter<string[]>();

  constructor(
    private mediaTypesService: MediaTypesService
  ) { }

  ngOnInit(): void {
    const types = MediaConstants.ALL_TYPES;
    types.forEach(type => {
      this.allTypes.push(type as MediaType);
    });
  }

  onSelectMediaType(type: MediaType): void {
    type.isSelected = !type.isSelected;

    let selectedTypes = this.mediaTypesService.getSelectedTypes(this.allTypes);

    if (!selectedTypes.length || selectedTypes.length < 1)
      selectedTypes = this.mediaTypesService.getAllTypes();

    this.selectMediaTypeEvent.emit(selectedTypes);
  }
}
