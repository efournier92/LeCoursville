import { Injectable } from '@angular/core';
import { JsonValidationResponse } from 'src/app/models/json-validation-response';
import { Doc, Media, PhotoAlbum } from 'src/app/models/media';
import { MediaService } from 'src/app/services/media.service';
import { environment } from 'src/environments/environment';
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

  bulkUploadMediaFromJson(mediaArray: Array<any>): void {
    mediaArray.forEach(mediaFile => {
      if (mediaFile.type === MediaConstants.TYPES.VIDEO)
        this.uploadVideo(mediaFile);

      if (mediaFile.type === MediaConstants.TYPES.DOCUMENT)
        this.uploadDocument(mediaFile);

      if (mediaFile.type === MediaConstants.TYPES.PHOTO_ALBUM)
        this.uploadPhotoAlbum(mediaFile);

      if (mediaFile.type === MediaConstants.TYPES.AUDIO_ALBUM)
        this.uploadAudioAlbum(mediaFile);
    });
  }

  uploadVideo(mediaFile: any): void {
    let video = new Media();

    video.name = mediaFile.name;
    video.url = mediaFile.url;
    video.icon = mediaFile.icon;
    video.location = mediaFile.location;
    video.date = mediaFile.date;
    video.duration = mediaFile.duration;
    video.fileName = mediaFile.fileName;
    video.type = mediaFile.type;

    video = this.updateGoogleDriveUrlFormat(video);

    this.mediaService.create(video);
  }

  uploadDocument(mediaFile: any): void {
    let doc = new Doc();

    doc.name = mediaFile.name;
    doc.url = mediaFile.url;
    doc.icon = mediaFile.icon;
    doc.location = mediaFile.location;
    doc.date = mediaFile.date;
    doc.duration = mediaFile.duration;
    doc.fileName = mediaFile.fileName;
    doc.type = mediaFile.type;

    doc = this.updateGoogleDriveUrlFormat(doc);

    this.mediaService.create(doc);
  }

  uploadPhotoAlbum(mediaFile: any): void {
    let album = new PhotoAlbum();

    album.name = mediaFile.name;
    album.icon = mediaFile.icon;
    album.type = mediaFile.type;

    const photoIds = this.uploadPhotos(mediaFile.listing);

    album.listing = photoIds;

    album = this.updateGoogleDriveUrlFormat(album);

    this.mediaService.create(album);
  }

  uploadPhoto(mediaFile: Media) {
    let photo = new Media();

    photo.url = mediaFile.url;
    photo.date = mediaFile.date;
    photo.type = mediaFile.type;
    photo.id = this.pushIdFactory.create();

    photo = this.updateGoogleDriveUrlFormat(photo);

    this.mediaService.create(photo);

    return photo.id;
  }

  uploadPhotos(photos: []) {
    let photoIds = new Array<string>();

    photos.forEach((photo: Media) => {
      const photoId = this.uploadPhoto(photo);
      photoIds.push(photoId);
    })

    return photoIds;
  }


  uploadAudioTrack(mediaFile: Media) {
    let track = new Media();

    track.url = mediaFile.url;
    track.name = mediaFile.name;
    track.type = mediaFile.type;
    track.id = this.pushIdFactory.create();

    track = this.updateGoogleDriveUrlFormat(track);

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
    album.icon = mediaFile.icon;
    album.type = mediaFile.type;

    const albumIds = this.uploadAudioTracks(mediaFile.listing);

    album.listing = albumIds;

    album = this.updateGoogleDriveUrlFormat(album);

    this.mediaService.create(album);
  }

  private updateGoogleDriveUrlFormat(video: Media): Media {
    Object.keys(video).forEach(key => {
      const value = video[key];
      if (value && value.includes && value.includes("https://drive.google.com/file/d/")) {
        let id = value.replace("https://drive.google.com/file/d/", "").replace("/view?usp=sharing", "")
        let newUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${environment.googleApiKey}`;
        video[key] = newUrl;
      }
    });

    return video;
  }

}
