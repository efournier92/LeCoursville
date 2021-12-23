import { Injectable } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class RoutingService {

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) { }

  NavigateToRoute(route: string) {
    this.router.navigate([route]);
  }

  NavigateToSignIn() {
    this.NavigateToRoute('/');
  }

  NavigateToMedia() {
    this.NavigateToRoute('/media');
  }

  NavigateToAudio() {
    this.NavigateToRoute('/audio');
  }

  NavigateToRouteWithoutLocationChange(route: string) {
    this.router.navigateByUrl(route, { skipLocationChange: true });
  }

  RefreshCurrentRoute() {
    window.location.reload();
  }

  getQueryParams() {
    this.activatedRoute.queryParams.subscribe(params => {
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

    this.router.navigate(
      [],
      {
        relativeTo: this.activatedRoute,
        queryParams
        // queryParamsHandling: 'merge', // remove to replace all query params by provided
      });
  }

  clearQueryParams() {
    this.router.navigate(
      [],
      {
        relativeTo: this.activatedRoute,
        queryParams: null,
      });
  }
}
