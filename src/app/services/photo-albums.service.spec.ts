import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PhotoAlbumsService } from './photo-albums.service';
import { RtdbService } from './rtdb.service';
import { PhotoAlbum } from '../models/photo-album';

describe('PhotoAlbumsService', () => {
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let listCalls: number;

  const album: PhotoAlbum = {
    id: 'album-1',
    title: 'Reunion',
    coverPhotoId: null,
    createdAt: 1,
    updatedAt: 1,
  };

  beforeEach(() => {
    listCalls = 0;
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['list']);
    rtdbSpy.list.and.callFake(() => ({
      valueChanges: () => (listCalls++ === 0
        ? throwError(() => new Error('permission denied'))
        : of([album])),
    }) as any);

    TestBed.configureTestingModule({
      providers: [
        PhotoAlbumsService,
        { provide: RtdbService, useValue: rtdbSpy },
      ],
    });
  });

  it('keeps albums$ alive and emits again after an error and reload', () => {
    const service = TestBed.inject(PhotoAlbumsService);
    const emissions: (PhotoAlbum[] | null)[] = [];
    let completed = false;
    let hasError = false;
    service.error$.subscribe(value => hasError = value);
    service.albums$.subscribe({
      next: albums => emissions.push(albums),
      complete: () => completed = true,
    });

    expect(hasError).toBe(true);
    expect(completed).toBe(false);
    expect(emissions[emissions.length - 1]).toBeNull();

    service.reload();

    expect(hasError).toBe(false);
    expect(completed).toBe(false);
    expect(emissions[emissions.length - 1]).toEqual([album]);
  });
});
