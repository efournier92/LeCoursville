export interface MediaStorage {
  managed: true;
  key?: string;
  iconKey?: string;
  folder?: string;
  coverKey?: string;
  zipKey?: string;
  trackKeys?: string[];
  albumId?: string;
  bytes?: number;
  contentType?: string;
  batchId: string;
}

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
  storage?: MediaStorage;
}
