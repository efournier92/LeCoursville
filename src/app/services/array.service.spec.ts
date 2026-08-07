import { TestBed } from '@angular/core/testing';

import { ArrayService } from './array.service';

describe('ArrayService', () => {
  let service: ArrayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ArrayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('removeByIndex returns the removed element and mutates the source array', () => {
    const arr = ['a', 'b', 'c'];
    const removed = service.removeByIndex(arr, 1);
    expect(removed).toEqual(['b']);
    expect(arr).toEqual(['a', 'c']);
  });

  it('shuffle returns the same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = service.shuffle([...input]);
    expect([...result].sort()).toEqual(input);
  });
});
