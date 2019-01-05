import { Component, OnInit } from '@angular/core';
import { AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { PhotosService } from './photos.service'
import { Photo } from './photo';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';

declare const lightGallery: any;

declare global {
  interface Window { lgData: any; }
}

@Component({
  selector: 'app-photos',
  templateUrl: './photos.component.html',
  styleUrls: ['./photos.component.scss'],
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
  photoGallery: Element;

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

  private loadedPhotosSource: BehaviorSubject<Photo[]> = new BehaviorSubject([]);
  loadedPhotosObservable: Observable<Photo[]> = this.loadedPhotosSource.asObservable();

  updateLoadedPhotos(photos: Photo[]): void {
    this.loadedPhotosSource.next(photos);
  }

  ngOnInit(): void {
    this.years = this.photosService.getYears();
    this.loadedPhotosObservable.subscribe(
      () => {
        this.updatePhotoGallery();
        console.log('subscribe');
      }
    )
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

  loadMorePhotos(numToLoad): void {
    for (let i = 0; i < numToLoad; i++) {
      this.loadAnotherPhoto();
    }
    if (this.showSpinner) {
      setTimeout(() => {
        this.showSpinner = false;
        this.updateLoadedPhotos(this.loadedPhotos);
      }, 800);
    } else {
      this.updateLoadedPhotos(this.loadedPhotos);
    }

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
    if (sortFunction === 'sortRandomly') {
      this.loadablePhotos = this.shufflePhotos(this.allPhotos);
    } else {
      this.loadablePhotos = this.allPhotos.sort(sortFunction);
    }
    this.loadedPhotos = [];
    this.loadMorePhotos(3);
  }

  sortByDateAdded(a: Photo, b: Photo) {
    return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
  }

  sortByYearTaken(a: Photo, b: Photo) {
    return new Date(a.year).getFullYear() - new Date(b.year).getFullYear();
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
    this.loadMorePhotos(3);
  }

  clearSearch() {
    this.searchTerm = '';
    this.sortPhotosBy('sortRandomly');
  }

  updatePhotoGallery() {
    const photoGallery = document.getElementById('lightgallery');
    const galleryId = photoGallery.getAttribute('lg-uid');
    if (galleryId)
      window.lgData[galleryId].destroy(true);

    const galleryOptions = {
      selector: '.light-link',
      pause: 6000,
      autoplay: false,
      progressBar: false,
    };

    if (this.loadablePhotos && this.loadablePhotos.length > 0) {
      this.photoGallery = document.getElementById('lightgallery');
      lightGallery(this.photoGallery, galleryOptions);
    }
  }

  loadAllPhotos(): void {
    this.photosService.getAllPhotos().valueChanges().subscribe(
      (photos: Array<Photo>) => {
        this.allPhotos = photos;
        this.sortPhotosBy('sortRandomly');
        this.loadMorePhotos(3);
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
