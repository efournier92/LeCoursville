import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { User } from 'src/app/models/user';
import { RoutingService } from 'src/app/services/routing.service';
import { Observable, Subscription } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService  {
  user: User;

  constructor(
    public authService: AuthService,
    public routingService: RoutingService
  ) {
    this.authService.userObservable.subscribe(
      user => user
    );
  }

  canActivate(): boolean {
    const isUserSignedIn = this.authService.isUserSignedIn();

    if (isUserSignedIn) {
      return true;
    } else {
      this.routingService.NavigateToSignIn();
      return false;
    }
  }
}
