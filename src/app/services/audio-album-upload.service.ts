import { Injectable } from '@angular/core';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { MediaService } from 'src/app/services/media.service';
import { AudioTrack } from 'src/app/models/media/audio-track';
import { PushIdFactory as PushIdService } from 'src/app/services/push-id.service';
import { HostingConstants } from 'src/app/constants/hosting-constants';
import { UploadableMedia } from 'src/app/models/media/media';

@Injectable({ providedIn: 'root' })

export class AudioAlbumUploadService {

  constructor(
    private mediaService: MediaService,
    private pushIdService: PushIdService,
  ) { }

  upload(album: AudioAlbum, folderName: string, tracksString: string): void {
    album.urls.download = this.getHostedZipLocation(folderName);
    album.urls.icon = this.getAlbumCoverLocation(folderName);
    album.artist = '';

    let tracksArray: string[];
    if (!album?.id) {
      album.id = this.pushIdService.create();
      tracksArray = this.getTracksArrayFromString(tracksString);
      const allTracks = this.createTracksFromFileNames(tracksArray, folderName, album?.urls?.icon, album?.artist, album?.date);
      album.listing = this.uploadAudioTracks(allTracks);
    }

    album.dateUpdated = new Date();

    this.mediaService.create(album);
  }

  private uploadAudioTracks(tracks: UploadableMedia[]) {
    const ids = [];

    tracks.forEach((track: AudioTrack) => {
      const trackId = this.uploadAudioTrack(track);
      ids.push(trackId);
    });

    return ids;
  }

  private uploadAudioTrack(track: AudioTrack) {
    this.mediaService.create(track);

    return track.id;
  }

  private getAlbumCoverLocation(albumName: string): string {
    const albumConstants = HostingConstants.Albums;
    const albumFolders = HostingConstants.Albums.folderNames;

    albumName = this.replaceSpacesWithPluses(albumName);

    return `${albumConstants.baseUrl}/${albumFolders.music}/${albumFolders.albums}/${albumFolders.covers}/${albumName}.jpg`;
  }

  private getHostedZipLocation(albumName: string): string {
    const albumConstants = HostingConstants.Albums;
    const albumFolders = HostingConstants.Albums.folderNames;

    albumName = this.replaceSpacesWithPluses(albumName);

    return `${albumConstants.baseUrl}/${albumFolders.music}/${albumFolders.albums}/${albumFolders.zips}/${albumName}.zip`;
  }

  private replaceSpacesWithPluses(url: string): string {
    return url.replace(/ /g, '+');
  }

  private createTracksFromFileNames(fileNames: string[], folderName: string, iconUrl: string, artist: string, date: string): AudioTrack[] {
    const output = [];
    const albumConstants = HostingConstants.Albums;
    const albumFolders = HostingConstants.Albums.folderNames;

    for (const fileName of fileNames) {
      if (fileName) {
        const id = this.pushIdService.create();
        const title = this.formatFileName(fileName);
        const downloadUrl =
          `${albumConstants.baseUrl}/${albumFolders.music}/${albumFolders.albums}/${folderName}/${fileName}`
            .replace(/ /g, '+');

        const track = new AudioTrack(id, title, artist, date);
        track.urls.download = downloadUrl;
        track.urls.icon = iconUrl;

        output.push(track);
      }
    }

    return output;
  }

  private getTracksArrayFromString(tracksString: string): string[] {
    return tracksString.split('\n');
  }

  private formatFileName(name: string) {
    if (name.includes('.mp3')) {
      return name.replace('.mp3', '');
    }

    return name;
  }
}
