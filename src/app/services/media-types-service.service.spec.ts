import { TestBed } from '@angular/core/testing';

import { MediaTypesService } from './media-types-service.service';
import { MediaConstants, MediaType } from '../constants/media-constants';

describe('MediaTypesService', () => {
  let service: MediaTypesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaTypesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAllTypes returns the id of every media type', () => {
    expect(service.getAllTypes()).toEqual([
      'video',
      'document',
      'photo',
      'audio-track',
      'photo-album',
      'audio-album',
    ]);
  });

  it('getVisibleTypes excludes types hidden by default', () => {
    const visible = service.getVisibleTypes();
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every(t => !t.isHiddenByDefault)).toBe(true);
  });

  it('getHiddenTypeIds returns only hidden types', () => {
    const hidden = service.getHiddenTypeIds();
    expect(hidden).toContain('photo');
    expect(hidden).toContain('audio-track');
    expect(hidden).not.toContain('video');
  });

  it('getSelectedTypes returns ids of selected types only', () => {
    const types: MediaType[] = [
      new MediaType('video', 'Video', 'video/mp4', false),
      new MediaType('document', 'Document', 'document/pdf', false),
    ];
    types[0].isSelected = true;
    expect(service.getSelectedTypes(types)).toEqual(['video']);
  });
});
