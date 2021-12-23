import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { PhotoUpload, PhotosService } from 'src/app/services/photos.service';
import { Photo } from 'src/app/models/photo';

@Component({
  selector: 'app-photo-upload-progress',
  templateUrl: './photo-upload-progress.component.html',
  styleUrls: ['./photo-upload-progress.component.scss']
})
export class PhotoUploadProgressComponent implements OnInit {
  @Input() upload: PhotoUpload;

  @Output() completeUploadEvent = new EventEmitter<Photo>();

  uploadFinished = false;
  photo: Photo;
  uploadProgress: Observable<number>;

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
                if (!this.photo.url) { return; }
                this.completeUploadEvent.emit(this.photo);
              }, 7000);
            }
          );
        }
      }
    );
  }
}
