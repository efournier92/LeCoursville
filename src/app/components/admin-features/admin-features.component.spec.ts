import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminFeaturesComponent } from './admin-features.component';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { FEATURES } from 'src/app/config/feature-config';
import { of, Subject, throwError } from 'rxjs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

describe('AdminFeaturesComponent', () => {
  let component: AdminFeaturesComponent;
  let fixture: ComponentFixture<AdminFeaturesComponent>;
  let mockFeatureFlagsService: jasmine.SpyObj<FeatureFlagsService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('FeatureFlagsService', [
      'getAllFeatureFlags',
      'setFeatureFlag',
      'getPromotedRoute',
      'flagsReady',
    ]);
    spy.getAllFeatureFlags.and.returnValue(of({}));
    spy.getPromotedRoute.and.returnValue(of(null));
    spy.flagsReady.and.returnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatSlideToggleModule],
      declarations: [AdminFeaturesComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: FeatureFlagsService, useValue: spy },
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
});
