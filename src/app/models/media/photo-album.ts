import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';

export class PhotoAlbum implements UploadableMedia {
  id: string;
  title: string;
  artist: string;
  date: string;
  folderName: string;
  isHidden: boolean;
  urls: { download: string; icon: string; };
  type: string;
  format: string;
  dateUpdated: Date;

  listing: string[];

  constructor(
    id: string = '',
    title: string = '',
    downloadUrl: string = '',
    iconUrl: string = '',
    date: string = '',
    photos: string[] = [],
  ) {

    this.id = id;
    this.title = title;
    this.date = date;

    this.type = MediaConstants.PHOTO_ALBUM.id;
    this.format = MediaConstants.PHOTO_ALBUM.format;

    this.listing = photos;

    this.urls = {
      download: downloadUrl,
      icon: iconUrl
    };
  }
}
