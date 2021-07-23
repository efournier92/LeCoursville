import { Injectable } from '@angular/core';
import { MediaConstants, MediaType } from '../constants/media-constants';

@Injectable({
  providedIn: 'root'
})
export class MediaTypesService {

  constructor() { 
    
  }

  getAllTypes(): string[] {
    let output = new Array<string>();

    MediaConstants.ALL_TYPES.forEach(
      type => {
        output.push(type.id);
      }
    )

    return output;
  }

  getHiddenTypes() {
    let output = new Array<string>();

    MediaConstants.ALL_TYPES.forEach(
      type => {
        if (type.isHiddenByDefault)
          output.push(type.id);
      }
    )

    return output;
  }

  getSelectedTypes(allTypes: MediaType[]): string[] {
    let output = new Array<string>();

    allTypes.forEach(
      type => {
        if (type.isSelected)
          output.push(type.id);
      }
    )

    return output;
  }
}
