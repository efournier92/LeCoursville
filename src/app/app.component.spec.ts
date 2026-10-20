import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../test-shared.module';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';
import { RoutingService } from './services/routing.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [
        AppComponent
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the app shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('mat-toolbar')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('isSuperAdmin is true only for supers', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    app.user = { id: 'u1', roles: { user: true, admin: true, super: false } } as any;
    expect(app.isSuperAdmin()).toBe(false);
    app.user = { id: 'u2', roles: { user: true, super: true } } as any;
    expect(app.isSuperAdmin()).toBe(true);
    app.user = undefined;
    expect(app.isSuperAdmin()).toBe(false);
  });

  it('wires the admin nav toggle to the drawer state', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const routing = TestBed.inject(RoutingService);
    vi.spyOn(routing, 'isOnAdminRoute').mockReturnValue(true);
    routing.openSidenav();
    fixture.detectChanges();
    app.authResolved = true;
    app.user = { id: 'u1', roles: { user: true, super: true } } as any;

    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('[data-testid="nav-menu-toggle"]');
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-controls')).toBe('admin-sidebar');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    routing.closeSidenav();
  });
});
