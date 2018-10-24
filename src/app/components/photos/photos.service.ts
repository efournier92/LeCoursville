import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
import { finalize } from 'rxjs/operators';
import { Photo } from './photo';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';

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
    private auth: AuthService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        if (user) {
          this.getPhotos().valueChanges().subscribe(
            (photos: Photo[]) => {
              this.updatePhotosEvent(photos);
            }
          );
        }
      }
    )
  }

  getYears(): Array<Number> {
    let years: Array<Number> = Array<Number>();
    for (let i = 1880; i <= 2000; i++) {
      years.push(i);
    }
    return years;
  }

  private photosSource: BehaviorSubject<Photo[]> = new BehaviorSubject([]);
  photosObservable: Observable<Photo[]> = this.photosSource.asObservable();

  updatePhotosEvent(photos: Photo[]): void {
    this.photosSource.next(photos);
  }

  getPhotos(): AngularFireList<Photo> {
    this.photoCount = this.photoCount + this.increment;
    this.photos = this.db.list('photos', ref => ref.limitToFirst(this.photoCount));
    return this.photos;
  }

  addPhotos(file: any): void {
    let photo: Photo = new Photo();
    photo.id = this.db.createPushId();
    photo.extension = file.name.split('.').pop();
    photo.path = `photos/${photo.id}.${photo.extension}`;

    const fileRef: AngularFireStorageReference = this.storage.ref(photo.path);
    const task: AngularFireUploadTask = this.storage.upload(photo.path, file);
    task.snapshotChanges().pipe(
      finalize(() => {
        fileRef.getDownloadURL().subscribe(
          url => {
            const photosDb: AngularFireList<{}> = this.db.list('photos');
            photo.url = url;
            photosDb.set(photo.id, photo);
          }
        )
      })
    ).subscribe()
  }

  updatePhoto(photo: Photo): void {
    this.photos.update(photo.id, photo);
  }

  deletePhoto(photo: Photo): void {
    this.photos.remove(photo.id);
  }
}
