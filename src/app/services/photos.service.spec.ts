import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { PhotosService } from './photos.service';
import { AuthService } from './auth.service';
import { RtdbService } from './rtdb.service';
import { Photo } from 'src/app/models/photo';

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return { id: 'photo-1', url: '', title: 'Sunset', isMessageAttachment: false, ...overrides } as Photo;
}

describe('PhotosService', () => {
  let service: PhotosService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let photosSubject: BehaviorSubject<Photo[]>;

  beforeEach(() => {
    photosSubject = new BehaviorSubject<Photo[]>([]);
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId', 'orderByChild', 'equalTo']);
    rtdbSpy.object.and.returnValue({
      valueChanges: () => of(null),
      update: jasmine.createSpy('update'),
      set: jasmine.createSpy('set'),
      remove: jasmine.createSpy('remove'),
    });
    rtdbSpy.list.and.returnValue({ valueChanges: () => photosSubject.asObservable() });
    rtdbSpy.createPushId.and.returnValue('photo-id-1');
    rtdbSpy.orderByChild.and.returnValue('orderByChild');
    rtdbSpy.equalTo.and.returnValue('equalTo');

    TestBed.configureTestingModule({
      providers: [
        PhotosService,
        { provide: AuthService, useValue: { userObservable: of({ id: 'u1' }) } },
        { provide: RtdbService, useValue: rtdbSpy },
      ]
    });

    service = TestBed.inject(PhotosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getYears covers 1800 through the current year', () => {
    const years = service.getYears();
    expect(years[0]).toBe(1800);
    expect(years[years.length - 1]).toBe(new Date().getFullYear());
  });

  it('updateAllPhotosEvent broadcasts the photo list', async () => {
    const photos = [makePhoto({ id: 'photo-1' }), makePhoto({ id: 'photo-2' })];
    service.updateAllPhotosEvent(photos);
    const emitted = await firstValueFrom(service.allPhotosObservable);
    expect(emitted).toEqual(photos);
  });

  it('excludes message attachments from nonMessagePhotos$', async () => {
    photosSubject.next([
      makePhoto({ id: 'photo-1', isMessageAttachment: false }),
      makePhoto({ id: 'photo-2', isMessageAttachment: true }),
    ]);

    const photos = await firstValueFrom(service.nonMessagePhotos$);
    expect(photos.map(p => p.id)).toEqual(['photo-1']);
  });

  it('updatePhoto delegates a partial update to RTDB', async () => {
    const photo = makePhoto({ id: 'photo-1', year: 1995 });
    await service.updatePhoto(photo);
    expect(rtdbSpy.object).toHaveBeenCalledWith('photos/photo-1');
    expect(rtdbSpy.object('photos/photo-1').update).toHaveBeenCalledWith(jasmine.objectContaining({ year: 1995 }));
  });

  it('setPhotoAlbum updates the albumId on the photo record', async () => {
    await service.setPhotoAlbum('photo-1', 'album-9');
    expect(rtdbSpy.object('photos/photo-1').update).toHaveBeenCalledWith({ albumId: 'album-9' });
  });

  it('getPhotosByAlbum queries photos filtered by album id', () => {
    service.getPhotosByAlbum('album-9');
    expect(rtdbSpy.list).toHaveBeenCalledWith('photos', ['orderByChild', 'equalTo']);
  });
});
