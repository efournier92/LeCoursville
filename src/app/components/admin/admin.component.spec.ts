import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, Subject } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminComponent } from './admin.component';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { RoutingService } from '../../services/routing.service';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  let flags$: Subject<Record<string, any>>;

  beforeEach(async () => {
    flags$ = new Subject();
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ AdminComponent ],
      providers: [
        {
          provide: FeatureFlagsService,
          useValue: { getAllFeatureFlags: () => flags$, getPromotedRoute: () => of(null) },
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
    expect(nav.querySelectorAll('.admin-nav-skeleton .skeleton-row').length).toBe(8);
    expect(nav.querySelectorAll('.sidebar-nav').length).toBe(0);

    flags$.next({});
    fixture.detectChanges();
    expect(nav.getAttribute('aria-busy')).toBe('false');
    expect(nav.querySelectorAll('.admin-nav-skeleton').length).toBe(0);
    expect(nav.querySelectorAll('.sidebar-group').length).toBe(3);
    expect(nav.querySelectorAll('[data-testid^="admin-nav-link-"]').length).toBe(8);
  });

  it('closes the drawer on Escape', () => {
    fixture.detectChanges();
    const routing = TestBed.inject(RoutingService);
    const closeSpy = vi.spyOn(routing, 'closeSidenav');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closeSpy).toHaveBeenCalled();
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
