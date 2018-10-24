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
  photos: Photo[];
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
  }

  ngOnInit(): void {
    this.years = this.photosService.getYears();
    this.photosService.photosObservable.subscribe(photos => {
      this.photos = photos;
    })
  }

  addPhotos(event: any): void {
    for (let file of event.currentTarget.files) {
      this.photosService.addPhotos(file)
    }
  }

  loadMore(): void {
    this.photosService.getPhotos().valueChanges().subscribe(
      (photos: Photo[]) => {
        this.photos = photos;
      }
    );
  }

  updatePhoto(photo: Photo): void {
    photo.editable = false;
    this.photosService.updatePhoto(photo);
  }

  deletePhoto(photo): void {
    this.photosService.deletePhoto(photo);
  }
}
