import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { VersionService } from './services/version.service';
import { ErrorsService } from './errors.service';
import { User } from './models/user';
import { RoutingService } from './services/routing.service';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppComponent implements OnInit {
  user: User;
  // True once the auth outcome is fully known: signed out, or signed in
  // with the RTDB user record loaded (authResolved$ emits then, not at
  // firebase-auth restore time — that gap flashed a wrong Sign In link).
  authResolved = false;

  constructor(
    private authService: AuthService,
    private versionService: VersionService,
    private errorsService: ErrorsService,
    private routingService: RoutingService,
  ) {}

  // SUBSCRIPTIONS

  private subscribeToAuthResolved(): void {
    this.authService.authResolved$.subscribe((resolved: boolean) => {
      this.authResolved = resolved;
    });
  }

  private subscribeToUserObservable(): void {
    this.authService.userObservable.pipe(
      // userObservable seeds {} (no id); assigning it would wipe the
      // cached-user render below and flash Sign In until the RTDB record
      // lands. Only real records update the nav.
      filter((user: any) => !!user?.id),
    ).subscribe((user: User) => {
      this.user = user;
      if (this.shouldNavigateToPromotedRoute()) {
        this.routingService.NavigateToPromotedRoute();
      }
    });
  }

  ngOnInit() {
    // Cache-first nav: render the toolbar links from last session's
    // localStorage user immediately. Cosmetic only (the admin guard stays
    // RTDB-backed); the skeleton shows just for first visits. The real
    // record replaces the cache via userObservable.
    const cached = this.authService.getCachedUser();
    if (cached?.id) {
      this.user = cached;
      this.authResolved = true;
    }
    this.subscribeToAuthResolved();
    this.subscribeToUserObservable();
    this.versionService.writeVersionToWindow();
    this.errorsService.listenForErrors(this.user);
    this.errorsService.checkForNoInputsOnLogin(this.user);
  }

  // HELPERS

  private shouldNavigateToPromotedRoute(): boolean {
    return this.isSignedIn(this.user) && this.routingService.IsRootRoute();
  }

  private isSignedIn(user: User): boolean {
    return user.id && user.roles.user;
  }

  isAdminOrSuper(): boolean {
    return this.user?.roles?.admin || this.user?.roles?.super;
  }

  onLogoClick(): void {
    this.routingService.handleLogoNavigation(this.isAdminOrSuper());
  }

  onMenuClick(): void {
    this.routingService.toggleSidenav();
  }

  shouldShowSidenavToggle(): boolean {
    return this.isAdminOrSuper() && this.routingService.isOnAdminRoute();
  }
}
