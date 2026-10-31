import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { Song } from 'src/app/models/song';
import { RtdbService } from './rtdb.service';
import { SongsService } from './songs.service';

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 's1',
    title: 'Amazing Grace',
    body: '[G]Amazing grace',
    source: null,
    musicalKey: 'G',
    leaderIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('SongsService', () => {
  let service: SongsService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let objectRef: {
    valueChanges: () => any;
    set: jasmine.Spy;
    update: jasmine.Spy;
    remove: jasmine.Spy;
  };

  beforeEach(() => {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['list', 'object']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => of([makeSong()]) } as any);

    objectRef = {
      valueChanges: () => of(null),
      set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
      update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
      remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
    };
    rtdbSpy.object.and.returnValue(objectRef as any);

    TestBed.configureTestingModule({
      providers: [
        SongsService,
        { provide: RtdbService, useValue: rtdbSpy },
      ],
    });

    service = TestBed.inject(SongsService);
  });

  it('lists songs from the songs node', async () => {
    expect(rtdbSpy.list).toHaveBeenCalledWith('songs');
    expect(await firstValueFrom(service.songs$)).toEqual([makeSong()]);
  });

  it('gets one song by id', async () => {
    await firstValueFrom(service.getSong('s1'));

    expect(rtdbSpy.object).toHaveBeenCalledWith('songs/s1');
  });

  it('saveSong stamps createdAt for a new song and updatedAt always', async () => {
    await service.saveSong(makeSong({ createdAt: 0 }));

    expect(rtdbSpy.object).toHaveBeenCalledWith('songs/s1');
    const payload = (objectRef.set as any).mock.calls[0][0] as Song;
    expect(payload.createdAt).toBeGreaterThan(0);
    expect(payload.updatedAt).toBeGreaterThan(0);
  });

  it('saveSong preserves an existing createdAt', async () => {
    await service.saveSong(makeSong({ createdAt: 123 }));

    const payload = (objectRef.set as any).mock.calls[0][0] as Song;
    expect(payload.createdAt).toBe(123);
  });

  it('updateSong writes the patch plus an updatedAt stamp', async () => {
    await service.updateSong('s1', { title: 'New Title' });

    expect(rtdbSpy.object).toHaveBeenCalledWith('songs/s1');
    const payload = (objectRef.update as any).mock.calls[0][0] as Partial<Song>;
    expect(payload.title).toBe('New Title');
    expect(payload.updatedAt).toBeGreaterThan(0);
  });

  it('deleteSong removes the record', async () => {
    await service.deleteSong('s1');

    expect(rtdbSpy.object).toHaveBeenCalledWith('songs/s1');
    expect(objectRef.remove).toHaveBeenCalled();
  });
});
