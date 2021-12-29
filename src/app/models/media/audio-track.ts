import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class AudioTrack extends Media {
    constructor(
        id: string = '',
        title: string = '',
      ) {
        super();

        this.id = id;
        this.title = title;

        this.type = MediaConstants.AUDIO_TRACK.id;
        this.format = MediaConstants.AUDIO_TRACK.format;
    }
}
