import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';

export class AudioTrack implements UploadableMedia {
  id: string;
  title: string;
  artist: string;
  date: string;
  urls: { icon: string; download: string };
  type: string;
  format: string;
  fileName: string = '';
  folderName: string = '';
  dateUpdated: Date = new Date();
  isSticky: boolean = false;
  isHidden: boolean = false;
  listing: any[] = [];

  constructor(id?: string, title?: string, artist?: string, date?: string) {
    this.id = id;
    this.title = title;
    this.artist = artist;
    this.date = date;
    this.urls = { download: '', icon: '' };
    this.type = MediaConstants.AUDIO_TRACK.id;
    this.format = MediaConstants.AUDIO_TRACK.format;
  }
}
