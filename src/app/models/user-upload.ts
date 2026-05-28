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
  suggestedEvent = '';
  status: UploadStatus = 'pending';
  uploader: UploaderInfo = {};
  fileName = '';
  fileType = '';
  fileSize = 0;
}