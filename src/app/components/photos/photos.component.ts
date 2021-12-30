import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, BehaviorSubject } from 'rxjs';
import { PhotosService, PhotoUpload } from 'src/app/services/photos.service';
import { Photo } from 'src/app/models/photo';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { ConfirmPromptService } from 'src/app/services/confirm-prompt.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

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
  allPhotos: Photo[] = [];
  loadablePhotos: Photo[] = [];
  loadedPhotos: Photo[] = [];
  foundPhotos: Photo[];
  searchTerm = '';
  years: number[];
  showSpinner = true;
  photoGallery: Element;
  photoUploads: PhotoUpload[] = [];
  sortType = 'random';

  private loadedPhotosSource: BehaviorSubject<Photo[]> = new BehaviorSubject([]);
  loadedPhotosObservable: Observable<Photo[]> = this.loadedPhotosSource.asObservable();

  constructor(
    private photosService: PhotosService,
    private authService: AuthService,
    public dialog: MatDialog,
    public confirmPrompt: ConfirmPromptService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.subscribeToPhotosObservable();
    this.loadAllPhotos();
    this.years = this.photosService.getYears();
    this.analyticsService.logEvent('component_load_photos', { });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable() {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private subscribeToPhotosObservable() {
    this.loadedPhotosObservable.subscribe(
      () => this.updatePhotoGallery()
    );
  }

  // PUBLIC METHODS

  downloadPhoto(photoToDownload: Photo): void {
    const request = new XMLHttpRequest();
    request.open('GET', photoToDownload.url, true);
    request.responseType = 'blob';
    request.send();
    request.onload = () => {
      const blob = new Blob([request.response], { type: 'image/jpg' });
      const photoElement = document.createElement('a');
      document.body.appendChild(photoElement);
      const url = window.URL.createObjectURL(blob);
      photoElement.href = url;
      const fileName = photoToDownload.path.replace('photos/', '');
      photoElement.download = fileName;
      photoElement.click();
      window.URL.revokeObjectURL(url);
    };
    this.analyticsService.logEvent('photos_download', { photo: photoToDownload, user: this.user.id });
  }

  updatePhoto(photoToUpdate: Photo): void {
    photoToUpdate.isEditable = false;
    this.photosService.updatePhoto(photoToUpdate);
    this.analyticsService.logEvent('photos_update', { photo: photoToUpdate, user: this.user.id });
  }

  deletePhoto(photoToDelete: Photo): void {
    const message = 'Do you want to delete this photo from LeCoursville?';
    const dialogRef = this.confirmPrompt.openDialog(
      'Are You Sure?',
      message,
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          for (let i = 0; i < this.allPhotos.length; i++) {
            if (this.loadedPhotos && this.loadedPhotos[i] && this.loadedPhotos[i].id && this.loadedPhotos[i].id === photoToDelete.id) {
              this.loadedPhotos.splice(i, 1);
            }
          }
          this.photosService.deletePhoto(photoToDelete);
          this.sortType = 'added';
          setTimeout(() => {
            this.showSpinner = false;
            this.sortPhotosBy(this.sortByDateAdded);
          }, 1000);
        }
      }
    );
    this.analyticsService.logEvent('photos_delete', { photo: photoToDelete, user: this.user.id });
  }

  uploadPhotos(photosToUpload: any): void {
    let message = `Do you want to upload ${photosToUpload.length} photos to LeCoursville?`;
    if (photosToUpload.length <= 1) {
      message = 'Do you want to upload this photo to LeCoursville?';
    }
    const dialogRef = this.confirmPrompt.openDialog(
      'Are You Sure?',
      message,
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          for (const photo of photosToUpload) {
            const upload = this.photosService.uploadPhoto(photo, false);
            this.photoUploads.push(upload);
          }
          setTimeout(() => {
            this.sortPhotosBy(this.sortByDateAdded);
            this.sortType = 'added';
          }, 1500);
        }
      }
    );
    this.analyticsService.logEvent('photos_upload', { photos: photosToUpload, user: this.user.id });
  }

  completePhotoUpload(upload: PhotoUpload): void {
    this.photoUploads = this.photoUploads.filter(
      (value) => {
        return value.photo.id !== upload.photo.id;
      }
    );
  }

  loadMorePhotos(numberToLoad: number): void {
    for (let i = 0; i < numberToLoad; i++) {
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

  sortPhotosBy(sortFunction: any): void {
    this.showSpinner = true;
    this.loadablePhotos = this.allPhotos.sort(sortFunction);
    this.loadedPhotos = [];
    this.loadMorePhotos(3);
    this.analyticsService.logEvent('photos_sort', { function: sortFunction, user: this.user.id });
  }

  sortRandomly(): number {
    const randomNumber = Math.floor(Math.random() * 21) - 10;

    return randomNumber;
  }

  sortByYearTaken(a: Photo, b: Photo): number {
    return new Date(a.year).getFullYear() - new Date(b.year).getFullYear();
  }

  sortByDateAdded(a: Photo, b: Photo): number {
    if (!a.dateAdded) {
      a.dateAdded = new Date(0);
    }
    if (!b.dateAdded) {
      b.dateAdded = new Date(0);
    }
    return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
  }

  searchPhotos(query: string): void {
    this.showSpinner = true;
    this.loadablePhotos = [];
    query = query.toLowerCase();
    for (const photo of this.allPhotos) {
      const info = photo.info.toLowerCase();
      const location = photo.location.toLowerCase();
      const year = photo.year.toString();
      let photoBy = '';
      if (photo.takenBy) {
        photoBy = photo.takenBy.toLowerCase();
      }
      if (
        info.includes(query) ||
        location.includes(query) ||
        year.includes(query) ||
        photoBy.includes(query)
      ) {
        this.loadablePhotos.push(photo);
      }
    }
    this.loadedPhotos = [];
    this.loadMorePhotos(3);
    this.analyticsService.logEvent('photos_query_search', { searchQuery: query, user: this.user.id });
  }

  clearSearchTerm(): void {
    this.searchTerm = '';
    this.sortPhotosBy(this.sortRandomly);
    this.analyticsService.logEvent('photos_query_clear', { user: this.user.id });
  }

  // HELPER METHODS

  private shouldRefreshPhotos(photos): boolean {
    return photos
      && photos.length
      && photos.length !== 0
      && photos.length !== this.allPhotos.length;
  }

  private loadAllPhotos(): void {
    this.photosService.getAllPhotos().valueChanges().subscribe(
      (photos: Photo[]) => {
        if (this.shouldRefreshPhotos(photos)) {
          this.allPhotos = photos;
          this.sortPhotosBy(this.sortRandomly);
          this.loadMorePhotos(3);
        }
      }
    );
  }

  private loadAnotherPhoto(): void {
    const newPhoto = this.loadablePhotos[this.loadedPhotos.length];
    if (this.shouldLoadAnotherPhoto(newPhoto)) {
      this.loadedPhotos.push(newPhoto);
    }
  }

  private shouldLoadAnotherPhoto(newPhoto: Photo): boolean {
    return this.loadablePhotos
      && this.loadablePhotos.length
      && this.loadedPhotos.length < this.loadablePhotos.length
      && !this.loadedPhotos.some(photo => photo.id === newPhoto.id);
  }

  private updateLoadedPhotos(photos: Photo[]): void {
    this.loadedPhotosSource.next(photos);
  }

  private updatePhotoGallery(): void {
    const photoGallery = document.getElementById('lightgallery');
    const galleryId = photoGallery.getAttribute('lg-uid');

    if (galleryId) {
      window.lgData[galleryId].destroy(true);
    }

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
