import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFireDatabase, AngularFireList, AngularFireObject } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { Video } from 'src/app/models/video';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';

@Injectable({
  providedIn: 'root'
})
export class VideosService {
  user: any;
  videos: AngularFireList<Video>;

  constructor(
    private db: AngularFireDatabase,
    private auth: AuthService,
    private angularFireAuth: AngularFireAuth,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        if (user)
          this.user = user;
        this.getVideos().valueChanges().subscribe(
          (videos: Video[]) => {
            this.updateMessagesEvent(videos);
          }
        );
      }
    )
  }

  private messagesSource: BehaviorSubject<Video[]> = new BehaviorSubject<Video[]>([]);
  videosObservable: Observable<Video[]> = this.messagesSource.asObservable();

  updateMessagesEvent(messages: Video[]): void {
    this.messagesSource.next(messages);
  }

  create(video: Video): void {
    video.id = this.db.createPushId();
    this.videos.update(video.id, video);
  }

  getVideos(): AngularFireList<Video> {
    this.videos = this.db.list('videos', ref => ref.limitToFirst(10));
    return this.videos;
  }

}
