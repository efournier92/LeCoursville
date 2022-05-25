import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';

export class Video implements UploadableMedia {
  id: string;
  title: string;
  artist: string;
  date: string;
  folderName: string;
  fileName: string;
  isSticky: boolean;
  isHidden: boolean;
  listing: any[];
  urls: { download: string; icon: string; };
  type: string;
  format: string;
  dateUpdated: Date;

  duration: string;

  constructor(
    id: string = '',
    title: string = '',
    downloadUrl: string = '',
    iconUrl: string = '',
    fileName: string = '',
    date: string = '',
    duration: string = '',
  ) {
    this.id = id;
    this.title = title;
    this.date = date;
    this.fileName = fileName;

    this.type = MediaConstants.VIDEO.id;
    this.format = MediaConstants.VIDEO.format;

    this.duration = duration;
    this.urls = {
      download: downloadUrl,
      icon: iconUrl,
    };
  }
}
