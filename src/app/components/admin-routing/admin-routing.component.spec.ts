import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminRoutingComponent } from './admin-routing.component';
import { RoutingService } from 'src/app/services/routing.service';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { of } from 'rxjs';

describe('AdminRoutingComponent', () => {
  let component: AdminRoutingComponent;
  let fixture: ComponentFixture<AdminRoutingComponent>;
  let mockRoutingService: jasmine.SpyObj<RoutingService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('RoutingService', [
      'NavigateToAdminUsers',
      'NavigateToAdminCalendar',
      'NavigateToAdminMedia',
      'NavigateToAdminFeatures',
    ]);

    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [AdminRoutingComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: RoutingService, useValue: spy },
        { provide: FeatureFlagsService, useValue: { getPromotedRoute: () => of(null) } },
      ]
    }).compileComponents();

    mockRoutingService = TestBed.inject(RoutingService) as jasmine.SpyObj<RoutingService>;
    fixture = TestBed.createComponent(AdminRoutingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('New "Features" button toggle is present in the template', () => {
    const featuresButton = fixture.nativeElement.querySelector('mat-button-toggle:nth-child(4)');
    expect(featuresButton).toBeTruthy();
  });

  it('Clicking "Features" toggle calls onClickFeaturesRoute()', () => {
    const featuresButton = fixture.nativeElement.querySelector('mat-button-toggle:nth-child(4)');
    featuresButton.click();
    fixture.detectChanges();
    expect(mockRoutingService.NavigateToAdminFeatures).toHaveBeenCalled();
  });

  it('onClickFeaturesRoute() calls routingService.NavigateToAdminFeatures()', () => {
    component.onClickFeaturesRoute();
    expect(mockRoutingService.NavigateToAdminFeatures).toHaveBeenCalled();
  });
});