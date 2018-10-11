import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/storage';
import { finalize } from 'rxjs/operators';
import { Message } from './message';
import { AuthService } from 'src/app/components/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  messages: AngularFireList<Message>;
  messageCount: number = 0;
  increment: number = 2;

  constructor(
    private storage: AngularFireStorage,
    private db: AngularFireDatabase,
  ) {
    // this.auth.authState.subscribe(user => {
    // if (user) this.userId = user.uid;
    this.getPhotos().valueChanges().subscribe(
      (messages: Message[]) => {
        this.updatePhotosEvent(messages);
      }
    );
    // });
  }

  getYears() {
    let years = Array<Number>();
    for (let i = 1880; i <= 2000; i++) {
      years.push(i);
    }
    return years;
  }

  private photosSource = new BehaviorSubject([]);
  photosObservable = this.photosSource.asObservable();

  updatePhotosEvent(photos: Message[]) {
    this.photosSource.next(photos);
  }

  getPhotos() {
    this.messageCount = this.messageCount + this.increment;
    this.photos = this.db.list('photos', ref => ref.limitToFirst(this.messageCount));
    return this.photos;
  }

  addMessage(title, body) {
    let author = this.auth.user.id;
    let message = new Message(title, body, author);
    message.id = this.db.createPushId();
    this.messages = this.db.list('photos', ref => ref.limitToFirst(this.messageCount));

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

  updateMessage(message: Message) {
    this.messages.update(photo.id, photo);
  }

  deletePhoto(photo: Photo) {
    this.photos.remove(photo.id);
  }

}
