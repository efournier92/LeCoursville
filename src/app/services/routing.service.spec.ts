import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { RoutingService } from './routing.service';
import { FeatureFlagsService } from './feature-flags.service';
import { environment } from 'src/environments/environment';

describe('RoutingService', () => {
  let service: RoutingService;
  let promotedRoute$: BehaviorSubject<any>;

  beforeEach(() => {
    promotedRoute$ = new BehaviorSubject<any>(null);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        { provide: FeatureFlagsService, useValue: { getPromotedRoute: () => promotedRoute$.asObservable() } },
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

  it('returns a valid promoted route', () => {
    promotedRoute$.next({ route: '/expressions' });

    expect(service.getPromotedRoute()).toBe('/expressions');
  });

  it('falls back to the environment route for an /admin promoted route', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    promotedRoute$.next({ route: '/admin/users' });

    expect(service.getPromotedRoute()).toBe(environment.promotedRoute);
    expect(service.getPromotedRoute()).toBe(environment.promotedRoute);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('falls back to the environment route when root is promoted', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    promotedRoute$.next({ route: '/' });

    expect(service.getPromotedRoute()).toBe(environment.promotedRoute);
    warnSpy.mockRestore();
  });
});
