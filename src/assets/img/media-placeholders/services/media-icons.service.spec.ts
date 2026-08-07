import { TestBed } from '@angular/core/testing';

import { MediaIconsService } from './media-icons.service';
import { MediaConstants } from 'src/app/constants/media-constants';

describe('MediaIconsService', () => {
  let service: MediaIconsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaIconsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('maps each media type to its placeholder icon name', () => {
    expect(service.getPlaceholderNameByMediaType(MediaConstants.VIDEO.id)).toBe('movie');
    expect(service.getPlaceholderNameByMediaType(MediaConstants.DOC.id)).toBe('picture_as_pdf');
    expect(service.getPlaceholderNameByMediaType(MediaConstants.PHOTO_ALBUM.id)).toBe('photo_album');
    expect(service.getPlaceholderNameByMediaType(MediaConstants.PHOTO.id)).toBe('photo');
    expect(service.getPlaceholderNameByMediaType(MediaConstants.AUDIO_ALBUM.id)).toBe('album');
    expect(service.getPlaceholderNameByMediaType(MediaConstants.AUDIO_TRACK.id)).toBe('audiotrack');
  });

  it('falls back to a generic icon for unknown media types', () => {
    expect(service.getPlaceholderNameByMediaType('unknown')).toBe('perm_media');
  });
});
