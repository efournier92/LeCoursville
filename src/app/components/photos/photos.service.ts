import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { Contact } from '../contacts/contacts.component';
import { BehaviorSubject } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/storage';

export class Photo {
  id: string;
  path: string;
  info: string;
}

@Injectable({
  providedIn: 'root'
})
export class PhotosService {
  photos: AngularFireList<Photo>;

  constructor(
    private storage: AngularFireStorage,
    private db: AngularFireDatabase,
  ) { 

  }

  private photosSource = new BehaviorSubject([]);
  photosObservable = this.photosSource.asObservable();

  updateContactsEvent(photos: Photo[]) {
    this.photosSource.next(photos);
  }

  getContacts() {
    // if (!userId) return;
    this.photos = this.db.list(`photos`, ref => ref.limitToFirst(2));
  }

  addPhoto(event: any) {
    const file = event.target.files[0];
    const filePath = 'photos';
    const task = this.storage.upload(filePath, file);
    task.then(() => console.log('UPLOADED!'))
    event.id = this.db.createPushId();
    this.photos.set(event.id, event);
  }

  updatePhoto(photo: Photo) {
    this.photos.update(photo.id, photo);
  }

  deletePhoto(photo: Photo) {
    this.photos.remove(photo.id);
  }

}
