import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { VideoPlayerDriveIframeComponent } from './video-player-drive-iframe.component';

function makeVideo(): any {
  return {
    id: 'video-1',
    title: 'Family Reunion',
    urls: { download: 'https://drive.google.com/video.mp4', icon: 'https://example.com/icon.jpg' },
  };
}

describe('VideoPlayerDriveIframeComponent', () => {
  let component: VideoPlayerDriveIframeComponent;
  let fixture: ComponentFixture<VideoPlayerDriveIframeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VideoPlayerDriveIframeComponent]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VideoPlayerDriveIframeComponent);
    component = fixture.componentInstance;
    component.video = makeVideo();
    component.events = of(makeVideo());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds a safe resource URL from the video download link', () => {
    expect(component.videoUrl).toBeTruthy();
    const sanitized = component.videoUrl as any;
    expect(sanitized.changingThisBreaksApplicationSecurity).toContain('drive.google.com');
  });

  it('updates the URL when a new video is emitted through events', () => {
    const replacement = makeVideo();
    replacement.urls.download = 'https://drive.google.com/new.mp4';
    component.events = of(replacement);
    component.ngOnInit();

    const sanitized = component.videoUrl as any;
    expect(sanitized.changingThisBreaksApplicationSecurity).toContain('new.mp4');
  });
});
