import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { VideoPlayerDriveIframeComponent } from './video-player-drive-iframe.component';

function makeVideo(): any {
  return {
    id: 'video-1',
    title: 'Family Reunion',
    urls: { download: 'https://drive.google.com/file/d/abc123/view', icon: 'https://example.com/icon.jpg' },
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

  it('normalizes Drive view, edit, open, and uc links to the embeddable preview URL', () => {
    const cases: Array<[string, string]> = [
      ['https://drive.google.com/file/d/abc123/view', 'https://drive.google.com/file/d/abc123/preview'],
      ['https://drive.google.com/file/d/abc123/edit?usp=sharing', 'https://drive.google.com/file/d/abc123/preview'],
      ['https://docs.google.com/open?id=abc123', 'https://drive.google.com/file/d/abc123/preview'],
      ['https://drive.google.com/uc?id=abc123', 'https://drive.google.com/file/d/abc123/preview'],
      ['https://docs.google.com/uc?id=abc123&export=download', 'https://drive.google.com/file/d/abc123/preview'],
      [
        'https://drive.google.com/file/d/abc123/view?resourcekey=0-key',
        'https://drive.google.com/file/d/abc123/preview?resourcekey=0-key',
      ],
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

  it('fails visibly instead of trusting an unrecognized Drive URL', () => {
    const video = makeVideo();
    video.urls.download = 'https://drive.google.com/not-a-file/abc';
    component.video = video;
    component.events = of(video);
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.videoUrl).toBeNull();
    const error = fixture.nativeElement.querySelector('.video-error');
    expect(error).not.toBeNull();
    expect(error.getAttribute('role')).toBe('alert');
    expect(fixture.nativeElement.querySelector('iframe.video-iframe')).toBeNull();
    expect(fixture.nativeElement.querySelector('.video-fallback')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.video-retry-button').textContent.trim(),
    ).toBe('Try again');
  });

  it('falls back with a retry action when the embed never fires load', () => {
    fixture.destroy();
    vi.useFakeTimers();
    try {
      fixture = TestBed.createComponent(VideoPlayerDriveIframeComponent);
      component = fixture.componentInstance;
      component.video = makeVideo();
      component.events = of(makeVideo());
      fixture.detectChanges();

      expect(component.showFallback).toBe(false);
      expect(fixture.nativeElement.querySelector('iframe.video-iframe')).not.toBeNull();

      vi.advanceTimersByTime(8000);
      fixture.detectChanges();

      expect(component.showFallback).toBe(true);
      const fallback = fixture.nativeElement.querySelector('.video-fallback');
      expect(fallback).not.toBeNull();
      expect(fallback.querySelector('.video-error').getAttribute('role')).toBe('alert');
      expect(fixture.nativeElement.querySelector('iframe.video-iframe')).toBeNull();

      component.retry();
      fixture.detectChanges();
      expect(component.showFallback).toBe(false);
      expect(fixture.nativeElement.querySelector('iframe.video-iframe')).not.toBeNull();
    } finally {
      component.ngOnDestroy();
      vi.useRealTimers();
    }
  });

  it('clears the load timeout when the iframe loads', () => {
    fixture.destroy();
    vi.useFakeTimers();
    try {
      fixture = TestBed.createComponent(VideoPlayerDriveIframeComponent);
      component = fixture.componentInstance;
      component.video = makeVideo();
      component.events = of(makeVideo());
      fixture.detectChanges();

      component.onIframeLoad();
      vi.advanceTimersByTime(8000);
      fixture.detectChanges();

      expect(component.showFallback).toBe(false);
      expect(fixture.nativeElement.querySelector('iframe.video-iframe')).not.toBeNull();
    } finally {
      component.ngOnDestroy();
      vi.useRealTimers();
    }
  });

  it('gives the iframe an accessible title', () => {
    fixture.detectChanges();
    const iframe = fixture.nativeElement.querySelector('iframe.video-iframe');
    expect(iframe.getAttribute('title')).toBe('Family Reunion');
  });

  it('updates the URL when a new video is emitted through events', () => {
    const replacement = makeVideo();
    replacement.urls.download = 'https://drive.google.com/file/d/newfile/view';
    component.events = of(replacement);
    component.ngOnInit();

    const sanitized = component.videoUrl as any;
    expect(sanitized.changingThisBreaksApplicationSecurity).toContain('newfile');
  });
});
