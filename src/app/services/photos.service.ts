import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { Photo } from 'src/app/models/photo';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { FirebaseService } from './firebase.service';
import { RtdbService } from './rtdb.service';
import { FireUploadTask } from './fire-upload-task';

export interface PhotoUpload {
  photo: Photo;
  task: FireUploadTask;
  onUrlAvailable: Observable<string>;
}

@Injectable({
  providedIn: 'root'
})
export class PhotosService implements OnDestroy {
  private readonly PHOTOS_PATH = 'photos';

  photoCount = 0;
  increment = 2;
  user: User;

  private allPhotosSource: BehaviorSubject<Photo[]> = new BehaviorSubject([]);
  allPhotosObservable: Observable<Photo[]> = this.allPhotosSource.asObservable();

  private nonMessagePhotosSource = new BehaviorSubject<Photo[]>([]);
  public nonMessagePhotos$: Observable<Photo[]> = this.nonMessagePhotosSource.asObservable();

  private userSub: Subscription;
  private photosSub: Subscription;
  private listenersForUserId: string | null = null;

  constructor(
    private firebase: FirebaseService,
    private rtdb: RtdbService,
    private auth: AuthService,
  ) {
    this.userSub = this.auth.userObservable.subscribe(
      (user: User) => {
        if (!user?.id) {
          return;
        }
        this.user = user;
        // userObservable re-emits on every profile write; one RTDB listener per
        // signed-in user is enough, and it must follow a different sign-in.
        if (user.id === this.listenersForUserId) {
          return;
        }
        this.listenersForUserId = user.id;
        this.photosSub?.unsubscribe();
        this.photosSub = this.rtdb.list<Photo>(this.PHOTOS_PATH).valueChanges().subscribe(
          (photos: Photo[]) => {
            this.updateAllPhotosEvent(photos);
            this.nonMessagePhotosSource.next(photos.filter(p => !p.isMessageAttachment));
          }
        );
      }
    );
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.photosSub?.unsubscribe();
  }

  async updatePhoto(photo: Photo): Promise<void> {
    await this.rtdb.object(`${this.PHOTOS_PATH}/${photo.id}`).update({
      info: photo.info,
      location: photo.location,
      year: photo.year,
      isYearCirca: photo.isYearCirca,
      takenBy: photo.takenBy,
    });
  }

  deletePhoto(photo: Photo): void {
    this.rtdb.object(`${this.PHOTOS_PATH}/${photo.id}`).remove();
    const target = photo.path || photo.url;
    if (target) {
      deleteObject(ref(this.firebase.storage, target)).catch(() => {});
    }
  }

  updateAllPhotosEvent(photos: Photo[]): void {
    this.allPhotosSource.next(photos);
  }

  getAllPhotos(): Observable<Photo[]> {
    return this.rtdb.list<Photo>(this.PHOTOS_PATH).valueChanges();
  }

  getPhotoById(photoId: string): Observable<Photo> {
    return this.rtdb.object<Photo>(`photos/${photoId}`).valueChanges().pipe(
      filter((photo): photo is Photo => !!photo && !!photo.id),
      map(photo => photo as Photo),
    );
  }

  getPhotosByAlbum(albumId: string): Observable<Photo[]> {
    return this.rtdb.list<Photo>(this.PHOTOS_PATH, [
      this.rtdb.orderByChild('albumId'),
      this.rtdb.equalTo(albumId),
    ]).valueChanges();
  }

  getLoosePhotos(): Observable<Photo[]> {
    return this.rtdb.list<Photo>(this.PHOTOS_PATH, [
      this.rtdb.orderByChild('albumId'),
      this.rtdb.equalTo(''),
    ]).valueChanges();
  }

  async setPhotoAlbum(photoId: string, albumId: string | null): Promise<void> {
    await this.rtdb.object(`${this.PHOTOS_PATH}/${photoId}`).update({ albumId });
  }

  async setAlbumCover(albumId: string, photoId: string | null): Promise<void> {
    await this.rtdb.object(`photoAlbums/${albumId}`).update({ coverPhotoId: photoId, updatedAt: Date.now() });
  }

  uploadPhoto(file: any, isMessageAttachment: boolean): PhotoUpload {
    return this.uploadImage(file, isMessageAttachment, 'photos');
  }

  uploadPhotoToAlbum(file: any, albumId: string): PhotoUpload {
    const upload = this.uploadImage(file, false, 'photos');
    upload.photo.albumId = albumId;
    return upload;
  }

  uploadVideoScreenshot(file: any, isMessageAttachment: boolean): void {
    this.uploadImage(file, isMessageAttachment, 'videoScreenshots');
  }

  uploadImage(file: any, isMessageAttachment: boolean, imageBucket: string): PhotoUpload {
    const photo: Photo = new Photo();
    photo.id = this.rtdb.createPushId();
    photo.dateAdded = new Date();
    photo.uploadedBy = this.user?.id || 'anonymous';
    photo.isMessageAttachment = isMessageAttachment;
    photo.extension = file.name.split('.').pop();
    photo.path = `${imageBucket}/${photo.id}.${photo.extension}`;

    const storageRef = ref(this.firebase.storage, photo.path);
    const task = uploadBytesResumable(storageRef, file);
    const photoUploadSource = new BehaviorSubject('');

    task.on('state_changed', {
      next: () => {},
      error: (e) => console.error('Upload failed:', e),
      complete: async () => {
        try {
          const url = await getDownloadURL(storageRef);
          photo.url = url;
          await this.rtdb.object(`${imageBucket}/${photo.id}`).set(photo);
          photoUploadSource.next(url);
        } catch (e) {
          console.error('Upload finalize failed:', e);
        }
      },
    });

    const upload = new Object() as PhotoUpload;
    upload.task = new FireUploadTask(task);
    upload.photo = photo;
    upload.onUrlAvailable = photoUploadSource.asObservable();

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
