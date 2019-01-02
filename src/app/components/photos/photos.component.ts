import { Component, OnInit } from '@angular/core';
import { AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { PhotosService } from './photos.service'
import { Photo } from './photo';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';
import { NgxGalleryOptions, NgxGalleryImage, NgxGalleryAnimation } from 'ngx-gallery';

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
  allPhotos: Photo[];
  loadablePhotos: Photo[] = new Array<Photo>();
  loadedPhotos: Photo[] = new Array<Photo>();
  foundPhotos: Photo[];
  newPhoto: Photo;
  url: string;
  searchTerm: string = '';
  loading: boolean = true;
  years: Number[];
  showSpinner: boolean = true;
  sortType: string = 'random';



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
    console.log("tr", PhotoSwipe);
  }

  addPhoto(event: any): void {
    for (let file of event.currentTarget.files) {
      this.photosService.addPhoto(file)
    }
  }

  loadAnotherPhoto(): void {
    let newPhoto = this.loadablePhotos[this.loadedPhotos.length]
    if (this.loadablePhotos && this.loadablePhotos.length && this.loadedPhotos.length < this.loadablePhotos.length && !this.loadedPhotos.some(photo => photo.id === newPhoto.id)) {
      this.loadedPhotos.push(newPhoto);
    }
  }

  loadNumMorePhotos(numToLoad): void {
    for (let i = 0; i < numToLoad; i++) {
      this.loadAnotherPhoto();
    }
    setTimeout(() => {
      this.showSpinner = false;
    }, 1000);
  }

  sortPhotosRandomly() {
    this.showSpinner = true;
    this.loadedPhotos = [];
    this.loadablePhotos = this.shufflePhotos(this.allPhotos);
    this.loadNumMorePhotos(3);
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

  sortPhotosBy(sortFunction) {
    this.showSpinner = true;
    this.loadablePhotos = this.allPhotos.sort(sortFunction);
    this.loadedPhotos = [];
    this.loadNumMorePhotos(3);
  }

  sortPhotosByDateAdded(a: Photo, b: Photo) {
    return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
  }

  sortPhotosByYearTaken(a: Photo, b: Photo) {
    return new Date(a.year).getFullYear() - new Date(b.year).getFullYear();
  }

  sortPhotosByYearTakenDown(a: Photo, b: Photo) {
    return new Date(b.year).getFullYear() - new Date(a.year).getFullYear();
  }

  searchPhotos(searchTerm): void {
    this.showSpinner = true;
    this.loadablePhotos = [];
    searchTerm = searchTerm.toLowerCase();
    for (const photo of this.allPhotos) {
      let info = photo.info.toLowerCase();
      let location = photo.location.toLowerCase();
      let year = photo.year.toString();
      if (
        info.includes(searchTerm) ||
        location.includes(searchTerm) ||
        year.includes(searchTerm)
      ) {
        this.loadablePhotos.push(photo);
      }
    }
    this.loadedPhotos = [];
    this.loadNumMorePhotos(3);
  }

  clearSearch() {
    this.searchTerm = '';
    this.sortPhotosRandomly();
  }

  loadAllPhotos(): void {
    this.photosService.getAllPhotos().valueChanges().subscribe(
      (photos: Array<Photo>) => {
        this.allPhotos = photos;
        this.sortPhotosRandomly();
        this.loadNumMorePhotos(3);
      }
    );
  }

  updatePhoto(photo: Photo): void {
    photo.isEditable = false;
    this.photosService.updatePhoto(photo);
  }

  deletePhoto(inputPhoto): void {
    for (let i = 0; i < this.allPhotos.length; i++) {
      if (this.loadedPhotos && this.loadedPhotos[i] && this.loadedPhotos[i].id && this.loadedPhotos[i].id === inputPhoto.id)
        this.loadedPhotos.splice(i, 1);
    }
    this.photosService.deletePhoto(inputPhoto);
  }
}
