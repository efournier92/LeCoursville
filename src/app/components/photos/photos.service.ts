import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/storage';
import { finalize } from 'rxjs/operators';
import { Photo } from './photo';

@Injectable({
  providedIn: 'root'
})
export class PhotosService {
  photos: AngularFireList<Photo>;
  photoCount: number = 0;
  increment: number = 2;

  constructor(
    private storage: AngularFireStorage,
    private db: AngularFireDatabase,
  ) {
    // this.auth.authState.subscribe(user => {
      // if (user) this.userId = user.uid;
      this.getPhotos().valueChanges().subscribe(
        (photos: Photo[]) => {
          this.updatePhotosEvent(photos);
        }
      );
    // });
  }

  private photosSource = new BehaviorSubject([]);
  photosObservable = this.photosSource.asObservable();

  updatePhotosEvent(photos: Photo[]) {
    this.photosSource.next(photos);
  }

  getPhotos() {
    this.photoCount = this.photoCount + this.increment;
    return this.db.list('photos', ref => ref.limitToFirst(this.photoCount));
  }

  addPhotos(file: any) {
    let photo = new Photo();
    photo.id = this.db.createPushId();
    photo.extension = file.name.split('.').pop();
    photo.path = `photos/${photo.id}.${photo.extension}`;
    
    const fileRef = this.storage.ref(photo.path);
    const task = this.storage.upload(photo.path, file);
    task.snapshotChanges().pipe(
        finalize(() => {
          fileRef.getDownloadURL().subscribe(
            url => {
              const photosDb = this.db.list(`photos`);
              photo.url = url;
              photosDb.set(photo.id, photo);
            }
          )
        })
      ).subscribe()
  }

  updatePhoto(photo: Photo) {
    this.photos.update(photo.id, photo);
  }

  deletePhoto(photo: Photo) {
    this.photos.remove(photo.id);
  }

}
