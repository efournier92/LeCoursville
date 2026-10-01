import { Injectable } from '@angular/core';
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
    public routingService: RoutingService
  ) { }

  canActivate(): Observable<boolean> {
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
        if (user?.roles?.admin === true) {
          return true;
        }
        this.routingService.NavigateToSignIn();
        return false;
      }),
      catchError(() => {
        this.routingService.NavigateToSignIn();
        return of(false);
      }),
    );
  }
}
