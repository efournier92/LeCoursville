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

  shufflePhotos<Photo>(photos: Array<Photo>): Array<Photo> {
    if (photos.length <= 1) return photos;

    // For each index in array
    for (let i = 0; i < photos.length; i++) {

      // choose a random not-yet-placed item to place there
      // must be an item AFTER the current item, because the stuff
      // before has all already been placed
      const randomChoiceIndex = getRandom(i, photos.length - 1);

      // place our random choice in the spot by swapping
      [photos[i], photos[randomChoiceIndex]] = [photos[randomChoiceIndex], photos[i]];
    }

    return photos;
  }
}
