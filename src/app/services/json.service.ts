import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { JsonValidationResponse } from 'src/app/models/json-validation-response';
import { Media } from 'src/app/models/media/media';
import { Video } from 'src/app/models/media/video';
import { PhotoAlbum } from 'src/app/models/media/photo-album';
import { Doc } from 'src/app/models/media/doc';
import { MediaService } from 'src/app/services/media.service';
import { MediaConstants } from '../constants/media-constants';
import { PushIdFactory } from './push-id.service';
import { AudioAlbum } from '../models/media/audio-album';
import { AudioTrack } from '../models/media/audio-track';

@Injectable({
  providedIn: 'root'
})
export class JsonService {

  constructor(
    private mediaService: MediaService,
    private pushIdFactory: PushIdFactory,
  ) { }

  isValidJson(input: string): JsonValidationResponse {
    let response = new JsonValidationResponse();

    try {
      JSON.parse(input);
    } catch (err) {
      response.isValid = false;
      response.error = err;
      return response;
    }

    response.isValid = true;
    return response;
  }

  successMessages: string[] = [];
  private successMessagesSource: BehaviorSubject<string[]> = new BehaviorSubject([]);
  successMessagesObservable: Observable<string[]> = this.successMessagesSource.asObservable();

  bulkUploadMediaFromJson(mediaArray: any[]): void {
    mediaArray.forEach(mediaFile => {
      if (mediaFile.type === MediaConstants.VIDEO.id) {
        this.uploadVideo(mediaFile);
      } else if (mediaFile.type === MediaConstants.DOC.id) {
        this.uploadDoc(mediaFile);
      } else if (mediaFile.type === MediaConstants.PHOTO_ALBUM.id) {
        this.uploadPhotoAlbum(mediaFile);
      } else if (mediaFile.type === MediaConstants.AUDIO_ALBUM.id) {
        this.uploadAudioAlbum(mediaFile);
      }

      const successMessage = this.buildSuccessfulUploadMessage(mediaFile);
      this.addSuccessMessage(successMessage);
    });
  }

  private buildSuccessfulUploadMessage(mediaFile: Media): string {
    return `Successfully uploaded ${mediaFile.name}`;
  }

  private addSuccessMessage(message: string): void {
    this.successMessages.push(message);
    this.successMessagesSource.next(this.successMessages);
  } 

  private constructMediaObject(mediaFile: Media, newMedia: Media) {
    // newMedia.id = this.pushIdFactory.create();
    // newMedia.name = mediaFile.name || "";
    // newMedia.date = mediaFile.date || "";
    // newMedia.fileName = mediaFile.fileName || "";
    // newMedia.type = mediaFile.type || "";
    // newMedia.location.id = mediaFile.location.id || "";

    // newMedia.ids.location = this.getIconUrl(mediaFile);
    // newMedia.location.id = this.extractDriveAssetIdFromUrl(mediaFile.url);
    // newMedia.url = this.createDrivePhotoUrl(newMedia.location.id);

    // return newMedia;
  }

  uploadVideo(mediaFile: any): void {
    // let video = this.constructMediaObject(mediaFile, new Video());

    // video.url = this.createDriveVideoUrl(video.location.id);

    // this.mediaService.create(video);
  }

  uploadDoc(mediaFile: any): void {
    // let doc = this.constructMediaObject(mediaFile, new Doc());

    // doc.url = this.createDriveDocUrl(doc.location.id);

    // this.mediaService.create(doc);
  }

  uploadPhotoAlbum(mediaFile: any): void {
    // let album = this.constructMediaObject(mediaFile, new Doc());

    // album.listing = this.uploadPhotos(mediaFile.listing);

    // this.mediaService.create(album);
  }

  uploadPhoto(mediaFile: Media) {
    // const photo = this.constructMediaObject(mediaFile, new Media());

    // this.mediaService.create(photo);

    // return photo.id;
  }

  private uploadPhotos(photos: []) {
    // let photoIds = new Array<string>();

    // photos.forEach((photo: Media) => {
    //   const photoId = this.uploadPhoto(photo);
    //   photoIds.push(photoId);
    // })

    // return photoIds;
  }

  uploadAudioTrack(track: AudioTrack) {
    // const track = new Media();

    this.mediaService.create(track);

    return track.id;
  }

  uploadAudioTracks(tracks: Media[]) {
    let ids = new Array<string>();

    tracks.forEach((track: Media) => {
      const trackId = this.uploadAudioTrack(track);
      ids.push(trackId);
    })

    return ids;
  }

  uploadAudioAlbum(album: AudioAlbum): void {
    // let album = this.constructMediaObject(mediaFile, new AudioAlbum());

    album.listing = this.uploadAudioTracks(album.listing);

    this.mediaService.create(album);
  }

  private getIconUrl(mediaFile: Media): string {
    if (!mediaFile.ids.location)
      return "";

    const ids = this.extractDriveAssetIdFromUrl(mediaFile.ids.location)

    return mediaFile?.ids.location?.includes("drive.google.com") && !mediaFile?.ids.location?.includes("http")
      ? this.createDrivePhotoUrl(ids)
      : mediaFile.ids.location;
  }

  private extractDriveAssetIdFromUrl(url: string): string {
    if (!url?.includes("drive.google.com"))
      return url || "";

    return url
      .replace("https://drive.google.com/file/d/", "")
      .replace("/view?usp=sharing", "");
  }

  private createDrivePhotoUrl(assetId: string): string {
    return `https://drive.google.com/uc?id=${assetId}`;
  }

  private createDriveVideoUrl(assetId: string): string {
    return `https://drive.google.com/file/d/${assetId}/preview`;
  }

  private createDriveDocUrl(assetId: string): string {
    return `https://drive.google.com/uc?id=${assetId}&export=download`;
  }

}
