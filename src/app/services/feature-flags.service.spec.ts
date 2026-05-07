import { TestBed, inject } from '@angular/core/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { AngularFireDatabase } from '@angular/fire/compat/database';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let mockDb: jasmine.SpyObj<AngularFireDatabase>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AngularFireDatabase', ['object']);
    mockDb = spy;

    TestBed.configureTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: AngularFireDatabase, useValue: mockDb },
      ]
    });

    service = TestBed.inject(FeatureFlagsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});