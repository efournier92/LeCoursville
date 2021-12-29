import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class PhotoAlbum extends Media {
    listing: string[];

    constructor(
        id: string = '',
        title: string = '',
        downloadUrl: string = '',
        iconUrl: string = '',
        date: string = '',
        photos: string[] = new Array<string>(),
      ) {
        super();

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
