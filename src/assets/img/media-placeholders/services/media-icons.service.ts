import { Injectable } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';

@Injectable({
  providedIn: 'root'
})
export class MediaIconsService {

  constructor() { }

  getPlaceholderNameByMediaType(mediaType: string): string {
    if (mediaType == MediaConstants.VIDEO.id)
      return "movie";

    if (mediaType == MediaConstants.DOC.id)
      return "picture_as_pdf";

    if (mediaType == MediaConstants.PHOTO_ALBUM.id)
      return "photo_album";

    if (mediaType == MediaConstants.PHOTO.id)
      return "photo";

    if (mediaType == MediaConstants.AUDIO_ALBUM.id)
      return "album";

    if (mediaType == MediaConstants.AUDIO_TRACK.id)
      return "audiotrack";

    return "perm_media"
  }
  
}
