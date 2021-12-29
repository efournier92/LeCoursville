import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class Video extends Media {
    locationId: string;
    duration: string;

    constructor(
        id: string = '',
        title: string = '',
        downloadUrl: string = '',
        iconUrl: string = '',
        date: string = '',
        duration: string = '',
      ) {
        super();

        this.id = id;
        this.title = title;
        this.date = date;

        this.type = MediaConstants.VIDEO.id;
        this.format = MediaConstants.VIDEO.format;

        this.duration = duration;
        this.urls = {
          download: downloadUrl,
          icon: iconUrl,
        };
    }
}
