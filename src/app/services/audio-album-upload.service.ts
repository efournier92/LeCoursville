import { Injectable } from '@angular/core';
import { MediaConstants } from 'src/app/constants/media-constants';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { MediaService } from 'src/app/services/media.service';
import { AudioTrack } from 'src/app/models/media/audio-track';
import { PushIdFactory as PushIdService } from 'src/app/services/push-id.service';
import { HostingConstants } from 'src/app/constants/hosting-constants';
import { Media } from 'src/app/models/media/media';

@Injectable({ providedIn: 'root' })

export class AudioAlbumUploadService {

  constructor(
    private mediaService: MediaService,
    private pushIdService: PushIdService,
  ) { }

  upload(album: AudioAlbum, folderName: string, tracksString: string): void {
    const tracksArray = this.getTracksArrayFromString(tracksString);

    album.type = MediaConstants.AUDIO_ALBUM.id;
    album.urls.download = this.getHostedZipLocation(folderName);
    album.urls.icon = this.getAlbumCoverLocation(folderName);

    const allTracks = this.createTracksFromFileNames(tracksArray, folderName, album?.urls?.icon);

    album.listing = this.uploadAudioTracks(allTracks);

    this.mediaService.create(album);
  }

  private uploadAudioTracks(tracks: Media[]) {
    const ids = new Array<string>();

    tracks.forEach((track: Media) => {
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

  private createTracksFromFileNames(fileNames: string[], folderName: string, coverUrl: string): any[] {
    const output = [];
    const albumConstants = HostingConstants.Albums;
    const albumFolders = HostingConstants.Albums.folderNames;

    for (const fileName of fileNames) {
      const track = new AudioTrack();
      if (fileName) {
        track.title = this.formatFileName(fileName);
        const fileLocation =
          `${albumConstants.baseUrl}/${albumFolders.music}/${albumFolders.albums}/${folderName}/${fileName}`
            .replace(/ /g, '+');

        track.id = this.pushIdService.create();
        track.urls.download = fileLocation;
        track.urls.icon = coverUrl;

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
