import { MediaConstants } from "src/app/constants/media-constants";
import { Media } from "src/app/models/media/media";

export class Video extends Media {
    locationId: string;
    duration: string;

    constructor(
        id: string = "",
        name: string = "",
        url: string = "",
        icon: string = "",
        location: string = "",
        date: string = "",
        duration: string = "",
        fileName: string = "",
      ) {
        const type = MediaConstants.VIDEO.id;
        const format = MediaConstants.VIDEO.format;

        super(id, name, date, icon, url, format, type, fileName);

        this.locationId = location;
        this.duration = duration;
    }
}
