import { Injectable } from '@angular/core';
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from 'firebase/storage';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { UserUpload, UploaderInfo } from '../models/user-upload';
import { Photo } from '../models/photo';
import { AnalyticsService } from './analytics.service';
import { PhotoAlbumsService } from './photo-albums.service';
import { FirebaseService } from './firebase.service';
import { RtdbService } from './rtdb.service';
import { FireUploadTask } from './fire-upload-task';

const UPLOADS_PREFIX = 'userUploads/';
const SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/;

@Injectable({
  providedIn: 'root'
})
export class UserUploadService {
  private userUploadsRef = 'userUploads';
  allUploads$: Observable<UserUpload[]>;

  constructor(
    private firebase: FirebaseService,
    private rtdb: RtdbService,
    private analytics: AnalyticsService,
    private photoAlbumsService: PhotoAlbumsService,
  ) {
    // Lazy and shared: userUploads is admin-only, so anonymous upload pages must never trigger this read.
    this.allUploads$ = this.rtdb.list<UserUpload>(this.userUploadsRef).valueChanges().pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  getPendingUploads() {
    return this.rtdb.list<UserUpload>(this.userUploadsRef, [
      this.rtdb.orderByChild('status'),
      this.rtdb.equalTo('pending'),
    ]);
  }

  getAllUploads() {
    return this.rtdb.list<UserUpload>(this.userUploadsRef);
  }

  subscribeToPendingUploads(callback: (uploads: UserUpload[]) => void): void {
    this.getPendingUploads().valueChanges().subscribe(callback);
  }

  subscribeToAllUploads(callback: (uploads: UserUpload[]) => void): void {
    this.getAllUploads().valueChanges().subscribe(callback);
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Storage operations use the record's `path`, never its `url`: a URL is a
   * client-authored string, while the path is constrained to the uploads tree
   * by the RTDB rules.
   */
  private validatedUploadPath(upload: UserUpload): string {
    const path = (upload.path || '').trim();
    if (
      !path.startsWith(UPLOADS_PREFIX) ||
      path.includes('\0') ||
      path.split('/').some(segment => segment === '' || segment === '.' || segment === '..')
    ) {
      throw new Error('Upload path is outside the uploads folder.');
    }
    return path;
  }

  private destinationFileName(fileName: string): string {
    if (!SAFE_FILE_NAME.test(fileName)) {
      throw new Error(`Unsafe upload file name: ${fileName}`);
    }
    return fileName;
  }

  async uploadFile(file: File, eventName: string, uploader: UploaderInfo, uploaderName?: string, batchId?: string): Promise<{ task: FireUploadTask, uploadId: string }> {
    const uploadId = this.rtdb.createPushId();
    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    let folderName: string;
    if (batchId) {
      folderName = batchId;
    } else {
      const timePart = hrs + mins + secs;
      const dateFolder = `${datePart}-${timePart}`;
      const sanitizedEvent = eventName ? `${this.sanitizeName(eventName)}_` : '';
      const namePart = uploaderName ? `${this.sanitizeName(uploaderName)}_` : 'Anonymous_';
      folderName = `${sanitizedEvent}${namePart}${dateFolder}`;
    }

    const path = `${this.userUploadsRef}/${folderName}/${file.name}`;
    const storageRef = ref(this.firebase.storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on('state_changed', {
      next: () => {},
      error: err => {
        console.error('Upload failed:', err);
      },
      complete: async () => {
        // The create contract carries no URL: the admin derives the download
        // URL from the validated path when they approve the upload.
        const upload: UserUpload = {
          id: uploadId,
          url: '',
          path,
          dateAdded: new Date(),
          eventName,
          status: 'pending',
          uploader,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        };
        await this.rtdb.object(`${this.userUploadsRef}/${uploadId}`).set(upload);
        this.analytics.logEvent('file_upload', {
          file_type: file.type,
          file_size: file.size,
          event_name: eventName || 'none',
          batch_id: batchId || 'single',
        });
      },
    });

    return { task: new FireUploadTask(task), uploadId };
  }

  /**
   * @deprecated Use `approveUploadToAlbum(upload, albumId)` so the resulting
   * photo gets an `albumId` and the album gains the new member. This legacy
   * method writes a loose photo (no album) and is kept only so any external
   * callers do not break; do not call from new code.
   */
  async approveUpload(upload: UserUpload): Promise<void> {
    const storageInstance = this.firebase.storage;
    const sourcePath = this.validatedUploadPath(upload);
    const pathParts = sourcePath.split('/');
    const fileName = this.destinationFileName(pathParts[pathParts.length - 1]);
    const folderName = pathParts[1];
    const newPath = `photos/${folderName}/${fileName}`;
    const sourceStorageRef = ref(storageInstance, sourcePath);
    const destStorageRef = ref(storageInstance, newPath);
    const blob = await getBlob(sourceStorageRef);
    await uploadBytes(destStorageRef, blob, { contentType: upload.fileType || undefined });
    await deleteObject(sourceStorageRef);
    const newUrl = await getDownloadURL(destStorageRef);

    const photoId = this.rtdb.createPushId();
    const extension = upload.fileName?.split('.').pop() || 'jpg';
    const photo: Photo = {
      id: photoId,
      dateAdded: new Date(),
      path: newPath,
      extension,
      url: newUrl,
      info: '',
      location: '',
      year: 0,
      takenBy: '',
      uploadedBy: upload.uploader?.anonymousId || 'anonymous',
      isYearCirca: false,
      isEditable: false,
      isMessageAttachment: false,
      albumId: null,
    };
    await this.rtdb.object(`photos/${photoId}`).set(photo);

    await this.rtdb.object(`${this.userUploadsRef}/${upload.id}`).update({
      status: 'approved',
      path: newPath,
      url: newUrl,
    });
  }

  async approveUploadToAlbum(upload: UserUpload, albumId: string): Promise<void> {
    const photoId = this.rtdb.createPushId();
    const sourcePath = this.validatedUploadPath(upload);
    const fileName = this.destinationFileName(
      upload.fileName || sourcePath.split('/').pop() || '',
    );
    const extension = fileName.split('.').pop() || 'jpg';
    const newPath = `photos/${albumId}/${fileName}`;
    const storageInstance = this.firebase.storage;
    const sourceStorageRef = ref(storageInstance, sourcePath);
    const destStorageRef = ref(storageInstance, newPath);
    const blob = await getBlob(sourceStorageRef);
    await uploadBytes(destStorageRef, blob, { contentType: upload.fileType || undefined });
    await deleteObject(sourceStorageRef);
    const downloadUrl = await getDownloadURL(destStorageRef);
    const photo: Photo = {
      id: photoId,
      dateAdded: new Date(),
      path: newPath,
      extension,
      url: downloadUrl,
      info: '',
      location: '',
      year: 0,
      takenBy: '',
      uploadedBy: upload.uploader?.anonymousId || 'anonymous',
      isYearCirca: false,
      isEditable: false,
      isMessageAttachment: false,
      albumId,
    };
    await this.rtdb.object(`photos/${photoId}`).set(photo);
    await this.rtdb.object(`userUploads/${upload.id}`).update({
      status: 'approved',
      path: newPath,
      url: downloadUrl,
    });
    await this.photoAlbumsService.updateAlbum(albumId, {});
  }

  async rejectUpload(upload: UserUpload): Promise<void> {
    const storageRef = ref(this.firebase.storage, this.validatedUploadPath(upload));
    await deleteObject(storageRef);
    await this.rtdb.object(`${this.userUploadsRef}/${upload.id}`).remove();
  }

  async deleteUpload(upload: UserUpload): Promise<void> {
    try {
      const storageRef = ref(this.firebase.storage, this.validatedUploadPath(upload));
      await deleteObject(storageRef);
    } catch (e) {
      console.warn('File already deleted from storage');
    }
    await this.rtdb.object(`${this.userUploadsRef}/${upload.id}`).remove();
  }
}
