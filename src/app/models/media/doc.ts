import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class Doc extends Media {
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
        const type = MediaConstants.DOC.id;
        const format = MediaConstants.DOC.format;

        super();

        this.id = id;
        this.title = title;
        this.date = date;
        this.duration = duration;

        this.type = MediaConstants.DOC.id;
        this.format = MediaConstants.DOC.format;

        this.urls = {
          download: downloadUrl,
          icon: iconUrl,
        };
    }
}
