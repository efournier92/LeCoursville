import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MediaType } from "src/app/constants/media-constants";
import { MediaTypesService } from 'src/app/services/media-types-service.service';

@Component({
  selector: 'app-media-types-checkboxes',
  templateUrl: './media-types-checkboxes.component.html',
  styleUrls: ['./media-types-checkboxes.component.scss']
})
export class MediaTypesCheckboxesComponent implements OnInit {
  allTypes: MediaType[] = new Array<MediaType>();
  selectedType: string;
  @Output() selectMediaTypeEvent = new EventEmitter<string[]>();

  constructor(
    private mediaTypesService: MediaTypesService
  ) { }

  ngOnInit(): void {
    const types = this.mediaTypesService.getVisibleTypes();

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
