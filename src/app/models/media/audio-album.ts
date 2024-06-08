import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';

export class AudioAlbum implements UploadableMedia {
  id: string;
  title: string;
  artist: string;
  date: string;
  folderName: string;
  isSticky: boolean;
  isHidden: boolean;
  listing: any[];
  urls: { download: string; icon: string };
  type: string;
  format: string;
  dateUpdated: Date;
  fileName: string = '';

  constructor(
    id?: string,
    title?: string,
    folderName?: string,
    artist?: string,
    date?: string,
    isHidden?: boolean,
    listing?: string[],
  ) {
    this.id = id;
    this.title = title;
    this.folderName = folderName;
    this.artist = artist;
    this.date = date;
    this.isHidden = isHidden || false;
    this.listing = listing;
    this.urls = { download: '', icon: '' };
    this.type = MediaConstants.AUDIO_ALBUM.id;
    this.format = MediaConstants.AUDIO_ALBUM.format;
  }
}
