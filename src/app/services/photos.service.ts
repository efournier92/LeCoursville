import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Photo } from 'src/app/models/photo';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';

export interface PhotoUpload {
  photo: Photo;
  task: AngularFireUploadTask;
  onUrlAvailable: Observable<string>;
}

@Injectable({
  providedIn: 'root'
})
export class PhotosService {
  photos: AngularFireList<Photo>;
  allPhotos: AngularFireList<Photo>;
  photoCount = 0;
  increment = 2;
  user: User;

  private allPhotosSource: BehaviorSubject<Photo[]> = new BehaviorSubject([]);
  allPhotosObservable: Observable<Photo[]> = this.allPhotosSource.asObservable();

  constructor(
    private storage: AngularFireStorage,
    private db: AngularFireDatabase,
    private auth: AuthService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        if (user) {
          this.user = user;
          this.getAllPhotos().valueChanges().subscribe(
            (photos: Photo[]) => {
              this.updateAllPhotosEvent(photos);
            }
          );
        }
      }
    );
  }

  updatePhoto(photo: Photo): void {
    const photosDb = this.db.list('photos');
    // photosDb.update(photo.id, photo);
  }

  deletePhoto(photo: Photo): void {
    this.allPhotos.remove(photo.id);
    this.storage.storage.refFromURL(photo.url).delete();
  }

  updateAllPhotosEvent(photos: Photo[]): void {
    this.allPhotosSource.next(photos);
  }

  getAllPhotos(): AngularFireList<Photo> {
    this.allPhotos = this.db.list('photos');
    return this.allPhotos;
  }

  getPhotoById(photoId: string): Observable<Photo> {
    const photoObj = this.db.object(`photos/${photoId}`);
    const photoByIdSource: BehaviorSubject<Photo> = new BehaviorSubject<Photo>(new Photo());
    const photoByIdObservable: Observable<Photo> = photoByIdSource.asObservable();

    function updatePhotoEvent(photo: Photo): void {
      photoByIdSource.next(photo);
    }
    photoObj.valueChanges().subscribe(
      (photo: Photo) => {
        if (photo && photo.id) {
          updatePhotoEvent(photo);
        }
      }
    );
    return photoByIdObservable;
  }

  uploadPhoto(file: any, isMessageAttachment: boolean): PhotoUpload {
    return this.uploadImage(file, isMessageAttachment, 'photos');
  }

  uploadVideoScreenshot(file: any, isMessageAttachment: boolean) {
    this.uploadImage(file, isMessageAttachment, 'videoScreenshots');
  }

  uploadImage(file: any, isMessageAttachment: boolean, imageBucket: string): PhotoUpload {
    const photo: Photo = new Photo();
    photo.id = this.db.createPushId();
    photo.dateAdded = new Date();
    photo.uploadedBy = this.user.id;
    photo.isMessageAttachment = isMessageAttachment;
    photo.extension = file.name.split('.').pop();
    photo.path = `${imageBucket}/${photo.id}.${photo.extension}`;

    const fileRef: AngularFireStorageReference = this.storage.ref(photo.path);
    const task: AngularFireUploadTask = this.storage.upload(photo.path, file);
    task.snapshotChanges().pipe(
      finalize(() => {
        fileRef.getDownloadURL().subscribe(
          url => {
            const photosDb: AngularFireList<object> = this.db.list(imageBucket);
            photo.url = url;
            // photosDb.update(photo.id, photo);
            photoUploadSource.next(url);
          }
        );
      })
    ).subscribe();

    const photoUploadSource = new BehaviorSubject('');
    const onUrlAvailable = photoUploadSource.asObservable();

    const upload = new Object as PhotoUpload;
    upload.task = task;
    upload.photo = photo;
    upload.onUrlAvailable = onUrlAvailable;

    return upload;
  }

  getYears(): Array<number> {
    const thisYear: number = new Date().getFullYear();
    const years: Array<number> = Array<number>();
    for (let i = 1800; i <= thisYear; i++) {
      years.push(i);
    }
    return years;
  }
}
