export interface UploadableMedia {
  id: string;
  title: string;
  artist: string;
  date: string;
  folderName: string;
  fileName: string;
  isSticky: boolean;
  isHidden: boolean;
  listing: any[];
  urls: { download: string; icon: string };
  type: string;
  format: string;
  dateUpdated: Date;
}
