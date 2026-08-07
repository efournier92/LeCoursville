import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MediaService } from './media.service';
import { RtdbService } from './rtdb.service';
import { AuthService } from './auth.service';
import { UploadableMedia } from 'src/app/models/media/media';
import { MediaConstants } from '../constants/media-constants';

function makeMedia(overrides: Partial<UploadableMedia> = {}): UploadableMedia {
  return {
    id: 'media-1',
    title: 'Family Reunion',
    type: MediaConstants.VIDEO.id,
    format: MediaConstants.VIDEO.format,
    urls: { download: '', icon: '' },
    listing: [],
    ...overrides,
  } as unknown as UploadableMedia;
}

describe('MediaService', () => {
  let service: MediaService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  const allMedia: UploadableMedia[] = [
    makeMedia({ id: 'media-1', title: 'Family Reunion' }),
    makeMedia({ id: 'media-2', title: 'Grandma Birthday', type: MediaConstants.DOC.id }),
    makeMedia({ id: 'media-3', title: 'The Beach Trip', type: MediaConstants.AUDIO_ALBUM.id }),
  ];

  beforeEach(() => {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => of(allMedia) });
    rtdbSpy.createPushId.and.returnValue('new-media-id');
    rtdbSpy.object.and.returnValue({
      valueChanges: () => of(null),
      update: jasmine.createSpy('update'),
      remove: jasmine.createSpy('remove'),
    });

    TestBed.configureTestingModule({
      providers: [
        MediaService,
        { provide: RtdbService, useValue: rtdbSpy },
        { provide: AuthService, useValue: { userObservable: of({ id: 'u1' }) } },
      ]
    });

    service = TestBed.inject(MediaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads media into allMedia on init', () => {
    expect(service.allMedia?.length).toBe(3);
  });

  it('getMediaById finds media from the loaded list', () => {
    expect(service.getMediaById('media-2')?.title).toBe('Grandma Birthday');
  });

  it('getMediaById returns undefined for unknown ids', () => {
    expect(service.getMediaById('nope')).toBeUndefined();
  });

  it('filterByQuery matches titles case-insensitively', () => {
    expect(service.filterByQuery('family', allMedia).map(m => m.id)).toEqual(['media-1']);
    expect(service.filterByQuery('GRANDMA', allMedia).map(m => m.id)).toEqual(['media-2']);
  });

  it('filterByQuery returns everything for an empty query', () => {
    expect(service.filterByQuery('', allMedia).length).toBe(3);
  });

  it('filterByTypes keeps only selected types and drops hidden types', () => {
    const result = service.filterByTypes([MediaConstants.VIDEO.id], allMedia);
    expect(result.map(m => m.id)).toEqual(['media-1']);
  });

  it('loadMoreMedia loads up to the requested number without duplicates', () => {
    const loaded = service.loadMoreMedia(2, allMedia, []);
    expect(loaded.map(m => m.id)).toEqual(['media-1', 'media-2']);

    const more = service.loadMoreMedia(10, allMedia, loaded);
    expect(more.map(m => m.id)).toEqual(['media-1', 'media-2', 'media-3']);
  });

  it('tryLoadingFirstBatch loads everything on the first batch', () => {
    const loaded = service.tryLoadingFirstBatch(allMedia, []);
    expect(loaded.length).toBe(3);
  });

  it('create assigns a push id when missing and writes through RTDB', () => {
    const media = makeMedia({ id: '' });
    service.create(media);
    expect(media.id).toBe('new-media-id');
    expect(rtdbSpy.object).toHaveBeenCalledWith('media/new-media-id');
    expect(rtdbSpy.object('media/new-media-id').update).toHaveBeenCalledWith(media);
  });

  it('deleteMedia removes listing children and the media record', () => {
    const media = makeMedia({ id: 'media-1', listing: ['child-1', 'child-2'] });
    service.deleteMedia(media);
    expect(rtdbSpy.object).toHaveBeenCalledWith('media/child-1');
    expect(rtdbSpy.object).toHaveBeenCalledWith('media/child-2');
    expect(rtdbSpy.object).toHaveBeenCalledWith('media/media-1');
    expect(rtdbSpy.object('media/media-1').remove).toHaveBeenCalled();
  });
});
