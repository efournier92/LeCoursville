import { Component, OnInit } from '@angular/core';
import { Video } from 'src/app/models/media';

@Component({
  selector: 'app-video-upload-dialog',
  templateUrl: './video-upload-dialog.component.html',
  styleUrls: ['./video-upload-dialog.component.scss']
})
export class VideoUploadDialogComponent implements OnInit {
  videoToUpload: Video;

  constructor() { }

  ngOnInit(): void {
    this.videoToUpload = new Video();
  }

  // uploadPhotos(filesToUpload: any): void {
  //   this.videoToUpload
  //   for (let file of filesToUpload) {
  //     const upload = this.photosService.uploadPhoto(file, false);
  //     this.photoUploads.push(upload);
  //   }
  // }
}
