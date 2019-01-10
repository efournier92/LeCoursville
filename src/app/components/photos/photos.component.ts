import { Component, OnInit } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { PhotosService, PhotoUpload } from './photos.service'
import { Photo } from './photo';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';
import { MatDialog, MatDialogRef } from '@angular/material';
import { ConfirmPromptComponent } from '../confirm-prompt/confirm-prompt.component';
import { ConfirmPromptService } from '../confirm-prompt/confirm-prompt.service';

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
  allPhotos: Photo[];
  loadablePhotos: Photo[] = new Array<Photo>();
  loadedPhotos: Photo[] = new Array<Photo>();
  foundPhotos: Photo[];
  searchTerm: string = '';
  years: Number[];
  showSpinner: boolean = true;
  photoGallery: Element;
  photoUploads: PhotoUpload[] = new Array<PhotoUpload>();
  sortType: string = 'random';

  constructor(
    private photosService: PhotosService,
    private auth: AuthService,
    public dialog: MatDialog,
    public confirmPrompt: ConfirmPromptService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
  }

  ngOnInit(): void {
    this.loadAllPhotos();
    this.years = this.photosService.getYears();
    this.loadedPhotosObservable.subscribe(
      () => {
        this.updatePhotoGallery();
      }
    )
  }

  downloadPhoto(photo: Photo): void {
    var request = new XMLHttpRequest();
    request.open("GET", photo.url, true);
    request.responseType = 'blob';
    request.send();
    request.onload = () => {
      const blob = new Blob([request.response], { type: 'image/jpg' });
      const photoElement = document.createElement("a");
      document.body.appendChild(photoElement);
      const url = window.URL.createObjectURL(blob);
      photoElement.href = url;
      const fileName = photo.path.replace('photos/', '')
      photoElement.download = fileName;
      photoElement.click();
      window.URL.revokeObjectURL(url);
    }
  }

  updatePhoto(photo: Photo): void {
    photo.isEditable = false;
    this.photosService.updatePhoto(photo);
  }

  deletePhoto(inputPhoto: Photo): void {
    for (let i = 0; i < this.allPhotos.length; i++) {
      if (this.loadedPhotos && this.loadedPhotos[i] && this.loadedPhotos[i].id && this.loadedPhotos[i].id === inputPhoto.id)
        this.loadedPhotos.splice(i, 1);
    }
    this.photosService.deletePhoto(inputPhoto);
    this.sortType = 'added';
    setTimeout(() => {
      this.showSpinner = false;
      this.sortPhotosBy(this.sortByDateAdded);
    }, 1000);
  }

  uploadPhotos(event: any): void {
    const filesToUpload = event.currentTarget.files;
    let message = "Do you want to upload " + filesToUpload.length + " photos to LeCoursville?";
    if (filesToUpload.length <= 1)
      message = "Do you want to upload this photo to LeCoursville?";
    const dialogRef = this.confirmPrompt.openDialog(
      "Are You Sure?",
      message,
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {

          for (let file of filesToUpload) {
            const upload = this.photosService.uploadPhoto(file);
            this.photoUploads.push(upload);
          }
          setTimeout(() => {
            this.sortPhotosBy(this.sortByDateAdded);
            this.sortType = 'added';
          }, 1500);
        }
      }
    );


  }

  completePhotoUpload(upload: PhotoUpload) {
    this.photoUploads = this.photoUploads.filter(
      (value) => {
        return value.photo.id !== upload.photo.id;
      }
    );
  }

  loadAllPhotos(): void {
    this.photosService.getAllPhotos().valueChanges().subscribe(
      (photos: Array<Photo>) => {
        this.allPhotos = photos;
        this.sortPhotosBy(this.sortRandomly);
        this.loadMorePhotos(3);
      }
    );
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
      }, 1000);
    } else {
      this.updateLoadedPhotos(this.loadedPhotos);
    }
  }

  private loadedPhotosSource: BehaviorSubject<Photo[]> = new BehaviorSubject([]);
  loadedPhotosObservable: Observable<Photo[]> = this.loadedPhotosSource.asObservable();

  updateLoadedPhotos(photos: Photo[]): void {
    this.loadedPhotosSource.next(photos);
  }

  sortPhotosBy(sortFunction: any): void {
    this.showSpinner = true;
    this.loadablePhotos = this.allPhotos.sort(sortFunction);
    this.loadedPhotos = [];
    this.loadMorePhotos(3);
  }

  sortRandomly(): number {
    var randomNumber = Math.floor(Math.random() * 21) - 10;
    return randomNumber;
  }

  sortByYearTaken(a: Photo, b: Photo): number {
    return new Date(a.year).getFullYear() - new Date(b.year).getFullYear();
  }

  sortByDateAdded(a: Photo, b: Photo): number {
    if (!a.dateAdded)
      a.dateAdded = new Date(0);
    if (!b.dateAdded)
      b.dateAdded = new Date(0);
    return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
  }

  searchPhotos(searchTerm: string): void {
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

  clearSearchTerm(): void {
    this.searchTerm = '';
    this.sortPhotosBy(this.sortRandomly);
  }

  updatePhotoGallery(): void {
    const photoGallery = document.getElementById('lightgallery');
    const galleryId = photoGallery.getAttribute('lg-uid');

    if (galleryId)
      window.lgData[galleryId].destroy(true);

    const galleryOptions = {
      selector: '.light-link',
      pause: 5000,
      download: false,
      autoplay: false,
      progressBar: false,
    };

    if (this.loadablePhotos && this.loadablePhotos.length > 0) {
      this.photoGallery = document.getElementById('lightgallery');
      lightGallery(this.photoGallery, galleryOptions);
    }
  }
}
