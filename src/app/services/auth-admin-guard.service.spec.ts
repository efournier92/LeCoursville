import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { AuthAdminGuardService } from './auth-admin-guard.service';
import { AuthService } from './auth.service';
import { RoutingService } from './routing.service';

describe('AuthAdminGuardService', () => {
  let service: AuthAdminGuardService;
  let routingSpy: jasmine.SpyObj<RoutingService>;
  let user$: Subject<any>;
  let parseUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    routingSpy = jasmine.createSpyObj('RoutingService', ['NavigateToSignIn', 'getPromotedRoute']);
    routingSpy.getPromotedRoute.mockReturnValue('/calendar');
    user$ = new Subject<any>();
    parseUrl = vi.fn((url: string) => ({ url }));

    TestBed.configureTestingModule({
      providers: [
        AuthAdminGuardService,
        { provide: AuthService, useValue: { userObservable: user$.asObservable() } },
        { provide: RoutingService, useValue: routingSpy },
        { provide: Router, useValue: { parseUrl } },
      ]
    });

    service = TestBed.inject(AuthAdminGuardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('canActivate allows RTDB-backed admins through', async () => {
    const result = firstValueFrom(service.canActivate());
    user$.next({ id: 'u1', roles: { admin: true } });
    expect(await result).toBe(true);
    expect(routingSpy.NavigateToSignIn).not.toHaveBeenCalled();
  });

  it('canActivate allows supers through even without the admin flag', async () => {
    const result = firstValueFrom(service.canActivate());
    user$.next({ id: 'u3', roles: { super: true } });
    expect(await result).toBe(true);
    expect(routingSpy.NavigateToSignIn).not.toHaveBeenCalled();
  });

  it('canActivate redirects a signed-in non-admin to the promoted route', async () => {
    const result = firstValueFrom(service.canActivate());
    user$.next({ id: 'u2', roles: { user: true } });
    expect(await result).toEqual({ url: '/calendar' });
    expect(parseUrl).toHaveBeenCalledWith('/calendar');
    expect(routingSpy.NavigateToSignIn).not.toHaveBeenCalled();
  });

  it('canActivate redirects to sign-in when no RTDB user record arrives (timeout)', async () => {
    vi.useFakeTimers();
    try {
      const result = firstValueFrom(service.canActivate());
      // Initial empty record is filtered out; the guard then hits its 5s timeout.
      user$.next({});
      await vi.advanceTimersByTimeAsync(5001);
      expect(await result).toEqual({ url: '/' });
      expect(parseUrl).toHaveBeenCalledWith('/');
    } finally {
      vi.useRealTimers();
    }
  });
});
