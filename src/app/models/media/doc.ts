import { MediaConstants } from 'src/app/constants/media-constants';
import { UploadableMedia } from 'src/app/models/media/media';

export class Doc implements UploadableMedia {
  id: string;
  title: string;
  artist: string;
  date: string;
  folderName: string;
  fileName: string;
  isHidden: boolean;
  listing: any[];
  urls: { download: string; icon: string; };
  type: string;
  format: string;
  dateUpdated: Date;

  constructor(
    id: string = '',
    title: string = '',
    downloadUrl: string = '',
    iconUrl: string = '',
    date: string = '',
  ) {

    this.id = id;
    this.title = title;
    this.date = date;

    this.type = MediaConstants.DOC.id;
    this.format = MediaConstants.DOC.format;

    this.urls = {
      download: downloadUrl,
      icon: iconUrl,
    };
  }
}
