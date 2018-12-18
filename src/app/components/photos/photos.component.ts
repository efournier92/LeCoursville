import { Component, OnInit } from '@angular/core';
import { AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
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
  photos: Photo[] = new Array<Photo>();
  allPhotos: Photo[];
  url: string;
  loading: boolean = true;
  years: Number[];

  constructor(
    private photosService: PhotosService,
    private auth: AuthService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
    this.loadAllPhotos();
  }

  ngOnInit(): void {
    this.years = this.photosService.getYears();
    this.loadMore();


    // this.photosService.allPhotosObservable.subscribe(photos => {
    //   this.photos = photos;
    // })
  }

  addPhoto(event: any): void {
    for (let file of event.currentTarget.files) {
      this.photosService.addPhoto(file)
    }
  }

  loadMore(): void {
    if (this.allPhotos && this.allPhotos.length && this.photos.length < this.allPhotos.length) {
      this.photos.push(this.allPhotos[this.photos.length]);
    }


    // this.photosService.getPhotos().valueChanges().subscribe(
    //   (photos: Array<Photo>) => {
    //     this.photos = photos;
    //   }
    // );
  }

  shufflePhotos(photos: Array<Photo>) {
    for (let i = photos.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = photos[i];
      photos[i] = photos[j];
      photos[j] = temp;
    }
    return photos;
  }

  loadAllPhotos(): void {
    this.photosService.getAllPhotos().valueChanges().subscribe(
      (photos: Array<Photo>) => {
        this.allPhotos = this.shufflePhotos(photos);
        this.loadMore();
        this.loadMore();
        this.loadMore();
        // this.cleanPhotos();

        console.log(this.allPhotos);
      }
    );
  }

  cleanPhotos() {
    for (const photo of this.allPhotos) {
      photo.dateAdded = new Date();
      this.photosService.updatePhoto(photo);
    }
  }

  updatePhoto(photo: Photo): void {
    photo.isEditable = false;
    this.photosService.updatePhoto(photo);
  }

  deletePhoto(photo): void {
    this.photosService.deletePhoto(photo);
  }
}
