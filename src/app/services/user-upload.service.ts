import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/compat/storage';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import { UserUpload, UploaderInfo } from '../models/user-upload';
import { PhotoAlbum } from '../models/media/photo-album';
import { AnalyticsService } from './analytics.service';

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

  async approveUpload(upload: UserUpload): Promise<void> {
    const storage = this.storage.storage;

    // Use path when URL is empty (unauthenticated upload);
    // otherwise resolve from the stored URL.
    const sourceRef = upload.url
      ? (storage.refFromURL(upload.url) as any)
      : (storage.ref(upload.path) as any);
    const fileName = upload.path.split('/').pop();
    const pathParts = upload.path.split('/');
    // path: userUploads/{uploaderName}_{date}/{fileName}
    const folderName = pathParts[1]; // e.g. JohnDoe_2026-05-25
    const newPath = `photos/${folderName}/${fileName}`;
    const destRef = storage.ref(newPath);

    await sourceRef.copyTo(destRef);
    await sourceRef.delete();

    const newUrl = await destRef.getDownloadURL();

    await this.createPhotoAlbum(upload, newUrl, newPath);

    this.db.list(this.userUploadsRef).update(upload.id, {
      status: 'approved',
      path: newPath,
      url: newUrl,
    });
  }

  private async createPhotoAlbum(upload: UserUpload, url: string, path: string): Promise<void> {
    const album = new PhotoAlbum();
    album.id = upload.id;
    album.title = upload.eventName || 'Untitled Event';
    album.date = new Date().toISOString().split('T')[0];
    album.listing = [upload.id];
    album.urls = { download: url, icon: url };

    this.db.list('photoAlbums').update(album.id, album);
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