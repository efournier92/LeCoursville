import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

import { User } from 'src/app/models/user';
import { RoutingService } from 'src/app/services/routing.service';
import { Observable, of } from 'rxjs';
import { filter, map, take, timeout, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthAdminGuardService  {
  user: User;

  constructor(
    public authService: AuthService,
    public routingService: RoutingService,
    private router: Router,
  ) { }

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.userObservable.pipe(
      // Wait for the first RTDB-backed record — skip the initial empty {}.
      filter((user: any) => !!user?.id),
      take(1),
      // ponytail: 5s safety timeout. If RTDB never resolves (network down,
      // deleted user, etc.) the guard redirects rather than deadlocking the
      // router. Upgrade path: render a spinner in the outlet instead of
      // bouncing to sign-in so the user sees loading, not a redirect.
      timeout(5000),
      map((user: any) => {
        if (user?.roles?.admin === true || user?.roles?.super === true) {
          return true;
        }
        // Send a signed-in non-admin to the same place root sends a member,
        // directly. Redirecting through '/' relied on the app-level promoted
        // route bounce and could strand the user on the account page.
        return this.router.parseUrl(this.routingService.getPromotedRoute());
      }),
      catchError(() => of(this.router.parseUrl('/'))),
    );
  }
}
