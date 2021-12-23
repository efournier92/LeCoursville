import { Track } from 'ngx-audio-player';
import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class AudioAlbum extends Media {
    tracks: Track[];

    constructor(
        id: string = '',
        name: string = '',
        locationId: string = '',
        iconId: string = '',
        downloadId: string = '',
        date: string = '',
        author: string = '',
        fileName: string = '',
        tracks: Track[] = new Array<Track>(),
      ) {
        const type = MediaConstants.AUDIO_ALBUM.id;
        const format = MediaConstants.AUDIO_ALBUM.format;

        super(id, name, locationId, iconId, downloadId, date, author, fileName, type, tracks, format);

        this.tracks = tracks;
    }
}
