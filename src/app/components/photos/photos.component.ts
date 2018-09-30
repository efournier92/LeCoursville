import { Component, OnInit } from '@angular/core';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { PhotosService } from './photos.service'
import { Photo } from './photo';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';

@Component({
  selector: 'app-photos',
  templateUrl: './photos.component.html',
  styleUrls: ['./photos.component.scss']
})
export class PhotosComponent implements OnInit {
  user: User;
  ref: AngularFireStorageReference;
  task: AngularFireUploadTask;
  uploads: any[];
  allPercentage: Observable<any>;
  photos: Photo[];
  url: string;
  
  constructor(
    private photosService: PhotosService,
    private auth: AuthService,
    ) {
      this.auth.userObservable.subscribe(
        (user: User) => {
          this.user = user;
        }
      )
      // let download = require('download');
      // download('./assets/calendars/2018.pdf');
     }
     

  ngOnInit() {
    this.photosService.photosObservable.subscribe(photos => {
      this.photos = photos;
    })
  }

  addPhotos(event) {
    for (let file of event.currentTarget.files) {
      this.photosService.addPhotos(file)
    }
  }

  loadMore () {
    this.photosService.getPhotos().valueChanges().subscribe(
      (photos: Photo[]) => {
        this.photos = photos;
      }

    );
  }
}
