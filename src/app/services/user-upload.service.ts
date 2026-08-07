import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/compat/storage';
import { ref as fbRef, getBlob, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import { UserUpload, UploaderInfo } from '../models/user-upload';
import { Photo } from '../models/photo';
import { AnalyticsService } from './analytics.service';
import { PhotoAlbumsService } from './photo-albums.service';

@Injectable({
  providedIn: 'root'
})
export class UserUploadService {
  private userUploadsRef = 'userUploads';
  private allUploadsSource: BehaviorSubject<UserUpload[]> = new BehaviorSubject([]);
  allUploads$: Observable<UserUpload[]> = this.allUploadsSource.asObservable();

  constructor(
    private storage: AngularFireStorage,
    private db: AngularFireDatabase,
    private auth: AngularFireAuth,
    private analytics: AnalyticsService,
    private photoAlbumsService: PhotoAlbumsService,
  ) {}

  getPendingUploads(): AngularFireList<UserUpload> {
    return this.db.list(this.userUploadsRef, ref =>
      ref.orderByChild('status').equalTo('pending')
    );
  }

  getAllUploads(): AngularFireList<UserUpload> {
    return this.db.list(this.userUploadsRef);
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

  async uploadFile(file: File, eventName: string, uploader: UploaderInfo, uploaderName?: string, batchId?: string): Promise<{ task: AngularFireUploadTask, uploadId: string }> {
    const uploadId = this.db.createPushId();
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

    let path = `${this.userUploadsRef}/${folderName}/${file.name}`;

    const fileRef: AngularFireStorageReference = this.storage.ref(path);
    const task: AngularFireUploadTask = this.storage.upload(path, file);

    task.snapshotChanges().pipe(
      take(1),
      finalize(() => {
        this.auth.authState.pipe(take(1)).subscribe({
          next: user => {
            if (user) {
              fileRef.getDownloadURL().subscribe(url => {
                const upload: UserUpload = {
                  id: uploadId,
                  url,
                  path,
                  dateAdded: new Date(),
                  eventName,
                  status: 'pending',
                  uploader,
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                };
                this.db.list(this.userUploadsRef).update(uploadId, upload);
                this.analytics.logEvent('file_upload', {
                  file_type: file.type,
                  file_size: file.size,
                  event_name: eventName || 'none',
                  batch_id: batchId || 'single',
                });
              });
            } else {
              // No auth — skip getDownloadURL (would 403 on read since read requires auth).
              // Admin fills in the URL when they approve the upload.
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
              this.db.list(this.userUploadsRef).update(uploadId, upload);
              this.analytics.logEvent('file_upload', {
                file_type: file.type,
                file_size: file.size,
                event_name: eventName || 'none',
                batch_id: batchId || 'single',
              });
            }
          },
          error: err => {
            console.error('Failed to write upload record to RTDB:', err);
          }
        });
      })
    ).subscribe();

    return { task, uploadId };
  }

  /**
   * @deprecated Use `approveUploadToAlbum(upload, albumId)` so the resulting
   * photo gets an `albumId` and the album gains the new member. This legacy
   * method writes a loose photo (no album) and is kept only so any external
   * callers do not break; do not call from new code.
   */
  async approveUpload(upload: UserUpload): Promise<void> {
    const storageInstance = this.storage.storage;
    const fileName = upload.path.split('/').pop();
    const pathParts = upload.path.split('/');
    const folderName = pathParts[1];
    const newPath = `photos/${folderName}/${fileName}`;
    const sourceStorageRef = upload.url
      ? fbRef(storageInstance, upload.url)
      : fbRef(storageInstance, upload.path);
    const destStorageRef = fbRef(storageInstance, newPath);
    const blob = await getBlob(sourceStorageRef);
    await uploadBytes(destStorageRef, blob, { contentType: upload.fileType || undefined });
    await deleteObject(sourceStorageRef);
    const newUrl = await getDownloadURL(destStorageRef);

    const photoId = this.db.createPushId();
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
    await this.db.object(`photos/${photoId}`).set(photo);

    this.db.list(this.userUploadsRef).update(upload.id, {
      status: 'approved',
      path: newPath,
      url: newUrl,
    });
  }

  async approveUploadToAlbum(upload: UserUpload, albumId: string): Promise<void> {
    const photoId = this.db.createPushId();
    const extension = upload.fileName?.split('.').pop() || 'jpg';
    const newPath = `photos/${albumId}/${upload.fileName}`;
    const storageInstance = this.storage.storage;
    const sourceStorageRef = upload.url
      ? fbRef(storageInstance, upload.url)
      : fbRef(storageInstance, upload.path);
    const destStorageRef = fbRef(storageInstance, newPath);
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
    await this.db.object(`photos/${photoId}`).set(photo);
    await this.db.object(`userUploads/${upload.id}`).update({
      status: 'approved',
      path: newPath,
      url: downloadUrl,
    });
    await this.photoAlbumsService.updateAlbum(albumId, {});
  }

  async rejectUpload(upload: UserUpload): Promise<void> {
    const storageRef = this.storage.storage.refFromURL(upload.url);
    await storageRef.delete();
    this.db.list(this.userUploadsRef).remove(upload.id);
  }

  async deleteUpload(upload: UserUpload): Promise<void> {
    try {
      const storageRef = this.storage.storage.refFromURL(upload.url);
      await storageRef.delete();
    } catch (e) {
      console.warn('File already deleted from storage');
    }
    this.db.list(this.userUploadsRef).remove(upload.id);
  }
}
