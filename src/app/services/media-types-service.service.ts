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

  getVisibleTypes(): MediaType[] {
    let output = new Array<MediaType>();

    MediaConstants.ALL_TYPES.forEach(
      type => {
        if (!type.isHiddenByDefault)
          output.push(type);
      }
    )

    return output;
  }

  getHiddenTypeIds(): string[] {
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
