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
    
    constructor(
        id: string = "",
        name: string = "",
        date: string = "",
        icon: string = "",
        url: string = "",
        format: string = "",
        mediaType: string = "",
        fileName: string = "",
    ) {
        this.id = id,
        this.name = name,
        this.date = date,
        this.icon = icon,
        this.url = url,
        this.format = format,
        this.type = mediaType
        this.fileName = fileName
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
        const format = MediaConstants.FORMAT.VIDEO;
        const type = MediaConstants.TYPES.VIDEO;

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
        const format = MediaConstants.FORMAT.DOCUMENT;
        const type = MediaConstants.TYPES.DOCUMENT;

        super(id, name, date, icon, url, format, type, fileName);

        this.location = location;
        this.duration = duration;
    }
}

export class PhotoAlbum extends Media {
    photos: string[];

    constructor(
        id: string = "",
        name: string = "",
        url: string = "",
        icon: string = "",
        date: string = "",
        fileName: string = "",
        photos: string[] = new Array<string>(),
      ) {
        const format = MediaConstants.FORMAT.PHOTO_ALBUM;
        const type = MediaConstants.TYPES.PHOTO_ALBUM;

        super(id, name, date, icon, url, format, type, fileName);

        this.photos = photos;
    }
}

export class MusicAlbum extends Media {
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
        const format = MediaConstants.FORMAT.MUSIC_ALBUM;
        const type = MediaConstants.TYPES.MUSIC_ALBUM;

        super(id, name, date, icon, url, format, type, fileName);

        this.tracks = tracks;
    }
}
