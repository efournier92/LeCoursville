import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { PhotosLegacyComponent } from './photos-legacy.component';

describe('PhotosLegacyComponent', () => {
  let component: PhotosLegacyComponent;
  let fixture: ComponentFixture<PhotosLegacyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, MatMenuModule],
      declarations: [PhotosLegacyComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PhotosLegacyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
