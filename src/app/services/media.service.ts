import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFireDatabase, AngularFireList, AngularFireObject } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Media } from 'src/app/models/media';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  user: any;
  mediaList: AngularFireList<Media>;
  private mediaSource: BehaviorSubject<Media[]> = new BehaviorSubject<Media[]>([]);
  mediaObservable: Observable<Media[]> = this.mediaSource.asObservable();

  constructor(
    private db: AngularFireDatabase,
    private auth: AuthService,
    private angularFireAuth: AngularFireAuth,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        if (user)
          this.user = user;
        this.getMedia().valueChanges().subscribe(
          (mediaList: Media[]) => {
            this.updateMediaEvent(mediaList);
          }
        );
      }
    )
  }

  updateMediaEvent(messages: Media[]): void {
    this.mediaSource.next(messages);
  }

  create(media: Media): void {
    if (!media || !media.id)
      media.id = this.db.createPushId();
    media.dateAdded = new Date();

    this.mediaList.update(media.id, media);
  }

  getMedia(): AngularFireList<Media> {
    this.mediaList = this.db.list('media', ref => ref.limitToFirst(100));
    return this.mediaList;
  }

  getById(id: string): Observable<Media> {
    let mediaObj = this.db.object(`media/${id}`);
    const mediaByIdSource: BehaviorSubject<Media> = new BehaviorSubject<Media>(new Media());
    const mediaByIdObservable: Observable<Media> = mediaByIdSource.asObservable();

    function updateMediaEvent(media: Media): void {
      mediaByIdSource.next(media);
    }
    mediaObj.valueChanges().subscribe(
      (media: Media) => {
        if (media && media.id)
          updateMediaEvent(media);
      }
    )
    return mediaByIdObservable;
  }

}
