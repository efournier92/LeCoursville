import { Injectable } from '@angular/core';
import { MediaService } from 'src/app/services/media.service';
import { PushIdFactory as PushIdService } from 'src/app/services/push-id.service';
import { HostingConstants } from '../constants/hosting-constants';
import { Video } from '../models/media/video';

@Injectable({ providedIn: 'root' })

export class VideoUploadService {

  constructor(
    private mediaService: MediaService,
    private pushIdService: PushIdService,
  ) { }

  upload(video: Video): void {
    if (!video.id) {
      video.id = this.pushIdService.create();
    }

    video.urls.icon = this.getIconLocation(video.fileName);
    video.urls.download = this.getDownloadLocation(video.fileName);

    this.mediaService.create(video);
  }

  private getIconLocation(fileName: string): string {
    const videoConstants = HostingConstants.Videos;
    const videoFolders = HostingConstants.Videos.folderNames;
    const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
    const encodedFileName = encodeURIComponent(fileNameWithoutExtension);

    return `${videoConstants.baseUrl}/${videoFolders.icons}/${encodedFileName}.jpg`;
  }

  private getDownloadLocation(fileName: string): string {
    const videoConstants = HostingConstants.Videos;
    const encodedFileName = encodeURIComponent(fileName);

    return `${videoConstants.baseUrl}/${encodedFileName}`;
  }
}
