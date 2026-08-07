import { TestBed } from '@angular/core/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { RtdbService } from './rtdb.service';
import { RtdbObjectRef } from './rtdb.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let objectSpy: jasmine.Spy;

  beforeEach(() => {
    objectSpy = jasmine.createSpy('object').and.callFake(() => ({
      valueChanges: () => ({}),
    }) as Partial<RtdbObjectRef<unknown>>);
    const rtdbSpy = jasmine.createSpyObj('RtdbService', ['object'], {
      createPushId: () => 'push-id',
    });
    (rtdbSpy.object as jasmine.Spy).and.callFake(() => ({
      valueChanges: () => ({}),
    }));

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

  it('exposes flagsReady', (done) => {
    service.flagsReady().subscribe(ready => {
      expect(typeof ready).toBe('boolean');
      done();
    });
  });
});
