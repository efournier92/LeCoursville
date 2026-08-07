import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from './analytics.service';
import { FirebaseService } from './firebase.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: FirebaseService, useValue: { analytics: null } },
      ]
    });
    service = TestBed.inject(AnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('logEvent is a no-op when Firebase analytics is not initialized', () => {
    // Must not throw even though firebase/analytics logEvent is never called.
    expect(() => service.logEvent('test_event', { key: 'value' })).not.toThrow();
  });
});
