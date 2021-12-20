import { TestBed } from '@angular/core/testing';

import { AudioAlbumUploadService } from './audio-album-upload.service';

describe('AudioAlbumUploadService', () => {
  let service: AudioAlbumUploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioAlbumUploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
