import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { CanActivate } from '@angular/router';
import { User } from 'src/app/models/user';
import { RoutingService } from 'src/app/services/routing.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthAdminGuardService implements CanActivate {
  user: User;

  constructor(
    public authService: AuthService,
    public routingService: RoutingService
  ) { }

  canActivate(): boolean {
    const isUserSignedIn = this.authService.isUserSignedIn();
    const isUserAdmin = this.authService.isUserAdmin();

    if (isUserSignedIn && isUserAdmin) {
      return true;
    } else {
      this.routingService.NavigateToSignIn();
      return false;
    }
  }
}
