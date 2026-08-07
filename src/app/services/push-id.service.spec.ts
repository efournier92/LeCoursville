import { TestBed } from '@angular/core/testing';

import { PushIdFactory } from './push-id.service';
import { RtdbService } from './rtdb.service';

describe('PushIdService', () => {
  let service: PushIdFactory;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;

  beforeEach(() => {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['createPushId']);
    rtdbSpy.createPushId.and.returnValue('push-id-abc');

    TestBed.configureTestingModule({
      providers: [
        PushIdFactory,
        { provide: RtdbService, useValue: rtdbSpy },
      ]
    });
    service = TestBed.inject(PushIdFactory);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('create() delegates to the RTDB push id generator', () => {
    expect(service.create()).toBe('push-id-abc');
    expect(rtdbSpy.createPushId).toHaveBeenCalled();
  });
});
