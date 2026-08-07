import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { combineLatest } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Gates the photo-albums surface behind the `enablePhotoAlbums` flag with
 * default-OFF semantics (no RTDB record until an admin flips it in
 * /admin/features). Direct navigation to /photos/:albumId or
 * /admin/photo-albums must not bypass the flag, or this branch would not be
 * safely deployable while the feature is OFF.
 */
@Injectable({ providedIn: 'root' })
export class PhotoAlbumsFeatureGuard implements CanActivate {
  constructor(
    private featureFlagsService: FeatureFlagsService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    return combineLatest([
      this.featureFlagsService.getAllFeatureFlags(),
      this.featureFlagsService.flagsReady(),
    ]).pipe(
      // Wait for the first real RTDB snapshot so a fresh page load does not
      // read the empty initial map and wrongly redirect.
      filter(([, ready]) => ready),
      take(1),
      map(([flags]) => {
        if (flags['enablePhotoAlbums']?.enabled) {
          return true;
        }
        const fallback = route.data['fallbackUrl'] || '/photos';
        return this.router.createUrlTree([fallback]);
      }),
    );
  }
}
