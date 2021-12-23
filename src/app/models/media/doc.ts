import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class Doc extends Media {
    locationId: string;
    duration: string;

    constructor(
        id: string = '',
        name: string = '',
        url: string = '',
        icon: string = '',
        locationId: string = '',
        date: string = '',
        duration: string = '',
        fileName: string = '',
      ) {
        const type = MediaConstants.DOC.id;
        const format = MediaConstants.DOC.format;

        super(id, name, date, icon, url, format, type, fileName);

        this.locationId = locationId;
        this.duration = duration;
    }
}
