import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';

export class AudioTrack implements UploadableMedia {
  id: string;
  title: string;
  artist: string;
  date: string;
  folderName: string;
  fileName: string;
  isHidden: boolean;
  listing: any[];
  urls: { icon: string; download: string; };
  type: string;
  format: string;
  dateUpdated: Date;

  constructor(
    id?: string,
    title?: string,
    artist?: string,
    date?: string,
  ) {
    this.id = id;
    this.title = title;
    this.artist = artist;
    this.date = date;
    this.urls = { download: '', icon: '' };
    this.type = MediaConstants.AUDIO_TRACK.id;
    this.format = MediaConstants.AUDIO_TRACK.format;
  }

}
