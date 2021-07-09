import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { Router, CanActivate } from '@angular/router';
import { User } from 'src/app/models/user';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate {
  user: User;

  constructor(
    public auth: AuthService, public router: Router
  ) {
    this.auth.userObservable.subscribe(
      (user: User) => this.user = user,
    )
  }

  canActivate(): boolean {
    if (!this.user) {
      this.router.navigateByUrl('/');
      return false;
    }
    
    return true;
  }
}
