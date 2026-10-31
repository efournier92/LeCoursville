import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminFeaturesComponent } from './admin-features.component';
import { FeatureFlagAuditRecord, FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { AuthService } from 'src/app/services/auth.service';
import { FEATURES } from 'src/app/config/feature-config';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

describe('AdminFeaturesComponent', () => {
  let component: AdminFeaturesComponent;
  let fixture: ComponentFixture<AdminFeaturesComponent>;
  let mockFeatureFlagsService: jasmine.SpyObj<FeatureFlagsService>;
  let auditSource: BehaviorSubject<FeatureFlagAuditRecord[]>;

  beforeEach(async () => {
    auditSource = new BehaviorSubject<FeatureFlagAuditRecord[]>([]);
    const spy = jasmine.createSpyObj('FeatureFlagsService', [
      'getAllFeatureFlags',
      'setFeatureFlag',
      'getPromotedRoute',
      'setPromotedRoute',
      'addFeatureFlagAudit',
      'getFeatureFlagAudit',
      'flagsReady',
    ]);
    spy.getAllFeatureFlags.and.returnValue(of({}));
    spy.getPromotedRoute.and.returnValue(of(null));
    spy.setPromotedRoute.and.returnValue(Promise.resolve());
    spy.addFeatureFlagAudit.and.returnValue(Promise.resolve());
    spy.getFeatureFlagAudit.and.returnValue(auditSource.asObservable());
    spy.flagsReady.and.returnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatSlideToggleModule],
      declarations: [AdminFeaturesComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: FeatureFlagsService, useValue: spy },
        { provide: AuthService, useValue: { userObservable: of({ id: 'admin-1', email: 'admin@e2e.local' }) } },
      ]
    }).compileComponents();

    mockFeatureFlagsService = TestBed.inject(FeatureFlagsService) as jasmine.SpyObj<FeatureFlagsService>;
    fixture = TestBed.createComponent(AdminFeaturesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('on init, calls featureFlagsService.getAllFeatureFlags()', () => {
    expect(mockFeatureFlagsService.getAllFeatureFlags).toHaveBeenCalled();
  });

  it('renders one feature row per entry in FEATURES', () => {
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.feature-row');
    expect(items.length).toBe(FEATURES.length);
    expect(items.length).toBeGreaterThan(0);
  });

  it('gives every feature toggle an accessible name', () => {
    const toggles = Array.from(
      fixture.nativeElement.querySelectorAll('mat-slide-toggle') as NodeListOf<HTMLElement>,
    );

    expect(toggles.length).toBe(FEATURES.length);
    // The visible label sits inside the toggle, so it is the control's
    // accessible name (Material renders it as the mdc-label content).
    toggles.forEach(toggle => expect(toggle.textContent?.trim()).toBeTruthy());
  });

  it('renders the three surface group labels', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.feature-group-label') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim());
    expect(labels).toEqual(['People', 'Content', 'System']);
  });

  it('shows a loading skeleton until the flags arrive', () => {
    fixture.destroy();
    const ready$ = new Subject<boolean>();
    const flags$ = new Subject<Record<string, never>>();
    mockFeatureFlagsService.flagsReady.and.returnValue(ready$);
    mockFeatureFlagsService.getAllFeatureFlags.and.returnValue(flags$);
    fixture = TestBed.createComponent(AdminFeaturesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="features-loading"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.feature-row').length).toBe(0);

    ready$.next(true);
    flags$.next({});
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="features-loading"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelectorAll('.feature-row').length).toBe(9);
  });

  it('shows a retryable error and recovers after retrying', () => {
    fixture.destroy();
    let attempt = 0;
    mockFeatureFlagsService.getAllFeatureFlags.and.callFake(() => {
      attempt += 1;
      return attempt === 1
        ? throwError(() => new Error('offline'))
        : of({});
    });
    fixture = TestBed.createComponent(AdminFeaturesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loadError).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-load-error')).toBeTruthy();

    component.retry();
    fixture.detectChanges();

    expect(component.loadError).toBe('');
    expect(fixture.nativeElement.querySelectorAll('.feature-row').length).toBe(9);
  });

  it('isEnabled() returns true when Firebase flag is null (default ON)', () => {
    component.flagsMap = {};
    expect(component.isEnabled('music')).toBe(true);
  });

  it('isEnabled() returns true when Firebase flag has enabled: true', () => {
    component.flagsMap = { music: { enabled: true, updatedAt: Date.now() } };
    expect(component.isEnabled('music')).toBe(true);
  });

  it('isEnabled() returns false when Firebase flag has enabled: false', () => {
    component.flagsMap = { music: { enabled: false, updatedAt: Date.now() } };
    expect(component.isEnabled('music')).toBe(false);
  });

  it('onToggle() calls featureFlagsService.setFeatureFlag() with correct args', () => {
    component.onToggle('music', true);
    expect(mockFeatureFlagsService.setFeatureFlag).toHaveBeenCalledWith('music', true);
  });

  it('clicking a toggle calls onToggle() with the new boolean value', () => {
    component.onToggle('videos', false);
    expect(mockFeatureFlagsService.setFeatureFlag).toHaveBeenCalledWith('videos', false);
  });

  it('reverts the toggle and shows an error when the write is rejected', async () => {
    component.flagsMap = { music: { enabled: true, updatedAt: Date.now() } };
    fixture.detectChanges();
    mockFeatureFlagsService.setFeatureFlag.and.callFake(() => Promise.reject(new Error('offline')));

    const switchButton = fixture.nativeElement.querySelector(
      '[data-testid="feature-toggle-music"] button[role="switch"]',
    ) as HTMLButtonElement;
    expect(switchButton.getAttribute('aria-checked')).toBe('true');

    switchButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();

    expect(mockFeatureFlagsService.setFeatureFlag).toHaveBeenCalledWith('music', false);
    expect(component.isEnabled('music')).toBe(true);
    const reverted = fixture.nativeElement.querySelector(
      '[data-testid="feature-toggle-music"] button[role="switch"]',
    ) as HTMLButtonElement;
    expect(reverted.getAttribute('aria-checked')).toBe('true');
    expect(
      fixture.nativeElement.querySelector('[data-testid="features-toggle-error"]'),
    ).not.toBeNull();
  });

  it('writes one audit row per successful toggle change', async () => {
    component.flagsMap = { music: { enabled: true, updatedAt: Date.now() } };
    fixture.detectChanges();

    await component.onToggle('music', false);

    expect(mockFeatureFlagsService.addFeatureFlagAudit).toHaveBeenCalledWith(
      jasmine.objectContaining({
        flagId: 'music',
        field: 'enabled',
        from: true,
        to: false,
        actorUid: 'admin-1',
        actorEmail: 'admin@e2e.local',
      }),
    );
  });

  it('records the promoted route as the changed field', async () => {
    mockFeatureFlagsService.getPromotedRoute.and.returnValue(of('/calendar'));
    fixture.destroy();
    fixture = TestBed.createComponent(AdminFeaturesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    await component.onPromotedRouteChange('/chat');

    expect(mockFeatureFlagsService.addFeatureFlagAudit).toHaveBeenCalledWith(
      jasmine.objectContaining({
        flagId: 'promotedRoute',
        field: 'promotedRoute',
        from: '/calendar',
        to: '/chat',
        actorUid: 'admin-1',
        actorEmail: 'admin@e2e.local',
      }),
    );
  });

  it('keeps the toggle when the audit write fails and shows an inline note', async () => {
    spyOn(console, 'error');
    component.flagsMap = { music: { enabled: true, updatedAt: Date.now() } };
    mockFeatureFlagsService.addFeatureFlagAudit.and.returnValue(Promise.reject(new Error('offline')));

    await component.onToggle('music', false);
    await Promise.resolve();
    fixture.detectChanges();

    expect(mockFeatureFlagsService.setFeatureFlag).toHaveBeenCalledWith('music', false);
    expect(component.isEnabled('music')).toBe(true);
    const note = fixture.nativeElement.querySelector('[data-testid="feature-audit-notice"]');
    expect(note?.textContent).toContain('saved but could not be added to the audit trail');
  });

  it('renders the empty audit state', () => {
    expect(
      fixture.nativeElement.querySelector('[data-testid="feature-audit-empty"]')?.textContent?.trim(),
    ).toBe('No flag changes recorded yet.');
  });

  it('renders the latest ten audit changes newest first with absolute time and from/to values', () => {
    const entries: FeatureFlagAuditRecord[] = Array.from({ length: 12 }, (_, index) => ({
      flagId: index % 2 === 0 ? 'music' : 'promotedRoute',
      field: index % 2 === 0 ? 'enabled' : 'promotedRoute',
      from: index % 2 === 0 ? true : '/calendar',
      to: index % 2 === 0 ? false : '/chat',
      actorUid: `admin-${index}`,
      actorEmail: `admin-${index}@e2e.local`,
      at: new Date(2026, 0, index + 1, 9, 30).getTime(),
    }));
    auditSource.next(entries);
    fixture.detectChanges();

    expect(component.auditHistory.length).toBe(10);
    expect(component.auditHistory[0].at).toBe(entries[11].at);

    const rows = fixture.nativeElement.querySelectorAll(
      '[data-testid="feature-audit-table"] tbody tr',
    ) as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(10);
    expect(rows[0].textContent).toContain('admin-11@e2e.local');
    expect(rows[0].textContent).toContain('Promoted Route');
    expect(rows[0].textContent).toContain('/calendar');
    expect(rows[0].textContent).toContain('/chat');
    expect(rows[0].textContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    expect(rows[1].textContent).toContain('Music');
    expect(rows[1].textContent).toContain('On');
    expect(rows[1].textContent).toContain('Off');
  });

  it('reverts the promoted route and shows the toggle error when the write fails', async () => {
    mockFeatureFlagsService.getPromotedRoute.and.returnValue(of('/calendar'));
    fixture.destroy();
    fixture = TestBed.createComponent(AdminFeaturesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.promotedRoute).toBe('/calendar');

    mockFeatureFlagsService.setPromotedRoute.and.returnValue(Promise.reject(new Error('offline')));
    await component.onPromotedRouteChange('/chat');
    fixture.detectChanges();

    expect(component.promotedRoute).toBe('/calendar');
    expect(
      fixture.nativeElement.querySelector('[data-testid="features-toggle-error"]'),
    ).not.toBeNull();
    expect(mockFeatureFlagsService.addFeatureFlagAudit).not.toHaveBeenCalled();
  });

  it('warns when the selected promoted route belongs to a flag that is off', () => {
    mockFeatureFlagsService.getPromotedRoute.and.returnValue(of('/chat'));
    fixture.destroy();
    fixture = TestBed.createComponent(AdminFeaturesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.flagsMap = { chat: { enabled: false, updatedAt: Date.now() } };
    fixture.detectChanges();

    expect(component.promotedRouteWarning).toContain('Chat is currently off');
  });

  it('shows the absolute local changed time from the flag updatedAt', () => {
    component.flagsMap = {
      music: { enabled: true, updatedAt: new Date(2026, 0, 2, 3, 4).getTime() },
    };
    fixture.detectChanges();

    expect(component.changedLabel('music')).toBe('Changed Jan 2, 03:04');
  });
});
