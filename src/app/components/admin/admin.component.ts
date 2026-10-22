import { ChangeDetectorRef, Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { VersionService } from 'src/app/services/version.service';
import { RoutingService } from 'src/app/services/routing.service';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { AdminBadgeService } from 'src/app/services/admin-badge.service';
import { ADMIN_NAV_GROUPS, AdminNavGroup, AdminNavItem, AdminRouteKey, visibleAdminNav } from 'src/app/admin/admin-nav';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminComponent implements OnInit, OnDestroy {
  user: User;
  version: string;
  isNavReady = false;
  navGroups: { name: AdminNavGroup; items: AdminNavItem[] }[] = this.buildNavGroups(null);
  sidenavOpen = false;
  pendingUploads = 0;
  openRecoveryRequests = 0;
  private sidenavSub: Subscription;
  private userSub: Subscription;
  private flagsSub: Subscription;
  private badgeSubs: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private versionService: VersionService,
    private routingService: RoutingService,
    private featureFlagsService: FeatureFlagsService,
    private adminBadgeService: AdminBadgeService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.setVersion();
    this.flagsSub = this.featureFlagsService.getAllFeatureFlags().subscribe(flags => {
      this.navGroups = this.buildNavGroups(flags);
      this.isNavReady = true;
    });
    this.sidenavSub = this.routingService.sidenavOpen$.subscribe(open => this.onSidenavChange(open));
    this.watchBadges();
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.flagsSub?.unsubscribe();
    this.sidenavSub?.unsubscribe();
    this.badgeSubs.forEach(sub => sub.unsubscribe());
  }

  private watchBadges(): void {
    this.badgeSubs.push(
      this.adminBadgeService.pendingUploads().subscribe({
        next: count => this.pendingUploads = count,
        error: () => this.pendingUploads = 0,
      }),
      this.adminBadgeService.openRecoveryRequests().subscribe({
        next: count => this.openRecoveryRequests = count,
        error: () => this.openRecoveryRequests = 0,
      }),
    );
  }

  badgeCount(key: AdminRouteKey): number {
    if (key === 'uploads') {
      return this.pendingUploads;
    }
    return key === 'recovery' ? this.openRecoveryRequests : 0;
  }

  badgeText(count: number): string {
    return count > 99 ? '99+' : String(count);
  }

  badgeLabel(key: AdminRouteKey, count: number): string {
    return `${this.badgeText(count)} ${key === 'recovery' ? 'open' : 'pending'}`;
  }

  private buildNavGroups(flags: Record<string, { enabled?: boolean } | undefined> | null) {
    return ADMIN_NAV_GROUPS.map(name => ({
      name,
      items: visibleAdminNav(flags).filter(item => item.group === name),
    }));
  }

  private subscribeToUserObservable(): void {
    this.userSub = this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private setVersion(): void {
    this.version = this.versionService.getAppVersion();
  }

  toggleSidenav(): void {
    this.routingService.toggleSidenav();
  }

  closeSidenav(): void {
    this.routingService.closeSidenav();
  }

  private onSidenavChange(open: boolean): void {
    this.sidenavOpen = open;
    if (open && window.innerWidth < 992) {
      // Apply the open class before focusing: a link inside a
      // visibility:hidden drawer cannot take focus.
      this.cdr.detectChanges();
      document.querySelector<HTMLElement>('[data-testid^="admin-nav-link-"]')?.focus();
    } else if (!open && document.activeElement?.closest('.admin-sidebar')) {
      this.focusMenuToggle();
    }
  }

  private focusMenuToggle(): void {
    document.querySelector<HTMLElement>('[data-testid="nav-menu-toggle"]')?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      const wasOpen = this.sidenavOpen;
      this.routingService.closeSidenav();
      if (wasOpen) {
        this.focusMenuToggle();
      }
      return;
    }
    if (event.key !== 'Tab' || !this.sidenavOpen || window.innerWidth >= 992) {
      return;
    }
    if (!(event.target as HTMLElement)?.closest('.admin-sidebar')) {
      return;
    }
    const focusable = Array.from(document.querySelectorAll<HTMLElement>(
      '.admin-sidebar a, .admin-sidebar button, .admin-sidebar input, .admin-sidebar select, .admin-sidebar textarea, .admin-sidebar [tabindex]:not([tabindex="-1"])',
    )).filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) {
      return;
    }
    // Move focus ourselves in both directions: browsers differ on whether
    // anchors join sequential focus navigation (WebKit is the strict one).
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    if (index === -1) {
      return;
    }
    event.preventDefault();
    const next = event.shiftKey
      ? (index - 1 + focusable.length) % focusable.length
      : (index + 1) % focusable.length;
    focusable[next].focus();
  }
}
