import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/compat/storage';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { UserUpload, UploaderInfo } from '../models/user-upload';
import { PhotoAlbum } from '../models/media/photo-album';

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

  async uploadFile(file: File, suggestedEvent: string, uploader: UploaderInfo, uploaderName?: string): Promise<{ task: AngularFireUploadTask, uploadId: string }> {
    const uploadId = this.db.createPushId();
    const dateFolder = new Date().toISOString().split('T')[0];
    const sanitizedEvent = suggestedEvent ? `${this.sanitizeName(suggestedEvent)}_` : '';
    const namePart = uploaderName ? `${this.sanitizeName(uploaderName)}_` : 'Anonymous_';
    const folderName = `${sanitizedEvent}${namePart}${dateFolder}`;

    let path = `${this.userUploadsRef}/${folderName}/${file.name}`;

    // Handle name conflicts in the same folder by appending wall-clock time
    try {
      const existingRef = this.storage.ref(path);
      await existingRef.getDownloadURL().toPromise();
      // File exists at this path, append wall-clock time to filename
      const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
      const baseName = ext ? file.name.slice(0, -ext.length) : file.name;
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      const wallClock = hrs + mins + secs;
      const newFileName = `${baseName}_${wallClock}${ext}`;
      path = `${this.userUploadsRef}/${folderName}/${newFileName}`;
    } catch {
      // No conflict, path is fine
    }

    const fileRef: AngularFireStorageReference = this.storage.ref(path);
    const task: AngularFireUploadTask = this.storage.upload(path, file);

    task.snapshotChanges().pipe(
      finalize(() => {
        fileRef.getDownloadURL().subscribe(url => {
          const upload: UserUpload = {
            id: uploadId,
            url,
            path,
            dateAdded: new Date(),
            suggestedEvent,
            status: 'pending',
            uploader,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          };
          this.db.list(this.userUploadsRef).update(uploadId, upload);
        });
      })
    ).subscribe();

    return { task, uploadId };
  }

  async approveUpload(upload: UserUpload): Promise<void> {
    const storage = this.storage.storage;

    // Cast to any to access native SDK methods not exposed in AngularFire types
    const sourceRef = storage.refFromURL(upload.url) as any;
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
    album.title = upload.suggestedEvent || 'Untitled Event';
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