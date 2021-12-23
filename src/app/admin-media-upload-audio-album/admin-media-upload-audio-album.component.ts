import { Component, OnInit } from '@angular/core';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { User } from 'src/app/models/user';
import { AudioAlbumUploadService } from 'src/app/services/audio-album-upload.service';
import { AuthService } from 'src/app/services/auth.service';
import { MediaService } from 'src/app/services/media.service';
import { Media } from 'src/app/models/media/media';
import { MediaConstants } from '../constants/media-constants';

@Component({
  selector: 'app-admin-media-upload-audio-album',
  templateUrl: './admin-media-upload-audio-album.component.html',
  styleUrls: ['./admin-media-upload-audio-album.component.scss']
})
export class AdminMediaUploadAudioAlbumComponent implements OnInit {
  album: AudioAlbum = new AudioAlbum();
  user: User;

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private audioAlbumUploadService: AudioAlbumUploadService,
  ) { }

  ngOnInit(): void {
    this.album = new AudioAlbum();
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  isUserAdmin(): boolean {
    return this.user?.roles?.admin;
  }

  onMediaSelect(album: AudioAlbum): void {
    console.log(`Selected Album: `, album);
    this.album = album;
  }

  onUploadSelectedMedia(): void {
    this.audioAlbumUploadService.uploadAudioAlbum(this.album);
    this.resetSelectedMedia();
  }

  onDeleteSelectedMedia(media: Media): void {
    this.mediaService.deleteMedia(media);
    this.resetSelectedMedia();
  }

  onCancelSelectedMedia(): void {
    this.resetSelectedMedia();
  }

  private resetSelectedMedia(): void {
    this.album = new AudioAlbum();
  }

  inputClearedEvent(): void {
    console.log('Input cleared');
  }

  inputFileChangeEvent($event: any): void {
    console.log('File changed: ', $event);
  }

  getAudioAlbumTypeId(): string {
    return MediaConstants.AUDIO_ALBUM.id;
  }
}
