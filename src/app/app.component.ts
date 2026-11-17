import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { VersionService } from './services/version.service';
import { ErrorsService } from './errors.service';
import { User, isApprovedUser } from './models/user';
import { RoutingService } from './services/routing.service';
import { ThemeService } from './services/theme.service';
import { filter, take } from 'rxjs/operators';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  user: User;
  // True = hamburger. Default true so unit/jsdom runs (no ResizeObserver) keep
  // the toggle the app.component.spec expects.
  navCollapsed = true;
  // True once the auth outcome is fully known: signed out, or signed in
  // with the RTDB user record loaded (authResolved$ emits then, not at
  // firebase-auth restore time — that gap flashed a wrong Sign In link).
  authResolved = false;
  layout = 'default';
  // The account page owns a labeled theme preference, so the header toggle
  // would duplicate it there. Set from Router.events, never sniffed in CSS.

  get sidenavOpen$() {
    return this.routingService.sidenavOpen$;
  }

  constructor(
    private authService: AuthService,
    private versionService: VersionService,
    private errorsService: ErrorsService,
    private routingService: RoutingService,
    private themeService: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  // RUNTIME NAV FIT

  private _toolbar?: ElementRef<HTMLElement>;
  private _navDesktop?: ElementRef<HTMLElement>;

  @ViewChild('toolbar', { read: ElementRef }) set toolbarRef(ref: ElementRef<HTMLElement> | undefined) {
    this._toolbar = ref;
    this.syncNavObserver();
  }

  @ViewChild('navDesktop') set navDesktopRef(ref: ElementRef<HTMLElement> | undefined) {
    this._navDesktop = ref;
    this.syncNavObserver();
  }

  private navObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.syncNavObserver();
  }

  ngOnDestroy(): void {
    this.navObserver?.disconnect();
  }

  private syncNavObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.navObserver?.disconnect();
    this.navObserver = new ResizeObserver(() => this.zone.run(() => this.updateNavMode()));
    const toolbar = this._toolbar?.nativeElement;
    const nav = this._navDesktop?.nativeElement;
    if (toolbar) this.navObserver.observe(toolbar);
    if (nav) this.navObserver.observe(nav);
    this.zone.run(() => this.updateNavMode());
  }

  private updateNavMode(): void {
    const toolbar = this._toolbar?.nativeElement;
    const nav = this._navDesktop?.nativeElement;
    if (!toolbar || !nav || typeof window === 'undefined' || !window.getComputedStyle) {
      this.applyNavCollapsed(true);
      return;
    }
    const style = window.getComputedStyle(toolbar);
    const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const left = toolbar.querySelector<HTMLElement>('.toolbar-left')?.getBoundingClientRect().width ?? 0;
    const theme = toolbar.querySelector<HTMLElement>('.theme-switch')?.getBoundingClientRect().width ?? 0;
    const available = toolbar.clientWidth - pad - left - theme - 10; // .icons-menu gap
    const required = nav.scrollWidth;
    if (required <= 0 || available <= 0) {
      this.applyNavCollapsed(true);
      return;
    }
    this.applyNavCollapsed(required > available - 8); // small buffer stops flicker
  }

  private applyNavCollapsed(collapsed: boolean): void {
    if (collapsed === this.navCollapsed) return;
    this.navCollapsed = collapsed;
    this.cdr.detectChanges();
  }

  get theme$() {
    return this.themeService.theme$;
  }

  // SUBSCRIPTIONS

  onThemeToggle(): void {
    this.themeService.toggle();
  }

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
      // Bounce off root at most once per app lifetime, on the first resolved
      // user emission only. Later emissions come from profile/theme writes
      // (e.g. the Account "Always dark" toggle) and must never yank someone
      // off the Account page at '/'. The auth service already redirects on
      // sign-in/restore, so this is only a one-shot safety net.
      if (!this.promotedRouteBounceDone) {
        this.promotedRouteBounceDone = true;
        // Wait for the RTDB routes so a pending user never bounces on the
        // environment default before the stored value arrives.
        this.routingService.routesReady().pipe(filter(ready => ready), take(1)).subscribe(() => {
          if (this.shouldNavigateToPromotedRoute()) {
            this.routingService.NavigateToPromotedRoute(this.isApproved());
          }
        });
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
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
      this.readLayout();
    });
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

  private promotedRouteBounceDone = false;

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
    this.routingService.handleLogoNavigation(this.isSuperAdmin(), this.isApproved());
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

  /** The root route is the sign-in card; its toolbar link would duplicate it. */
  isSignInRoute(): boolean {
    return this.routingService.IsRootRoute();
  }

  shouldShowSidenavToggle(): boolean {
    return this.isSuperAdmin() && this.routingService.isOnAdminRoute();
  }

  isAdminRoute(): boolean {
    return this.routingService.isOnAdminRoute();
  }
}
