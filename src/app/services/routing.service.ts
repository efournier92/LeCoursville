import { Injectable } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';

@Injectable({
  providedIn: 'root',
})
export class RoutingService {
  private promotedRouteSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private featureFlagsService: FeatureFlagsService
  ) {
    this.loadPromotedRoute();
  }

  private loadPromotedRoute(): void {
    this.featureFlagsService.getPromotedRoute().subscribe((data: any) => {
      if (data && data.route) {
        this.promotedRouteSubject.next(data.route);
      } else {
        this.promotedRouteSubject.next(environment.promotedRoute || '/');
      }
    });
  }

  IsRootRoute() {
    return this.router.url === '/';
  }

  NavigateToRoute(route: string) {
    this.router.navigate([route]);
  }

  NavigateToPromotedRoute() {
    const route = this.promotedRouteSubject.getValue() || environment.promotedRoute || '/';
    this.NavigateToRoute(route);
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

  NavigateToAdminUsers() {
    this.NavigateToRoute('/admin/users');
  }

  NavigateToAdminMedia() {
    this.NavigateToRoute('/admin/media');
  }

  NavigateToAdminCalendar() {
    this.NavigateToRoute('/admin/calendar');
  }

  NavigateToAdminFeatures() {
    this.NavigateToRoute('/admin/features');
  }

  NavigateToAdminClans() {
    this.NavigateToRoute('/admin/clans');
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
