import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class RoutingService {

  constructor(
    private router: Router,
  ) { }

  NavigateToRoute(route: string) {
    this.router.navigate([route]);
  }

  NavigateToRouteWithoutLocationChange(route: string) {
    this.router.navigateByUrl(route, { skipLocationChange: true });
  }

  RefreshCurrentRoute() {
    window.location.reload();
  }
}
