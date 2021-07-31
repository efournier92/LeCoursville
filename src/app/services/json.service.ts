import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { JsonValidationResponse } from 'src/app/models/json-validation-response';
import { Doc, Media, PhotoAlbum } from 'src/app/models/media';
import { MediaService } from 'src/app/services/media.service';
import { MediaConstants } from '../constants/media-constants';
import { PushIdFactory } from './push-id.service';

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
      if (mediaFile.type === MediaConstants.VIDEO.id)
        this.uploadVideo(mediaFile);

      if (mediaFile.type === MediaConstants.DOC.id)
        this.uploadDocument(mediaFile);

      if (mediaFile.type === MediaConstants.PHOTO_ALBUM.id)
        this.uploadPhotoAlbum(mediaFile);

      if (mediaFile.type === MediaConstants.AUDIO_ALBUM.id)
        this.uploadAudioAlbum(mediaFile);

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

  uploadVideo(mediaFile: any): void {
    let video = new Media();

    video.name = mediaFile.name;
    video.location = mediaFile.location;
    video.date = mediaFile.date;
    video.duration = mediaFile.duration;
    video.fileName = mediaFile.fileName;
    video.type = mediaFile.type;

    const iconId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.icon);
    video.icon = this.createGoogleDriveSmallAssetUrl(iconId);

    video.hostingId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.url);
    video.url = this.createGoogleDriveVideoUrl(video.hostingId);

    this.mediaService.create(video);
  }

  uploadDocument(mediaFile: any): void {
    let doc = new Doc();

    doc.name = mediaFile.name;
    doc.location = mediaFile.location;
    doc.date = mediaFile.date;
    doc.duration = mediaFile.duration;
    doc.fileName = mediaFile.fileName;
    doc.type = mediaFile.type;

    const iconId = this.extractGoogleDriveAssetIdFromUrl(doc.icon);
    doc.icon = this.createGoogleDriveSmallAssetUrl(iconId);

    doc.hostingId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.url);
    doc.url = this.createGoogleDriveSmallAssetUrl(doc.hostingId);

    this.mediaService.create(doc);
  }

  uploadPhotoAlbum(mediaFile: any): void {
    let album = new PhotoAlbum();

    album.name = mediaFile.name;
    album.type = mediaFile.type;

    const iconId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.icon);
    album.icon = this.createGoogleDriveSmallAssetUrl(iconId);

    const photoIds = this.uploadPhotos(mediaFile.listing);

    album.listing = photoIds;

    this.mediaService.create(album);
  }

  uploadPhoto(mediaFile: Media) {
    let photo = new Media();

    photo.id = this.pushIdFactory.create();
    photo.date = mediaFile.date;
    photo.type = mediaFile.type;
    photo.hostingId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.url);

    const iconId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.icon);
    photo.icon = this.createGoogleDriveSmallAssetUrl(iconId);

    photo.url = this.createGoogleDriveSmallAssetUrl(iconId);

    this.mediaService.create(photo);

    return photo.id;
  }

  private uploadPhotos(photos: []) {
    let photoIds = new Array<string>();

    photos.forEach((photo: Media) => {
      const photoId = this.uploadPhoto(photo);
      photoIds.push(photoId);
    })

    return photoIds;
  }

  uploadAudioTrack(mediaFile: Media) {
    let track = new Media();

    track.id = this.pushIdFactory.create();
    track.name = mediaFile.name;
    track.type = mediaFile.type;
    track.hostingId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.url);

    const iconId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.icon);
    track.icon = this.createGoogleDriveSmallAssetUrl(iconId);

    track.hostingId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.url);
    track.url = this.createGoogleDriveSmallAssetUrl(track.hostingId);

    this.mediaService.create(track);

    return track.id;
  }

  uploadAudioTracks(tracks: []) {
    let ids = new Array<string>();

    tracks.forEach((photo: Media) => {
      const trackId = this.uploadAudioTrack(photo);
      ids.push(trackId);
    })

    return ids;
  }

  uploadAudioAlbum(mediaFile: any): void {
    let album = new PhotoAlbum();

    album.name = mediaFile.name;
    album.type = mediaFile.type;
    
    const iconId = this.extractGoogleDriveAssetIdFromUrl(mediaFile.icon);
    album.icon = this.createGoogleDriveSmallAssetUrl(iconId);

    const albumIds = this.uploadAudioTracks(mediaFile.listing);

    album.listing = albumIds;

    this.mediaService.create(album);
  }

  private extractGoogleDriveAssetIdFromUrl(url: string): string {
    return url
      .replace("https://drive.google.com/file/d/", "")
      .replace("/view?usp=sharing", "");
  }

  private createGoogleDriveSmallAssetUrl(assetId: string): string {
    return `https://drive.google.com/uc?id=${assetId}`;
  }

  private createGoogleDriveVideoUrl(assetId: string): string {
    return `https://drive.google.com/file/d/${assetId}/preview`;
  }

}
