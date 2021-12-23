import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { MediaConstants } from 'src/app/constants/media-constants';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { JsonService } from 'src/app/services/json.service';
import { MediaService } from 'src/app/services/media.service';
import { AudioTrack } from '../models/media/audio-track';
import { PushIdFactory as PushIdService } from './push-id.service';

@Injectable({ providedIn: 'root' })

export class AudioAlbumUploadService {

  constructor(
    private jsonService: JsonService,
    private mediaService: MediaService,
    private pushIdService: PushIdService,
  ) { }

  uploadAudioAlbum(album: AudioAlbum): void {
    const apiKey = environment.googleApiKey;

    const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${album.ids.location}'+in+parents&fields=files(id,+originalFilename)&key=${apiKey}`;

    const jsonString = this.httpGet(apiUrl);

    const allInfo = JSON.parse(jsonString);

    const files = allInfo.files;

    const allFilesToUpload = [];

    for (const file of files) {
      if (!file) { continue; }

      const id = this.pushIdService.create();
      const name = this.formatFileName(file.originalFilename);
      const track = new AudioTrack(id, name, file.id);

      track.urls.location = this.getLocationUrlById(file.id);

      allFilesToUpload.push(track);
    }

    album.urls.location = this.getIconUrlById(album.ids.location);
    album.urls.icon = this.getIconUrlById(album.ids.icon);
    album.urls.download = this.getDownloadUrlById(album.ids.download);

    album.type = MediaConstants.AUDIO_ALBUM.id;
    album.listing = this.jsonService.uploadAudioTracks(allFilesToUpload);
    this.mediaService.create(album);
  }

  private httpGet(url: string) {
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.open('GET', url, false);
    xmlHttp.send(null);
    return xmlHttp.responseText;
  }

  private formatFileName(name: string) {
    if (name.includes('.mp3')) {
      return name.replace('.mp3', '');
    }

    return name;
  }

  private getLocationUrlById(id: string): string {
    if (!id) { return ''; }

    return `https://drive.google.com/uc?export=download&id=${id}`;
  }

  private getIconUrlById(id: string): string {
      if (!id) { return ''; }

      return `https://drive.google.com/uc?id=${id}`;
  }

  private getDownloadUrlById(id: string): string {
      if (!id) { return ''; }

      return `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${environment.googleApiKey}`;
  }
}
