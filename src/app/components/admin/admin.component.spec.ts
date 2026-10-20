import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { AdminComponent } from './admin.component';
import { FeatureFlagsService } from '../../services/feature-flags.service';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [ AdminComponent ],
      providers: [
        {
          provide: FeatureFlagsService,
          useValue: { getAllFeatureFlags: () => of({}), getPromotedRoute: () => of(null) },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the sidebar from the nav table', () => {
    const nav = fixture.nativeElement.querySelector('[data-testid="admin-nav"]');
    expect(nav).toBeTruthy();
    expect(nav.querySelectorAll('.sidebar-group').length).toBe(3);
    expect(nav.querySelectorAll('[data-testid^="admin-nav-link-"]').length).toBe(8);
  });
});
