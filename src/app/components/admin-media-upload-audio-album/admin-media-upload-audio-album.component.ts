import { Component, OnInit } from '@angular/core';
import { AudioAlbum } from 'src/app/models/media/audio-album';
import { User } from 'src/app/models/user';
import { AudioAlbumUploadService } from 'src/app/services/audio-album-upload.service';
import { AuthService } from 'src/app/services/auth.service';
import { MediaService } from 'src/app/services/media.service';
import { UploadableMedia } from 'src/app/models/media/media';
import { MediaConstants } from 'src/app/constants/media-constants';

@Component({
  selector: 'app-admin-media-upload-audio-album',
  templateUrl: './admin-media-upload-audio-album.component.html',
  styleUrls: ['./admin-media-upload-audio-album.component.scss']
})
export class AdminMediaUploadAudioAlbumComponent implements OnInit {
  album: AudioAlbum = new AudioAlbum();
  user: User;
  folderName: string;
  tracksString: string;

  constructor(
    private authService: AuthService,
    private mediaService: MediaService,
    private audioAlbumUploadService: AudioAlbumUploadService,
  ) { }

  // LIFECYCLE EVENTS

  ngOnInit(): void {
    this.album = new AudioAlbum();
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  isUserAdmin(): boolean {
    return this.user?.roles?.admin;
  }

  onMediaSelect(album: AudioAlbum): void {
    console.log(`Selected Album: `, album);
    this.album = album;
  }

  onUploadSelectedMedia(): void {
    if (!this.isAlbumInputValid()) { return; }

    this.audioAlbumUploadService.upload(this.album, this.album.folderName, this.tracksString);

    this.resetSelectedMedia();
  }

  onDeleteSelectedMedia(media: UploadableMedia  ): void {
    this.mediaService.deleteMedia(media);
    this.resetSelectedMedia();
  }

  onCancelSelectedMedia(): void {
    this.resetSelectedMedia();
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

  // HELPER METHODS

  private isAlbumInputValid(): boolean {
    return (!!this.album.title && !!this.album.folderName);
  }

  private resetSelectedMedia(): void {
    this.album = new AudioAlbum();
    this.album.folderName = '';
    this.tracksString = '';
  }
}
