import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { RoutingService } from './routing.service';

describe('RoutingService', () => {
  let service: RoutingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
    });
    service = TestBed.inject(RoutingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('NavigateToAdminFeatures() navigates to /admin/features', () => {
    const navigateSpy = spyOn(service, 'NavigateToRoute');
    service.NavigateToAdminFeatures();
    expect(navigateSpy).toHaveBeenCalledWith('/admin/features');
  });
});