import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, filter, map, take, timeout } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { RoutingService } from './routing.service';

@Injectable({
  providedIn: 'root'
})
export class SuperAdminGuard {
  constructor(
    private authService: AuthService,
    private routingService: RoutingService,
    private router: Router,
  ) { }

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.userObservable.pipe(
      filter((user: any) => !!user?.id),
      take(1),
      timeout(5000),
      map((user: any) => user?.roles?.super === true
        ? true
        // Redirect to the promoted route — the same place root sends a member —
        // so a plain admin never sees the admin shell.
        : this.router.parseUrl(this.routingService.getPromotedRoute())),
      catchError(() => of(this.router.parseUrl('/'))),
    );
  }
}
