import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Router, UrlTree, ActivatedRouteSnapshot } from '@angular/router';
import { PhotoAlbumsFeatureGuard } from './photo-albums-feature.guard';
import { FeatureFlagsService } from './feature-flags.service';

function fakeUrlTree(url: string | string[]): UrlTree {
  const value = Array.isArray(url) ? url[0] : url;
  return { toString: () => value } as unknown as UrlTree;
}

describe('PhotoAlbumsFeatureGuard', () => {
  let guard: PhotoAlbumsFeatureGuard;
  let flags$: BehaviorSubject<Record<string, any>>;
  let ready$: BehaviorSubject<boolean>;
  let createUrlTree: jasmine.Spy;

  function route(data: Record<string, unknown> = {}): ActivatedRouteSnapshot {
    return { data } as unknown as ActivatedRouteSnapshot;
  }

  beforeEach(() => {
    flags$ = new BehaviorSubject<Record<string, any>>({});
    ready$ = new BehaviorSubject<boolean>(false);
    createUrlTree = jasmine.createSpy('createUrlTree').and.callFake((url: string | string[]) => fakeUrlTree(url));

    TestBed.configureTestingModule({
      providers: [
        PhotoAlbumsFeatureGuard,
        {
          provide: FeatureFlagsService,
          useValue: {
            getAllFeatureFlags: () => flags$.asObservable(),
            flagsReady: () => ready$.asObservable(),
          },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
    guard = TestBed.inject(PhotoAlbumsFeatureGuard);
  });

  it('allows when enablePhotoAlbums is enabled', async () => {
    flags$.next({ enablePhotoAlbums: { enabled: true } });
    ready$.next(true);

    expect(await firstValueFrom(guard.canActivate(route()))).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects a missing flag record to /photos (default OFF)', async () => {
    ready$.next(true);

    const result = await firstValueFrom(guard.canActivate(route()));

    expect(result.toString()).toBe('/photos');
    expect(createUrlTree).toHaveBeenCalledWith(['/photos']);
  });

  it('redirects a disabled flag to route.data.fallbackUrl', async () => {
    flags$.next({ enablePhotoAlbums: { enabled: false } });
    ready$.next(true);

    const result = await firstValueFrom(guard.canActivate(route({ fallbackUrl: '/admin' })));

    expect(result.toString()).toBe('/admin');
    expect(createUrlTree).toHaveBeenCalledWith(['/admin']);
  });

  it('waits for flags readiness before deciding', () => {
    flags$.next({ enablePhotoAlbums: { enabled: false } });
    const results: any[] = [];
    const subscription = guard.canActivate(route()).subscribe(result => results.push(result));

    expect(results).toEqual([]);

    ready$.next(true);

    expect(results.length).toBe(1);
    expect(results[0].toString()).toBe('/photos');
    subscription.unsubscribe();
  });
});
