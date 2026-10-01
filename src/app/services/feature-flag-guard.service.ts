import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, filter, map, take, timeout } from 'rxjs/operators';
import { FeatureFlagsService } from './feature-flags.service';

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagGuard  {

  constructor(
    private featureFlagsService: FeatureFlagsService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const featureId = route.data['featureId'];

    if (!featureId) {
      return of(true);
    }

    // Wait for the first real RTDB flags snapshot: the flags subject starts
    // empty, so deciding on its first emission would let every disabled
    // feature through on a fresh page load (same race the photo-albums guard
    // already hardens against with flagsReady()).
    return combineLatest([
      this.featureFlagsService.getAllFeatureFlags(),
      this.featureFlagsService.flagsReady(),
    ]).pipe(
      filter(([, ready]) => ready),
      take(1),
      map(([flags]) => {
        const flag = flags[featureId];

        if (flag === null || flag === undefined || flag.enabled === true) {
          return true;
        }
        return this.router.createUrlTree(['/feature-disabled'], {
          queryParams: { feature: featureId }
        });
      }),
      timeout(10_000),
      catchError(() => {
        // Fail open like feature-flags.service.ts: a hung route is worse
        // than an unflagged one.
        console.warn(`FeatureFlagGuard: flags not ready after 10s, failing open for '${featureId}'`);
        return of(true);
      }),
    );
  }
}