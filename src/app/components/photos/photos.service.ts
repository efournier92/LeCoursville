import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
import { finalize } from 'rxjs/operators';
import { Photo } from './photo';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';

export interface PhotoUpload {
  photo: Photo;
  task: AngularFireUploadTask;
}

@Injectable({
  providedIn: 'root'
})
export class PhotosService {
  photos: AngularFireList<Photo>;
  allPhotos: AngularFireList<Photo>;
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
          this.getAllPhotos().valueChanges().subscribe(
            (photos: Photo[]) => {
              this.updateAllPhotosEvent(photos);
            }
          );
        }
      }
    )
  }

  getYears(): Array<Number> {
    let thisYear: number = new Date().getFullYear()
    let years: Array<Number> = Array<Number>();
    for (let i = 1800; i <= thisYear; i++) {
      years.push(i);
    }
    return years;
  }

  private allPhotosSource: BehaviorSubject<Photo[]> = new BehaviorSubject([]);
  allPhotosObservable: Observable<Photo[]> = this.allPhotosSource.asObservable();

  updateAllPhotosEvent(photos: Photo[]): void {
    this.allPhotosSource.next(photos);
  }

  getAllPhotos(): AngularFireList<Photo> {
    this.allPhotos = this.db.list('photos');
    return this.allPhotos;
  }

  getPhotoById(photoId: string): Observable<Photo> {
    let photoObj = this.db.object(`photos/${photoId}`);
    const photoByIdSource: BehaviorSubject<Photo> = new BehaviorSubject<Photo>(new Photo());
    const photoByIdObservable: Observable<Photo> = photoByIdSource.asObservable();

    function updatePhotoEvent(photo: Photo): void {
      photoByIdSource.next(photo);
    }

    photoObj.valueChanges().subscribe(
      (photo: Photo) => {
        if (photo && photo.id)
          updatePhotoEvent(photo);
      }
    )

    return photoByIdObservable;
  }

  uploadPhoto(file: any): PhotoUpload {
    let photo: Photo = new Photo();
    photo.id = this.db.createPushId();
    photo.dateAdded = new Date();
    photo.extension = file.name.split('.').pop();
    photo.path = `photos/${photo.id}.${photo.extension}`;

    const fileRef: AngularFireStorageReference = this.storage.ref(photo.path);
    const task: AngularFireUploadTask = this.storage.upload(photo.path, file);
    task.snapshotChanges().pipe(
      finalize(() => {
        fileRef.getDownloadURL().subscribe(
          url => {
            const photosDb: AngularFireList<Object> = this.db.list('photos');
            photo.url = url;
            photosDb.update(photo.id, photo);
            console.log(photo);
          }
        )
      })
    ).subscribe()

    let upload = new Object as PhotoUpload;
    upload.task = task;
    upload.photo = photo;

    return upload;
  }

  updatePhoto(photo: Photo): void {
    this.allPhotos.update(photo.id, photo);
  }


  deletePhoto(photo: Photo): void {
    this.allPhotos.remove(photo.id);
    this.storage.storage.refFromURL(photo.url).delete();
  }
}
