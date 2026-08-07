import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthGuardService } from './auth-guard.service';
import { AuthService } from './auth.service';
import { RoutingService } from './routing.service';

describe('AuthGuardService', () => {
  let service: AuthGuardService;
  let routingSpy: jasmine.SpyObj<RoutingService>;

  beforeEach(() => {
    routingSpy = jasmine.createSpyObj('RoutingService', ['NavigateToSignIn']);

    TestBed.configureTestingModule({
      providers: [
        AuthGuardService,
        { provide: AuthService, useValue: { userObservable: of(null), isUserSignedIn: () => false } },
        { provide: RoutingService, useValue: routingSpy },
      ]
    });

    service = TestBed.inject(AuthGuardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('canActivate allows signed-in users through', () => {
    (service.authService as any).isUserSignedIn = () => true;
    expect(service.canActivate()).toBe(true);
    expect(routingSpy.NavigateToSignIn).not.toHaveBeenCalled();
  });

  it('canActivate redirects signed-out users to sign-in', () => {
    expect(service.canActivate()).toBe(false);
    expect(routingSpy.NavigateToSignIn).toHaveBeenCalled();
  });
});
