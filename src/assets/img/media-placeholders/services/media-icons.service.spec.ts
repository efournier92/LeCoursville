import { TestBed } from '@angular/core/testing';

import { MediaIconsService } from './media-icons.service';

describe('MediaIconsService', () => {
  let service: MediaIconsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaIconsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
