import { TestBed } from '@angular/core/testing';

import { PushIdService } from './push-id.service';

describe('PushIdService', () => {
  let service: PushIdService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PushIdService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
