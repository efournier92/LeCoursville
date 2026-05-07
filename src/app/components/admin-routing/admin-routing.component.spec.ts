import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminRoutingComponent } from './admin-routing.component';
import { RoutingService } from 'src/app/services/routing.service';

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
      declarations: [AdminRoutingComponent],
      providers: [
        { provide: RoutingService, useValue: spy },
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