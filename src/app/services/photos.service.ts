import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/compat/storage';
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
  private readonly PHOTOS_PATH = 'photos';

  photos: AngularFireList<Photo>;
  allPhotos: AngularFireList<Photo>;
  photoCount = 0;
  increment = 2;
  user: User;

  private allPhotosSource: BehaviorSubject<Photo[]> = new BehaviorSubject([]);
  allPhotosObservable: Observable<Photo[]> = this.allPhotosSource.asObservable();

  private nonMessagePhotosSource = new BehaviorSubject<Photo[]>([]);
  public nonMessagePhotos$: Observable<Photo[]> = this.nonMessagePhotosSource.asObservable();

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
              this.nonMessagePhotosSource.next(photos.filter(p => !p.isMessageAttachment));
            }
          );
        }
      }
    );
  }

  async updatePhoto(photo: Photo): Promise<void> {
    await this.db.object(`${this.PHOTOS_PATH}/${photo.id}`).update({
      info: photo.info,
      location: photo.location,
      year: photo.year,
      isYearCirca: photo.isYearCirca,
      takenBy: photo.takenBy,
    });
  }

  deletePhoto(photo: Photo): void {
    this.allPhotos.remove(photo.id);
    this.storage.storage.refFromURL(photo.url).delete();
  }

  updateAllPhotosEvent(photos: Photo[]): void {
    this.allPhotosSource.next(photos);
  }

  getAllPhotos(): AngularFireList<Photo> {
    this.allPhotos = this.db.list(this.PHOTOS_PATH);
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

  getPhotosByAlbum(albumId: string): Observable<Photo[]> {
    return this.db.list(this.PHOTOS_PATH, ref => ref.orderByChild('albumId').equalTo(albumId))
      .valueChanges() as Observable<Photo[]>;
  }

  getLoosePhotos(): Observable<Photo[]> {
    return this.db.list(this.PHOTOS_PATH, ref =>
      ref.orderByChild('albumId').equalTo('')
    ).valueChanges() as Observable<Photo[]>;
  }

  async setPhotoAlbum(photoId: string, albumId: string | null): Promise<void> {
    await this.db.object(`${this.PHOTOS_PATH}/${photoId}`).update({ albumId });
  }

  async setAlbumCover(albumId: string, photoId: string | null): Promise<void> {
    await this.db.object(`photoAlbums/${albumId}`).update({ coverPhotoId: photoId, updatedAt: Date.now() });
  }

  uploadPhoto(file: any, isMessageAttachment: boolean): PhotoUpload {
    return this.uploadImage(file, isMessageAttachment, 'photos');
  }

  uploadPhotoToAlbum(file: any, albumId: string): PhotoUpload {
    const upload = this.uploadImage(file, false, 'photos');
    upload.photo.albumId = albumId;
    return upload;
  }

  uploadVideoScreenshot(file: any, isMessageAttachment: boolean) {
    this.uploadImage(file, isMessageAttachment, 'videoScreenshots');
  }

  uploadImage(file: any, isMessageAttachment: boolean, imageBucket: string): PhotoUpload {
    const photo: Photo = new Photo();
    photo.id = this.db.createPushId();
    photo.dateAdded = new Date();
    photo.uploadedBy = this.user?.id || 'anonymous';
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
            photosDb.update(photo.id, photo);
            photoUploadSource.next(url);
          }
        );
      })
    ).subscribe();

    const photoUploadSource = new BehaviorSubject('');
    const onUrlAvailable = photoUploadSource.asObservable();

    const upload = new Object() as PhotoUpload;
    upload.task = task;
    upload.photo = photo;
    upload.onUrlAvailable = onUrlAvailable;

    return upload;
  }

  getYears(): number[] {
    const thisYear: number = new Date().getFullYear();
    const years: number[] = [];
    for (let i = 1800; i <= thisYear; i++) {
      years.push(i);
    }
    return years;
  }
}
