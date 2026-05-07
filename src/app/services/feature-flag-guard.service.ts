import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { FeatureFlagsService } from './feature-flags.service';

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagGuard implements CanActivate {

  constructor(
    private featureFlagsService: FeatureFlagsService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const featureId = route.data['featureId'];

    if (!featureId) {
      return of(true);
    }

    return new Observable<boolean | UrlTree>(observer => {
      this.featureFlagsService.getAllFeatureFlags().subscribe(flagsMap => {
        const flag = flagsMap[featureId];

        if (flag === null || flag === undefined || flag.enabled === true) {
          observer.next(true);
        } else {
          const urlTree = this.router.createUrlTree(['/feature-disabled'], {
            queryParams: { feature: featureId }
          });
          observer.next(urlTree);
        }
        observer.complete();
      });
    });
  }
}