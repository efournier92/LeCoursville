import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { FamilyService } from './family.service';
import { Family } from 'src/app/models/family';
import { RtdbService } from './rtdb.service';

function makeFamily(overrides: Partial<Family> = {}): Family {
  return {
    id: 'f1',
    name: 'Family',
    hexColor: '#fff',
    sortOrder: 'A',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('FamilyService', () => {
  let service: FamilyService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let refs: Record<string, any>;

  beforeEach(() => {
    refs = {};
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => of([makeFamily()]) });
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
        FamilyService,
        { provide: RtdbService, useValue: rtdbSpy },
      ],
    });
    service = TestBed.inject(FamilyService);
  });

  it('loads families on construction', async () => {
    expect((await firstValueFrom(service.families$)).map(f => f.id)).toEqual(['f1']);
  });

  it('reports ready after the families read resolves', async () => {
    expect(await firstValueFrom(service.familiesStatus$)).toBe('ready');
  });

  it('reports error when the families read fails', async () => {
    const failingRtdb = jasmine.createSpyObj('RtdbService', ['list']);
    failingRtdb.list.and.returnValue({ valueChanges: () => throwError(() => new Error('permission_denied')) });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FamilyService,
        { provide: RtdbService, useValue: failingRtdb },
      ],
    });

    const failingService = TestBed.inject(FamilyService);

    expect(await firstValueFrom(failingService.familiesStatus$)).toBe('error');
    expect(failingRtdb.list).toHaveBeenCalledTimes(1);
  });

  it('saves and updates a family by id', async () => {
    await service.saveFamily(makeFamily());
    await service.updateFamily('f1', { name: 'Renamed' });

    expect(refs['families/f1'].set).toHaveBeenCalledWith(makeFamily());
    expect(refs['families/f1'].update).toHaveBeenCalledWith({ name: 'Renamed' });
  });

  it('deletes a family by id', async () => {
    await service.deleteFamily('f1');

    expect(refs['families/f1'].remove).toHaveBeenCalled();
  });

  it('createPushId delegates to RTDB', () => {
    expect(service.createPushId()).toBe('push-1');
    expect(rtdbSpy.createPushId).toHaveBeenCalledTimes(1);
  });

  it('resolves a family id by name case-insensitively', () => {
    expect(service.resolveFamilyIdByName('family')).toBe('f1');
    expect(service.resolveFamilyIdByName('  FAMILY  ')).toBe('f1');
  });

  it('returns undefined for a name that matches no family', () => {
    expect(service.resolveFamilyIdByName('Missing')).toBeUndefined();
  });

  it('exposes the in-memory families snapshot', () => {
    expect(service.getFamiliesSnapshot().map(f => f.id)).toEqual(['f1']);
  });
});
