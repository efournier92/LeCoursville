import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, Subject } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminComponent } from './admin.component';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { RoutingService } from '../../services/routing.service';
import { AdminBadgeService } from '../../services/admin-badge.service';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  let flags$: Subject<Record<string, any>>;
  let pendingUploads$: Subject<number>;
  let openRecovery$: Subject<number>;

  beforeEach(async () => {
    flags$ = new Subject();
    pendingUploads$ = new Subject();
    openRecovery$ = new Subject();
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ AdminComponent ],
      providers: [
        {
          provide: FeatureFlagsService,
          useValue: { getAllFeatureFlags: () => flags$, getPromotedRoute: () => of(null) },
        },
        {
          provide: AdminBadgeService,
          useValue: {
            pendingUploads: () => pendingUploads$,
            openRecoveryRequests: () => openRecovery$,
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the skeleton until flags emit, then the nav table', () => {
    fixture.detectChanges();
    const nav = fixture.nativeElement.querySelector('[data-testid="admin-nav"]');
    expect(nav.getAttribute('aria-busy')).toBe('true');
    expect(nav.querySelectorAll('.admin-nav-skeleton .skeleton-row').length).toBe(9);
    expect(nav.querySelectorAll('.sidebar-nav').length).toBe(0);

    flags$.next({});
    fixture.detectChanges();
    expect(nav.getAttribute('aria-busy')).toBe('false');
    expect(nav.querySelectorAll('.admin-nav-skeleton').length).toBe(0);
    expect(nav.querySelectorAll('.sidebar-group').length).toBe(3);
    expect(nav.querySelectorAll('[data-testid^="admin-nav-link-"]').length).toBe(10);
  });

  it('renders no badges at zero', () => {
    fixture.detectChanges();
    flags$.next({});
    pendingUploads$.next(0);
    openRecovery$.next(0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="admin-nav-badge-uploads"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="admin-nav-badge-recovery"]')).toBeNull();
  });

  it('shows upload and recovery counts with an accessible label', () => {
    fixture.detectChanges();
    flags$.next({});
    pendingUploads$.next(3);
    openRecovery$.next(2);
    fixture.detectChanges();

    const uploads = fixture.nativeElement.querySelector('[data-testid="admin-nav-badge-uploads"]');
    expect(uploads.textContent).toContain('3');
    expect(uploads.textContent).toContain('3 pending');
    const recovery = fixture.nativeElement.querySelector('[data-testid="admin-nav-badge-recovery"]');
    expect(recovery.textContent).toContain('2 open');
  });

  it('renders a "!" badge with an accessible label when a listener fails', () => {
    fixture.detectChanges();
    flags$.next({});
    pendingUploads$.error(new Error('permission denied'));
    fixture.detectChanges();

    const uploads = fixture.nativeElement.querySelector('[data-testid="admin-nav-badge-uploads"]');
    expect(uploads.textContent).toContain('!');
    expect(uploads.textContent).toContain('Pending uploads count unavailable');
    expect(uploads.getAttribute('class')).toContain('nav-badge-error');
  });

  it('caps a badge at 99+', () => {
    fixture.detectChanges();
    flags$.next({});
    pendingUploads$.next(150);
    fixture.detectChanges();

    const uploads = fixture.nativeElement.querySelector('[data-testid="admin-nav-badge-uploads"]');
    expect(uploads.textContent).toContain('99+');
    expect(uploads.textContent).toContain('99+ pending');
  });

  it('unsubscribes the badge listeners on destroy', () => {
    fixture.detectChanges();
    expect(pendingUploads$.observed).toBe(true);

    fixture.destroy();

    expect(pendingUploads$.observed).toBe(false);
    expect(openRecovery$.observed).toBe(false);
  });

  it('closes the drawer on Escape', () => {
    fixture.detectChanges();
    const routing = TestBed.inject(RoutingService);
    const closeSpy = vi.spyOn(routing, 'closeSidenav');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closeSpy).toHaveBeenCalled();
  });

  it('makes the page content inert while the drawer is open', () => {
    fixture.detectChanges();
    flags$.next({});
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('#admin-content') as HTMLElement;
    const routing = TestBed.inject(RoutingService);

    expect(content.hasAttribute('inert')).toBe(false);

    routing.openSidenav();
    fixture.detectChanges();
    expect(content.hasAttribute('inert')).toBe(true);

    routing.closeSidenav();
    fixture.detectChanges();
    expect(content.hasAttribute('inert')).toBe(false);
  });

  it('focuses the first nav link when the drawer opens below 992px', async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    fixture.detectChanges();
    flags$.next({});
    fixture.detectChanges();

    const firstLink = fixture.nativeElement.querySelector('[data-testid^="admin-nav-link-"]') as HTMLElement;
    const focusSpy = vi.spyOn(firstLink, 'focus');

    TestBed.inject(RoutingService).openSidenav();
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(focusSpy).toHaveBeenCalled();
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });

  it('focuses the sidebar container while the nav is still loading', async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    fixture.detectChanges();
    // Flags have not emitted: the nav is a skeleton, so there is no link to
    // focus and focus must not stay on the toggle behind the scrim.
    const sidebar = fixture.nativeElement.querySelector('#admin-sidebar') as HTMLElement;
    expect(sidebar.getAttribute('tabindex')).toBe('-1');
    const focusSpy = vi.spyOn(sidebar, 'focus');

    TestBed.inject(RoutingService).openSidenav();
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(focusSpy).toHaveBeenCalled();
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });

  it('traps Tab inside the sidebar, including the logo link', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    fixture.detectChanges();
    flags$.next({});
    fixture.detectChanges();
    TestBed.inject(RoutingService).openSidenav();
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector('.admin-sidebar') as HTMLElement;
    const logo = sidebar.querySelector('.logo-link') as HTMLElement;
    const last = sidebar.querySelectorAll<HTMLElement>('[data-testid^="admin-nav-link-"]');
    const lastLink = last[last.length - 1];

    const logoFocus = vi.spyOn(logo, 'focus');
    Object.defineProperty(document, 'activeElement', { value: lastLink, configurable: true });
    lastLink.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(logoFocus).toHaveBeenCalled();

    const lastFocus = vi.spyOn(lastLink, 'focus');
    Object.defineProperty(document, 'activeElement', { value: logo, configurable: true });
    logo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(lastFocus).toHaveBeenCalled();

    delete (document as any).activeElement;
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });
});
