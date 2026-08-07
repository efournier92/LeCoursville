import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthAdminGuardService } from './auth-admin-guard.service';
import { AuthService } from './auth.service';
import { RoutingService } from './routing.service';

describe('AuthAdminGuardService', () => {
  let service: AuthAdminGuardService;
  let routingSpy: jasmine.SpyObj<RoutingService>;

  beforeEach(() => {
    routingSpy = jasmine.createSpyObj('RoutingService', ['NavigateToSignIn']);

    TestBed.configureTestingModule({
      providers: [
        AuthAdminGuardService,
        { provide: AuthService, useValue: { userObservable: of(null), isUserSignedIn: () => false, isUserAdmin: () => false } },
        { provide: RoutingService, useValue: routingSpy },
      ]
    });

    service = TestBed.inject(AuthAdminGuardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('canActivate allows signed-in admins through', () => {
    (service.authService as any).isUserSignedIn = () => true;
    (service.authService as any).isUserAdmin = () => true;
    expect(service.canActivate()).toBe(true);
    expect(routingSpy.NavigateToSignIn).not.toHaveBeenCalled();
  });

  it('canActivate redirects non-admin users to sign-in', () => {
    (service.authService as any).isUserSignedIn = () => true;
    (service.authService as any).isUserAdmin = () => false;
    expect(service.canActivate()).toBe(false);
    expect(routingSpy.NavigateToSignIn).toHaveBeenCalled();
  });

  it('canActivate redirects signed-out users to sign-in', () => {
    expect(service.canActivate()).toBe(false);
    expect(routingSpy.NavigateToSignIn).toHaveBeenCalled();
  });
});
