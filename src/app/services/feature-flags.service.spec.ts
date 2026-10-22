import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FeatureFlagsService } from './feature-flags.service';
import { RtdbService } from './rtdb.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;

  beforeEach(() => {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'createPushId']);
    const refs: Record<string, unknown> = {};
    (rtdbSpy.object as jasmine.Spy).and.callFake((path: string) => {
      refs[path] ??= {
        valueChanges: () => of(path === 'features' ? { photos: { enabled: true } } : null),
        set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
        update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
        remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
      };
      return refs[path];
    });
    (rtdbSpy.createPushId as jasmine.Spy).and.returnValue('push-id');

    TestBed.configureTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: RtdbService, useValue: rtdbSpy },
      ]
    });

    service = TestBed.inject(FeatureFlagsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('writes feature flag audit rows under a push id', async () => {
    const record = {
      flagId: 'chat',
      enabled: false,
      previous: true,
      actorId: 'admin-1',
      actorEmail: 'admin@e2e.local',
      at: 1,
    };

    await service.addFeatureFlagAudit(record);

    expect(rtdbSpy.object).toHaveBeenCalledWith('featureFlagAudit/push-id');
    expect(rtdbSpy.object('featureFlagAudit/push-id').set).toHaveBeenCalledWith(record);
  });

  it('loads flags and exposes flagsReady', async () => {
    await new Promise<void>((resolve) => {
      service.flagsReady().subscribe(ready => {
        expect(ready).toBe(true);
        service.getAllFeatureFlags().subscribe(flags => {
          expect(flags['photos']?.enabled).toBe(true);
          resolve();
        });
      });
    });
  });
});
