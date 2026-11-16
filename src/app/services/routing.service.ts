import { Injectable } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { ADMIN_ROUTE } from 'src/app/admin/admin-nav';

@Injectable({
  providedIn: 'root',
})
export class RoutingService {
  // Routes a pending (not-yet-approved) user can reach; the navbar gate is
  // the source of truth, so anything else is rejected with a fallback.
  private static readonly PENDING_ROUTES = new Set([
    '/photos',
    '/media/video',
    '/media/audio',
    '/expressions',
    '/account',
    '/upload',
  ]);

  private static readonly ADMIN_PATHS = new Set([
    '/admin',
    ...Object.values(ADMIN_ROUTE).map(route => `/admin/${route}`),
  ]);

  private promotedRouteSubject = new BehaviorSubject<string | null>(null);
  private pendingPromotedRouteSubject = new BehaviorSubject<string | null>(null);
  private routesReadySubject = new BehaviorSubject<boolean>(false);
  private approvedLoaded = false;
  private pendingLoaded = false;
  private sidenavOpenSubject = new BehaviorSubject<boolean>(false);
  private invalidPromotedRouteWarned = false;
  sidenavOpen$ = this.sidenavOpenSubject.asObservable();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private featureFlagsService: FeatureFlagsService
  ) {
    this.loadPromotedRoute();
  }

  private loadPromotedRoute(): void {
    this.featureFlagsService.getPromotedRoute().subscribe((route: string | null) => {
      this.promotedRouteSubject.next(route || environment.promotedRoute || '/');
      this.markRouteLoaded('approved');
    }, () => this.markRouteLoaded('approved'));

    this.featureFlagsService.getPendingPromotedRoute().subscribe((route: string | null) => {
      this.pendingPromotedRouteSubject.next(route || environment.promotedRoutePending || '/photos');
      this.markRouteLoaded('pending');
    }, () => this.markRouteLoaded('pending'));
  }

  /** True once both promoted routes have taken their first value (or failed). */
  routesReady(): Observable<boolean> {
    return this.routesReadySubject.asObservable();
  }

  private markRouteLoaded(kind: 'approved' | 'pending'): void {
    if (kind === 'approved') {
      this.approvedLoaded = true;
    } else {
      this.pendingLoaded = true;
    }
    if (this.approvedLoaded && this.pendingLoaded) {
      this.routesReadySubject.next(true);
    }
  }

  IsRootRoute() {
    // Use the browser path, not router.url: while an async route guard is
    // pending, router.url still shows the previous route, which made the
    // post-login redirect in app.component fire on ANY in-flight navigation
    // (e.g. reloading /admin bounced to /calendar). The address bar always
    // reflects the real target route.
    return window.location.pathname === '/';
  }

  NavigateToRoute(route: string) {
    this.router.navigate([route]);
  }

  getPromotedRoute(approved: boolean): string {
    return approved ? this.getApprovedRoute() : this.getPendingRoute();
  }

  private getApprovedRoute(): string {
    const route = this.promotedRouteSubject.getValue();
    if (route && route !== '/' && !route.startsWith('/admin')) {
      return route;
    }
    const fallback = environment.promotedRoute || '/calendar';
    if (route !== null && route !== undefined) {
      this.warnInvalidPromotedRoute(route, fallback);
    }
    return fallback;
  }

  private getPendingRoute(): string {
    const route = this.pendingPromotedRouteSubject.getValue();
    const fallback = environment.promotedRoutePending || '/photos';
    if (route && RoutingService.PENDING_ROUTES.has(route)) {
      return route;
    }
    if (route !== null && route !== undefined) {
      this.warnInvalidPromotedRoute(route, fallback);
    }
    return fallback;
  }

  private warnInvalidPromotedRoute(route: string, fallback: string): void {
    if (this.invalidPromotedRouteWarned) {
      return;
    }
    this.invalidPromotedRouteWarned = true;
    console.warn(`Ignoring invalid promoted route "${route}"; falling back to ${fallback}.`);
  }

  NavigateToPromotedRoute(approved: boolean) {
    this.NavigateToRoute(this.getPromotedRoute(approved));
  }

  NavigateToSignIn() {
    this.NavigateToRoute('/');
  }

  NavigateToMedia() {
    this.NavigateToRoute('/media');
  }

  NavigateToAudio() {
    this.NavigateToRoute('/media/audio');
  }

  NavigateToVideo() {
    this.NavigateToRoute('/media/video');
  }

  NavigateToExpressions() {
    this.NavigateToRoute('/expressions');
  }

  NavigateToAdmin() {
    this.NavigateToRoute('/admin');
  }

  isOnAdminRoute(): boolean {
    // Prefix matching treated stale admin URLs like /administrator and retired
    // /admin/* deep links as "on admin", so the logo skipped the admin branch.
    const path = this.router.url.split(/[?#]/)[0];
    return RoutingService.ADMIN_PATHS.has(path);
  }

  handleLogoNavigation(isAdmin: boolean, approved = true): void {
    if (!isAdmin) {
      this.NavigateToPromotedRoute(approved);
    } else if (this.isOnAdminRoute()) {
      this.NavigateToPromotedRoute(approved);
    } else {
      this.NavigateToAdmin();
    }
  }

  toggleSidenav(): void {
    this.sidenavOpenSubject.next(!this.sidenavOpenSubject.getValue());
  }

  closeSidenav(): void {
    this.sidenavOpenSubject.next(false);
  }

  openSidenav(): void {
    this.sidenavOpenSubject.next(true);
  }

  NavigateToAdminUsers() {
    this.NavigateToRoute('/admin/users');
  }

  NavigateToPhotoAlbum(albumId: string): void {
    this.router.navigate(['/photos', albumId]);
  }

  NavigateToPhotoSlideshow(albumId: string, durationSec?: number): void {
    const queryParams = durationSec ? { duration: durationSec } : {};
    this.router.navigate(['/photos', albumId, 'slideshow'], { queryParams });
  }

  NavigateToAdminMedia() {
    this.NavigateToRoute('/admin/media');
  }

  NavigateToAdminCalendar() {
    this.NavigateToRoute('/admin/calendars');
  }

  NavigateToAdminFeatures() {
    this.NavigateToRoute('/admin/features');
  }

  NavigateToAdminFamilies() {
    this.NavigateToRoute('/admin/families');
  }

  NavigateToAdminPeopleImport() {
    this.NavigateToRoute('/admin/people');
  }

  NavigateToRouteWithoutLocationChange(route: string) {
    this.router.navigateByUrl(route, { skipLocationChange: true });
  }

  RefreshCurrentRoute() {
    window.location.reload();
  }

  getQueryParams() {
    this.activatedRoute.queryParams.subscribe((params) => {
      return this.getMediaIdFromQueryParams(params);
    });
  }

  getCurrentLocation() {
    return location.href;
  }

  private getMediaIdFromQueryParams(params) {
    const idFromParams = params.id;
    if (idFromParams) {
      return idFromParams;
    }
  }

  updateQueryParams(selectedId: string) {
    const queryParams: Params = { id: selectedId };

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams,
      // queryParamsHandling: 'merge', // remove to replace all query params by provided
    });
  }

  clearQueryParams() {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: null,
    });
  }
}
