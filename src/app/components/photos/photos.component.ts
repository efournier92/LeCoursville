import { Component, OnInit } from '@angular/core';
import { AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { PhotosService } from './photos.service'
import { Photo } from './photo';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user';
import lightGallery from '../lightgallery.js';
import $ from 'jquery';

declare var lightGallery: any;

declare global {
  interface Window { lgData: any; }
}

const options = {
  // mode: 'fade',  // Type of transition between images. Either 'slide' or 'fade'.
  // useCSS: true,     // Whether to always use jQuery animation for transitions or as a fallback.
  // cssEasing: 'ease',   // Value for CSS "transition-timing-function".
  // easing: 'linear', //'for jquery animation',//
  speed: 600,      // Transition duration (in ms).
  // addClass: '',       // Add custom class for gallery.

  // preload: 1,    //number of preload slides. will exicute only after the current slide is fully loaded. ex:// you clicked on 4th image and if preload = 1 then 3rd slide and 5th slide will be loaded in the background after the 4th slide is fully loaded.. if preload is 2 then 2nd 3rd 5th 6th slides will be preloaded.. ... ...
  showAfterLoad: true,  // Show Content once it is fully loaded.
  selector: '.light-link',  // Custom selector property insted of just child.
  // index: false, // Allows to set which image/video should load when using dynamicEl.

  // dynamic: false, // Set to true to build a gallery based on the data from "dynamicEl" opt.
  // dynamicEl: [],    // Array of objects (src, thumb, caption, desc, mobileSrc) for gallery els.

  // thumbnail: true,     // Whether to display a button to show thumbnails.
  // showThumbByDefault: false,    // Whether to display thumbnails by default..
  // exThumbImage: false,    // Name of a "data-" attribute containing the paths to thumbnails.
  // animateThumb: true,     // Enable thumbnail animation.
  // currentPagerPosition: 'middle', // Position of selected thumbnail.
  // thumbWidth: 100,      // Width of each thumbnails
  // thumbMargin: 5,        // Spacing between each thumbnails 

  controls: true,  // Whether to display prev/next buttons.
  hideControlOnEnd: false, // If true, prev/next button will be hidden on first/last image.
  loop: true, // Allows to go to the other end of the gallery at first/last img.
  auto: true, // Enables slideshow mode.
  pause: 4000,  // Delay (in ms) between transitions in slideshow mode.
  escKey: true,  // Whether lightGallery should be closed when user presses "Esc".
  closable: true,  //allows clicks on dimmer to close gallery

  counter: true, // Shows total number of images and index number of current image.
  // lang: { allPhotos: 'All photos' }, // Text of labels.

  // mobileSrc: false, // If "data-responsive-src" attr. should be used for mobiles.
  // mobileSrcMaxWidth: 640,   // Max screen resolution for alternative images to be loaded for.
  // swipeThreshold: 50,    // How far user must swipe for the next/prev image (in px).
  enableTouch: true,  // Enables touch support
  enableDrag: true,  // Enables desktop mouse drag support

  // vimeoColor: 'CCCCCC', // Vimeo video player theme color (hex color code).
  // youtubePlayerParams: false, // See: https://developers.google.com/youtube/player_parameters
  // videoAutoplay: true,     // Set to false to disable video autoplay option.
  // videoMaxWidth: '855px',  // Limits video maximal width (in px).

  // Callbacks el = current plugin object
  onOpen: function (el) { }, // Executes immediately after the gallery is loaded.
  onSlideBefore: function (el) { }, // Executes immediately before each transition.
  onSlideAfter: function (el) { }, // Executes immediately after each transition.
  onSlideNext: function (el) { }, // Executes immediately before each "Next" transition.
  onSlidePrev: function (el) { }, // Executes immediately before each "Prev" transition.
  onBeforeClose: function (el) { }, // Executes immediately before the start of the close process.
  onCloseAfter: function (el) { }, // Executes immediately once lightGallery is closed.

};

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
  photoGallery: Element;

  constructor(
    private photosService: PhotosService,
    private auth: AuthService,
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
        this.updatePhotoGallery();
      }
    )
    this.loadAllPhotos();
  }

  ngOnInit(): void {
    this.years = this.photosService.getYears();
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
    setTimeout(() => {
      this.showSpinner = false;
    }, 1000);
    this.updatePhotoGallery();
  }

  sortPhotosRandomly() {
    this.showSpinner = true;
    this.loadedPhotos = [];
    this.loadablePhotos = this.shufflePhotos(this.allPhotos);
    this.loadMorePhotos(3);
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
    this.loadMorePhotos(3);
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
    this.loadMorePhotos(3);
  }

  clearSearch() {
    this.searchTerm = '';
    this.sortPhotosRandomly();
  }

  destroyPhotoGallery() {
    let at = this.photoGallery.getAttribute('lg-uid')
    window.lgData[at].destroy(true);
  }

  updatePhotoGallery() {
    if (this.photoGallery) {
      this.destroyPhotoGallery();
      this.photoGallery = null;
    }

    this.photoGallery = document.getElementById('lightgallery');
    lightGallery(this.photoGallery, options);

    // if (this.photoGallery)
    //   this.photoGallery.data('lightGallery').destroy(true);
    // this.photoGallery = $("#lightgallery");
    // var gallery = $("#lightgallery").lightGallery({})

  }

  loadAllPhotos(): void {
    this.photosService.getAllPhotos().valueChanges().subscribe(
      (photos: Array<Photo>) => {
        this.allPhotos = photos;
        this.sortPhotosRandomly();
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
