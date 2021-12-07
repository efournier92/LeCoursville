import { Track } from "ngx-audio-player";
import { MediaConstants } from "src/app/constants/media-constants";

export class Media {
    id: string;
    name: string;
    date: string;
    icon: string;
    url: string;
    format: string;
    type: string;
    fileName: string;
    location: string;
    duration: string;
    dateAdded: Date;
    author: string;
    hostingId: string;
    downloadLocation: string;
    listing: Array<any>;
    
    constructor(
        id: string = "",
        name: string = "",
        date: string = "",
        icon: string = "",
        url: string = "",
        format: string = "",
        mediaType: string = "",
        fileName: string = "",
        location: string = "",
        duration: string = "",
        downloadLocation: string = "",
        listing: Array<any> = [],
    ) {
        this.id = id,
        this.name = name,
        this.date = date,
        this.icon = icon,
        this.url = url,
        this.format = format,
        this.type = mediaType
        this.fileName = fileName,
        this.location = location,
        this.duration = duration,
        this.downloadLocation = downloadLocation,
        this.listing = listing
    }
}

export class Video extends Media {
    location: string;
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

        this.location = location;
        this.duration = duration;
    }
}

export class Doc extends Media {
    location: string;
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
        const type = MediaConstants.DOC.id;
        const format = MediaConstants.DOC.format;

        super(id, name, date, icon, url, format, type, fileName);

        this.location = location;
        this.duration = duration;
    }
}

export class PhotoAlbum extends Media {
    listing: string[];

    constructor(
        id: string = "",
        name: string = "",
        url: string = "",
        icon: string = "",
        date: string = "",
        fileName: string = "",
        photos: string[] = new Array<string>(),
      ) {
        const type = MediaConstants.PHOTO_ALBUM.id;
        const format = MediaConstants.PHOTO_ALBUM.format;

        super(id, name, date, icon, url, format, type, fileName);

        this.listing = photos;
    }
}

export class AudioAlbum extends Media {
    tracks: Track[];

    constructor(
        id: string = "",
        name: string = "",
        url: string = "",
        icon: string = "",
        date: string = "",
        fileName: string = "",
        tracks: Track[] = new Array<Track>(),
      ) {
        const type = MediaConstants.AUDIO_ALBUM.id
        const format = MediaConstants.AUDIO_ALBUM.format;

        super(id, name, date, icon, url, format, type, fileName);

        this.tracks = tracks;
    }
}
