import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { PhotoUpload, PhotosService } from '../photos.service';
import { Photo } from '../photo';

@Component({
  selector: 'app-photo-upload-progress',
  templateUrl: './photo-upload-progress.component.html',
  styleUrls: ['./photo-upload-progress.component.scss']
})
export class PhotoUploadProgressComponent implements OnInit {
  @Input()
  upload: PhotoUpload;
  uploadFinished: boolean = false;
  photo: Photo;
  uploadProgress: Observable<number>;
  @Output()
  completeUploadEvent = new EventEmitter<Photo>();

  constructor(
    private photosService: PhotosService,
  ) { }

  ngOnInit() {
    this.uploadProgress = this.upload.task.percentageChanges();
    this.photo = this.upload.photo;
    this.upload.task.percentageChanges().subscribe(
      (percentComplete: number) => {
        if (percentComplete === 100) {
          this.uploadFinished = true;
          this.photosService.getPhotoById(this.photo.id).subscribe(
            (photo: Photo) => {
              this.photo = photo;
              setTimeout(() => {
                if (!this.photo.url) return;
                this.completeUploadEvent.emit(this.photo);
              }, 10000);
            }
          );
        }
      }
    )
  }
}
