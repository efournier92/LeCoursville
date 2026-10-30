import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { VersionService } from './services/version.service';
import { ErrorsService } from './errors.service';
import { User, isApprovedUser } from './models/user';
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
  layout = 'default';

  get sidenavOpen$() {
    return this.routingService.sidenavOpen$;
  }

  constructor(
    private authService: AuthService,
    private versionService: VersionService,
    private errorsService: ErrorsService,
    private routingService: RoutingService,
    private router: Router,
    private route: ActivatedRoute,
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
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.readLayout());
    this.readLayout();
    this.versionService.writeVersionToWindow();
    this.errorsService.listenForErrors(this.user);
    this.errorsService.checkForNoInputsOnLogin(this.user);
  }

  // HELPERS

  // Route data is declared on the lazy parent route, so walk from the deepest
  // activated route back up until a layout declaration is found.
  private readLayout(): void {
    let snapshot = this.route.snapshot;
    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
    }
    while (snapshot) {
      if (snapshot.data['layout']) {
        this.layout = snapshot.data['layout'];
        return;
      }
      snapshot = snapshot.parent as typeof snapshot;
    }
    this.layout = 'default';
  }

  private shouldNavigateToPromotedRoute(): boolean {
    return this.isSignedIn(this.user) && this.routingService.IsRootRoute();
  }

  private isSignedIn(user: User): boolean {
    return !!user?.id;
  }

  isApproved(): boolean {
    return isApprovedUser(this.user);
  }

  isPending(): boolean {
    return this.isSignedIn(this.user) && !this.isApproved();
  }

  isSuperAdmin(): boolean {
    return this.user?.roles?.super === true;
  }

  onLogoClick(): void {
    this.routingService.handleLogoNavigation(this.isSuperAdmin());
  }

  onMenuClick(): void {
    this.routingService.toggleSidenav();
  }

  onSkipToContent(event: Event): void {
    // A bare hash href would be treated as a router navigation; move focus
    // and scroll directly instead.
    event.preventDefault();
    const target = document.getElementById('admin-content');
    target?.focus();
    target?.scrollIntoView({ block: 'start' });
  }

  shouldShowSidenavToggle(): boolean {
    return this.isSuperAdmin() && this.routingService.isOnAdminRoute();
  }
}
