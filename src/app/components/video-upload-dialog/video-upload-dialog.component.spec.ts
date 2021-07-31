import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoUploadDialogComponent } from './video-upload-dialog.component';

describe('VideoUploadDialogComponent', () => {
  let component: VideoUploadDialogComponent;
  let fixture: ComponentFixture<VideoUploadDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VideoUploadDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VideoUploadDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
