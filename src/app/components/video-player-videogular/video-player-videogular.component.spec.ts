import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoPlayerVideogularComponent } from './video-player-videogular.component';

describe('VideoPlayerVideogularComponent', () => {
  let component: VideoPlayerVideogularComponent;
  let fixture: ComponentFixture<VideoPlayerVideogularComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VideoPlayerVideogularComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VideoPlayerVideogularComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders a native video with the download url', () => {
    component.currentVideo = { urls: { download: '/media/trip.mp4' } } as any;
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector('video.video-player-native') as HTMLVideoElement;

    expect(video).not.toBeNull();
    expect(video.getAttribute('src')).toBe('/media/trip.mp4');
    expect(video.controls).toBe(true);
    expect(fixture.nativeElement.querySelector('.video-player-empty')).toBeNull();
  });

  it('shows the no-video message when there is no download url', () => {
    component.currentVideo = {} as any;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('video')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.video-player-empty').textContent.trim(),
    ).toBe('No video available');
  });
});
