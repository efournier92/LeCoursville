import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';

export class Video implements UploadableMedia {
  id: string;
  title: string;
  date: string;
  fileName: string;
  urls: { download: string; icon: string };
  type: string;
  format: string;
  dateUpdated: Date;
  duration: string;
  isSticky: boolean = false;
  isHidden: boolean = false;
  artist: string = '';
  folderName: string = '';
  listing: any[] = [];

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
