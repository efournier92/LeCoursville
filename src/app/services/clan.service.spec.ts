import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ClanService } from './clan.service';
import { Clan } from 'src/app/models/clan';
import { RtdbService } from './rtdb.service';

function makeClan(overrides: Partial<Clan> = {}): Clan {
  return {
    id: 'c1',
    name: 'Clan',
    hexColor: '#fff',
    sortOrder: 'A',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('ClanService', () => {
  let service: ClanService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let refs: Record<string, any>;

  beforeEach(() => {
    refs = {};
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => of([makeClan()]) });
    rtdbSpy.createPushId.and.returnValue('push-1');
    rtdbSpy.object.and.callFake((path: string) => {
      refs[path] ??= {
        valueChanges: () => of(null),
        set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
        update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
        remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
      };
      return refs[path];
    });

    TestBed.configureTestingModule({
      providers: [
        ClanService,
        { provide: RtdbService, useValue: rtdbSpy },
      ],
    });
    service = TestBed.inject(ClanService);
  });

  it('loads clans on construction', async () => {
    expect((await firstValueFrom(service.clans$)).map(c => c.id)).toEqual(['c1']);
  });

  it('saves and updates a clan by id', async () => {
    await service.saveClan(makeClan());
    await service.updateClan('c1', { name: 'Renamed' });

    expect(refs['clans/c1'].set).toHaveBeenCalledWith(makeClan());
    expect(refs['clans/c1'].update).toHaveBeenCalledWith({ name: 'Renamed' });
  });

  it('deletes a clan by id', async () => {
    await service.deleteClan('c1');

    expect(refs['clans/c1'].remove).toHaveBeenCalled();
  });

  it('createPushId delegates to RTDB', () => {
    expect(service.createPushId()).toBe('push-1');
    expect(rtdbSpy.createPushId).toHaveBeenCalledTimes(1);
  });
});
