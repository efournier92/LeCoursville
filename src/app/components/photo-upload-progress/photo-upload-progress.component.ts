import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { Observable } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { PhotoUpload, PhotosService } from 'src/app/services/photos.service';
import { Photo } from 'src/app/models/photo';

@Component({
  selector: 'app-photo-upload-progress',
  standalone: true,
  templateUrl: './photo-upload-progress.component.html',
  styleUrls: ['./photo-upload-progress.component.scss'],
  imports: [CommonModule, MatCardModule],
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
    this.upload.onUrlAvailable.pipe(
      // onUrlAvailable is a BehaviorSubject seeded with ''; only the real
      // download URL means the upload finished.
      filter(url => !!url),
      take(1)
    ).subscribe((url: string) => {
      this.upload.photo.url = url;
      this.photo = this.upload.photo;
      this.uploadFinished = true;
      this.completeUploadEvent.emit(this.upload.photo);
    });
  }
}
