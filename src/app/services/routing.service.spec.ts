import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { RoutingService } from './routing.service';
import { FeatureFlagsService } from './feature-flags.service';
import { environment } from 'src/environments/environment';

describe('RoutingService', () => {
  let service: RoutingService;
  let promotedRoute$: BehaviorSubject<string | null>;
  let pendingRoute$: BehaviorSubject<string | null>;

  beforeEach(() => {
    promotedRoute$ = new BehaviorSubject<string | null>(null);
    pendingRoute$ = new BehaviorSubject<string | null>(null);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        {
          provide: FeatureFlagsService,
          useValue: {
            getPromotedRoute: () => promotedRoute$.asObservable(),
            getPendingPromotedRoute: () => pendingRoute$.asObservable(),
          },
        },
      ],
    });
    service = TestBed.inject(RoutingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('NavigateToAdminFeatures() navigates to /admin/features', () => {
    const navigateSpy = spyOn(service, 'NavigateToRoute');
    service.NavigateToAdminFeatures();
    expect(navigateSpy).toHaveBeenCalledWith('/admin/features');
  });

  it('returns the approved promoted route for an approved user', () => {
    promotedRoute$.next('/expressions');

    expect(service.getPromotedRoute(true)).toBe('/expressions');
  });

  it('falls back to the environment route for an /admin promoted route', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    promotedRoute$.next('/admin/users');

    expect(service.getPromotedRoute(true)).toBe(environment.promotedRoute);
    expect(service.getPromotedRoute(true)).toBe(environment.promotedRoute);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('falls back to the environment route when root is promoted', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    promotedRoute$.next('/');

    expect(service.getPromotedRoute(true)).toBe(environment.promotedRoute);
    warnSpy.mockRestore();
  });

  it('returns the pending route for a pending user', () => {
    pendingRoute$.next('/photos');

    expect(service.getPromotedRoute(false)).toBe('/photos');
  });

  it('rejects approved-only routes for a pending user and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pendingRoute$.next('/calendar');

    expect(service.getPromotedRoute(false)).toBe(environment.promotedRoutePending);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
