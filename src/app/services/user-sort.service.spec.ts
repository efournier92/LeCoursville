import { TestBed } from '@angular/core/testing';

import { UserSortService } from './user-sort.service';

describe('UserSortService', () => {
  let service: UserSortService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserSortService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
