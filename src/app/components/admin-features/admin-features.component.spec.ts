import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminFeaturesComponent } from './admin-features.component';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { of } from 'rxjs';

describe('AdminFeaturesComponent', () => {
  let component: AdminFeaturesComponent;
  let fixture: ComponentFixture<AdminFeaturesComponent>;
  let mockFeatureFlagsService: jasmine.SpyObj<FeatureFlagsService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('FeatureFlagsService', ['getAllFeatureFlags', 'setFeatureFlag', 'getPromotedRoute']);
    spy.getAllFeatureFlags.and.returnValue(of({}));
    spy.getPromotedRoute.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
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

  it('renders one feature row per entry in featureDefs', () => {
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.feature-row');
    expect(items.length).toBe(component.featureDefs.length);
    expect(items.length).toBeGreaterThan(0);
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

  it('clicking a checkbox calls onToggle() with the new boolean value', () => {
    component.onToggle('videos', false);
    expect(mockFeatureFlagsService.setFeatureFlag).toHaveBeenCalledWith('videos', false);
  });
});