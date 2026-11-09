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

  it('normalizes Drive view and edit links to the embeddable preview URL', () => {
    const cases: Array<[string, string]> = [
      ['https://drive.google.com/file/d/abc123/view', 'https://drive.google.com/file/d/abc123/preview'],
      ['https://drive.google.com/file/d/abc123/edit?usp=sharing', 'https://drive.google.com/file/d/abc123/preview'],
      ['https://docs.google.com/open?id=abc123', 'https://drive.google.com/file/d/abc123/preview'],
    ];
    for (const [input, expected] of cases) {
      const video = makeVideo();
      video.urls.download = input;
      component.video = video;
      component.events = of(video);
      component.ngOnInit();
      const sanitized = component.videoUrl as any;
      expect(sanitized.changingThisBreaksApplicationSecurity).toBe(expected);
    }
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
