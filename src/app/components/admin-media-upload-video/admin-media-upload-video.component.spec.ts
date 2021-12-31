import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminMediaUploadVideoComponent } from './admin-media-upload-video.component';

describe('AdminMediaUploadVideoComponent', () => {
  let component: AdminMediaUploadVideoComponent;
  let fixture: ComponentFixture<AdminMediaUploadVideoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminMediaUploadVideoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminMediaUploadVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
