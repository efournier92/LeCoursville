import { MediaConstants } from 'src/app/constants/media-constants';
import { Media } from 'src/app/models/media/media';

export class AudioTrack extends Media {
    constructor(
        id: string = '',
        name: string = '',
        locationId: string = '',
      ) {
        const type = MediaConstants.AUDIO_TRACK.id;

        super(id, name, locationId, '', '', '', '', '', type, [], '');
    }
}
