import { TestBed } from '@angular/core/testing';

import { JsonService } from './json.service';
import { MediaService } from './media.service';
import { AudioTrack } from '../models/media/audio-track';

describe('JsonService', () => {
  let service: JsonService;
  let mediaServiceSpy: jasmine.SpyObj<MediaService>;

  beforeEach(() => {
    mediaServiceSpy = jasmine.createSpyObj('MediaService', ['create']);
    mediaServiceSpy.create.and.callFake((media: any) => media);

    TestBed.configureTestingModule({
      providers: [
        JsonService,
        { provide: MediaService, useValue: mediaServiceSpy },
      ]
    });
    service = TestBed.inject(JsonService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isValidJson', () => {
    it('accepts well-formed JSON', () => {
      const response = service.isValidJson('{"title": "Hello"}');
      expect(response.isValid).toBe(true);
    });

    it('rejects malformed JSON and reports the error', () => {
      const response = service.isValidJson('{not json');
      expect(response.isValid).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('audio track upload', () => {
    it('returns each track id without writing a media record', () => {
      const track1 = new AudioTrack('track-1', 'Song One', 'Artist');
      const track2 = new AudioTrack('track-2', 'Song Two', 'Artist');

      const ids = service.uploadAudioTracks([track1, track2]);

      expect(ids).toEqual(['track-1', 'track-2']);
      expect(mediaServiceSpy.create).not.toHaveBeenCalled();
    });

    it('orders an album listing without writing a media record', () => {
      const album: any = {
        id: 'album-1',
        title: 'Live Session',
        listing: [{ id: 'track-a', title: 'Intro' } as AudioTrack],
      };

      service.uploadAudioAlbum(album);

      expect(album.listing).toEqual(['track-a']);
      expect(mediaServiceSpy.create).not.toHaveBeenCalled();
    });
  });
});
