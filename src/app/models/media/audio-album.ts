import { Track } from 'ngx-audio-player';
import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class AudioAlbum extends Media {
    tracks: Track[];

    constructor(
        id: string = '',
        title: string = '',
        iconUrl: string = '',
        downloadUrl: string = '',
        date: string = '',
        artist: string = '',
        tracks: Track[] = new Array<Track>(),
      ) {

        super();

        this.id = id;
        this.title = title;
        this.date = date;
        this.artist = artist;
        this.type = MediaConstants.AUDIO_ALBUM.id;
        this.format = MediaConstants.AUDIO_ALBUM.format;
        this.tracks = tracks;
        this.urls = {
          download: downloadUrl,
          icon: iconUrl
        };
    }
}
