import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class PhotoAlbum extends Media {
    listing: string[];

    constructor(
        id: string = '',
        name: string = '',
        url: string = '',
        icon: string = '',
        date: string = '',
        fileName: string = '',
        photos: string[] = new Array<string>(),
      ) {
        const type = MediaConstants.PHOTO_ALBUM.id;
        const format = MediaConstants.PHOTO_ALBUM.format;

        super(id, name, date, icon, url, format, type, fileName);

        this.listing = photos;
    }
}
