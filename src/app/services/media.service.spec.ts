import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MediaService } from './media.service';
import { UploadableMedia } from 'src/app/models/media/media';
import { AuthService } from './auth.service';
import { MediaTypesService } from './media-types-service.service';
import { RtdbService } from './rtdb.service';

function makeMedia(id: string, overrides: Partial<UploadableMedia> = {}): UploadableMedia {
  return {
    id,
    title: 'Title',
    artist: 'Artist',
    date: '',
    folderName: '',
    fileName: '',
    isSticky: false,
    isHidden: false,
    listing: [],
    urls: { download: '', icon: '' },
    type: 'video',
    format: '',
    dateUpdated: new Date(),
    ...overrides,
  };
}

describe('MediaService', () => {
  let service: MediaService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let hiddenTypes: string[];

  beforeEach(() => {
    hiddenTypes = [];
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => of([]) });
    rtdbSpy.object.and.callFake((path: string) => ({
      valueChanges: () => of(null),
      update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
      set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
      remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
    }));

    TestBed.configureTestingModule({
      providers: [
        MediaService,
        { provide: AuthService, useValue: { userObservable: of({ id: 'u1' } as any) } },
        { provide: RtdbService, useValue: rtdbSpy },
        { provide: MediaTypesService, useValue: { getHiddenTypeIds: () => hiddenTypes } },
      ],
    });
    service = TestBed.inject(MediaService);
  });

  it('deleteMedia removes listing children before the media record', async () => {
    const order: string[] = [];
    rtdbSpy.object.and.callFake((path: string) => ({
      remove: jasmine.createSpy('remove').and.callFake(() => {
        order.push(path);
        return Promise.resolve();
      }),
    }));

    await service.deleteMedia(makeMedia('m1', { listing: ['c1', 'c2'] } as any));

    expect(order).toEqual(['media/c1', 'media/c2', 'media/m1']);
  });

  it('filterByTypes drops hidden types', () => {
    hiddenTypes = ['hidden'];
    const all = [
      makeMedia('m1', { type: 'video' }),
      makeMedia('m2', { type: 'hidden' }),
    ];

    expect(service.filterByTypes(['video', 'hidden'], all).map(m => m.id)).toEqual(['m1']);
  });

  it('filterByQuery lowercases values', () => {
    const all = [
      makeMedia('m1', { title: 'Sunset Over Water' }),
      makeMedia('m2', { title: 'Mountain' }),
    ];

    expect(service.filterByQuery('SUNSET', all).map(m => m.id)).toEqual(['m1']);
    expect(service.filterByQuery('water', all).map(m => m.id)).toEqual(['m1']);
  });

  it('paging stops when there is nothing left or the item is already loaded', () => {
    const m1 = makeMedia('m1');

    expect(service.loadMoreMedia(5, [m1], [m1]).map(m => m.id)).toEqual(['m1']);
    expect(service.loadMoreMedia(5, [m1], []).map(m => m.id)).toEqual(['m1']);
  });
});
