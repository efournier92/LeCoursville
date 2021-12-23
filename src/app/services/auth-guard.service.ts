import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { CanActivate } from '@angular/router';
import { User } from 'src/app/models/user';
import { RoutingService } from 'src/app/services/routing.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate {
  user: User;

  constructor(
    public auth: AuthService,
    public routingService: RoutingService
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => this.user = user,
    );
  }

  canActivate(): boolean {
    if (!this.user) {
      this.routingService.NavigateToRoute('/');
      return false;
    }
    return true;
  }
}
