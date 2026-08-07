import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Gates the photo-albums surface behind the `enablePhotoAlbums` flag with
 * default-OFF semantics (no RTDB record until an admin flips it in
 * /admin/features). Direct navigation to /photos/:albumId or
 * /admin/photo-albums must not bypass the flag, or this branch would not be
 * safely deployable while the feature is OFF.
 */
@Injectable({ providedIn: 'root' })
export class PhotoAlbumsFeatureGuard  {
  constructor(
    private featureFlagsService: FeatureFlagsService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    return this.featureFlagsService.getAllFeatureFlags().pipe(
      map(flags => {
        if (flags['enablePhotoAlbums']?.enabled) {
          return true;
        }
        const fallback = route.data['fallbackUrl'] || '/photos';
        return this.router.createUrlTree([fallback]);
      }),
    );
  }
}
