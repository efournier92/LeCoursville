import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FeatureFlagsService } from './feature-flags.service';
import { RtdbService } from './rtdb.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(() => {
    const rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'createPushId']);
    (rtdbSpy.object as jasmine.Spy).and.callFake((path: string) => ({
      valueChanges: () => of(path === 'features' ? { photos: { enabled: true } } : null),
      set: () => Promise.resolve(),
      update: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    }));
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

  it('loads flags and exposes flagsReady', (done) => {
    service.flagsReady().subscribe(ready => {
      expect(ready).toBe(true);
      service.getAllFeatureFlags().subscribe(flags => {
        expect(flags['photos']?.enabled).toBe(true);
        done();
      });
    });
  });
});
