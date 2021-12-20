import { Component, OnInit } from '@angular/core';
import { Video } from 'src/app/models/media/video';

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
}
