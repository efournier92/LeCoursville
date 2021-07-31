import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoPlayerDriveIframeComponent } from './video-player-drive-iframe.component';

describe('VideoPlayerDriveIframeComponent', () => {
  let component: VideoPlayerDriveIframeComponent;
  let fixture: ComponentFixture<VideoPlayerDriveIframeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VideoPlayerDriveIframeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VideoPlayerDriveIframeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
