import { TestBed } from '@angular/core/testing';

import { PushIdFactory } from './push-id.service';

describe('PushIdService', () => {
  let service: PushIdFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({ });
    service = TestBed.inject(PushIdFactory);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
