import { TestBed } from '@angular/core/testing';

import { AudioAlbumUploadService } from './audio-album-upload.service';
import { MediaService } from './media.service';
import { PushIdFactory } from './push-id.service';
import { AudioAlbum } from '../models/media/audio-album';
import { AudioTrack } from '../models/media/audio-track';

describe('AudioAlbumUploadService', () => {
  let service: AudioAlbumUploadService;
  let mediaServiceSpy: jasmine.SpyObj<MediaService>;

  beforeEach(() => {
    mediaServiceSpy = jasmine.createSpyObj('MediaService', ['create']);
    const pushIdSpy = jasmine.createSpyObj('PushIdFactory', ['create']);
    let counter = 0;
    pushIdSpy.create.and.callFake(() => `id-${++counter}`);

    TestBed.configureTestingModule({
      providers: [
        AudioAlbumUploadService,
        { provide: MediaService, useValue: mediaServiceSpy },
        { provide: PushIdFactory, useValue: pushIdSpy },
      ]
    });

    service = TestBed.inject(AudioAlbumUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('upload builds hosted URLs, creates tracks from file names and saves album + tracks', () => {
    const album = new AudioAlbum(undefined, 'Live Session', '2024');

    service.upload(album, '2024', 'song one.mp3\nsong two.mp3');

    expect(album.id).toBe('id-1');
    expect(album.artist).toBe('');
    expect(album.urls.download).toBe('https://assets.lecoursville.com/Music/Albums/Zips/2024.zip');
    expect(album.urls.icon).toBe('https://assets.lecoursville.com/Music/Albums/Covers/2024.jpg');
    expect(album.listing).toEqual(['id-2', 'id-3']);

    // Album plus one create call per track.
    expect(mediaServiceSpy.create).toHaveBeenCalledTimes(3);

    const track = mediaServiceSpy.create.mock.calls[0][0] as AudioTrack;
    expect(track.id).toBe('id-2');
    expect(track.title).toBe('song one');
    expect(track.urls.download).toBe('https://assets.lecoursville.com/Music/Albums/2024/song+one.mp3');
    expect(track.urls.icon).toBe(album.urls.icon);
  });

  it('upload skips empty lines in the track list', () => {
    const album = new AudioAlbum(undefined, 'Live Session', '2024');
    mediaServiceSpy.create.mockReset();

    service.upload(album, '2024', 'track one.mp3\n\ntrack two.mp3');

    expect(album.listing).toEqual(['id-2', 'id-3']);
    expect(mediaServiceSpy.create).toHaveBeenCalledTimes(3);
  });

  it('upload keeps an existing album id and does not re-create tracks', () => {
    const album = new AudioAlbum('album-1', 'Live Session', '2024');
    album.listing = ['existing-track'];
    mediaServiceSpy.create.mockReset();

    service.upload(album, '2024', 'track one.mp3');

    expect(album.id).toBe('album-1');
    expect(album.listing).toEqual(['existing-track']);
    expect(mediaServiceSpy.create).toHaveBeenCalledTimes(1);
  });
});
