import { TestBed, inject } from '@angular/core/testing';
import { AuthAdminGuardService } from './auth-admin-guard.service';

describe('AuthGuardService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthAdminGuardService]
    });
  });

  it('should be created', inject([AuthAdminGuardService], (service: AuthAdminGuardService) => {
    expect(service).toBeTruthy();
  }));
});
