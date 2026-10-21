import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { SuperAdminGuard } from './super-admin.guard';
import { AuthService } from './auth.service';
import { RoutingService } from './routing.service';

function fakeUrlTree(url: string): UrlTree {
  return { toString: () => url } as unknown as UrlTree;
}

describe('SuperAdminGuard', () => {
  let service: SuperAdminGuard;
  let user$: BehaviorSubject<any>;
  let parseUrl: ReturnType<typeof vi.fn>;
  let getPromotedRoute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user$ = new BehaviorSubject<any>({});
    parseUrl = vi.fn((url: string) => fakeUrlTree(url));
    getPromotedRoute = vi.fn(() => '/calendar');

    TestBed.configureTestingModule({
      providers: [
        SuperAdminGuard,
        { provide: AuthService, useValue: { userObservable: user$.asObservable() } },
        { provide: RoutingService, useValue: { getPromotedRoute } },
        { provide: Router, useValue: { parseUrl } },
      ]
    });

    service = TestBed.inject(SuperAdminGuard);
  });

  it('allows supers through', async () => {
    const result = firstValueFrom(service.canActivate());
    user$.next({ id: 'u1', roles: { super: true } });
    expect(await result).toBe(true);
    expect(parseUrl).not.toHaveBeenCalled();
  });

  it('sends plain admins to the promoted route', async () => {
    const result = firstValueFrom(service.canActivate());
    user$.next({ id: 'u2', roles: { admin: true, super: false } });
    await result;
    expect(getPromotedRoute).toHaveBeenCalled();
    expect(parseUrl).toHaveBeenCalledWith('/calendar');
  });

  it('sends the request to / when no user record arrives before the timeout', async () => {
    vi.useFakeTimers();
    try {
      const result = firstValueFrom(service.canActivate());
      user$.next({});
      await vi.advanceTimersByTimeAsync(5001);
      await result;
      expect(parseUrl).toHaveBeenCalledWith('/');
    } finally {
      vi.useRealTimers();
    }
  });
});
