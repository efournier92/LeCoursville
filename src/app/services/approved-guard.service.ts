import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, filter, map, take, timeout } from 'rxjs/operators';
import { isApprovedUser } from 'src/app/models/user';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ApprovedGuardService {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) { }

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.userObservable.pipe(
      // Wait for the RTDB-backed record, not the cached/local role, so a
      // revoked member cannot ride last session's approval through.
      filter((user: any) => !!user?.id),
      take(1),
      timeout(5000),
      map((user: any) => isApprovedUser(user) ? true : this.router.parseUrl('/media')),
      catchError(() => of(this.router.parseUrl('/media'))),
    );
  }
}
