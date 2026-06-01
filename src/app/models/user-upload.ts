export type UploadStatus = 'pending' | 'approved' | 'rejected';

export interface UploaderInfo {
  name?: string;
  email?: string;
  anonymousId?: string;
}

export class UserUpload {
  id = '';
  url = '';
  path = '';
  dateAdded = new Date();
  eventName = '';
  status: UploadStatus = 'pending';
  uploader: UploaderInfo = {};
  fileName = '';
  fileType = '';
  fileSize = 0;
}