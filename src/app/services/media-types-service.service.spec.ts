import { TestBed } from '@angular/core/testing';

import { MediaTypesService } from './media-types-service.service';

describe('MediaTypesService', () => {
  let service: MediaTypesService;

  beforeEach(() => {
    TestBed.configureTestingModule({ });
    service = TestBed.inject(MediaTypesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
