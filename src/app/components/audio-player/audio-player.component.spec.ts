import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { vi } from 'vitest';

import { AudioPlayerComponent } from './audio-player.component';

describe('AudioPlayerComponent', () => {
  let component: AudioPlayerComponent;
  let fixture: ComponentFixture<AudioPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestSharedModule],
      declarations: [ AudioPlayerComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AudioPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });

  function album(): any {
    return { id: 'album-1', title: 'Home', artist: 'Family', urls: {}, listing: [] };
  }

  function setupTracks(): HTMLAudioElement {
    component.tracks = [
      { title: 'First', artist: 'A', url: '/first.mp3' },
      { title: 'Second', artist: 'B', url: '/second.mp3' },
    ];
    component.currentTrack = component.tracks[0];
    fixture.detectChanges();
    return component.mediaElement.nativeElement;
  }

  it('renders the album title and artist', () => {
    component.album = album();
    component.ngOnChanges();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.album-name-container').textContent.trim(),
    ).toBe('Home');
    expect(
      fixture.nativeElement.querySelector('.artist-name-container').textContent.trim(),
    ).toBe('Family');
  });

  it('sets the clicked track as the current track', () => {
    component.album = album();
    component.tracks = [
      { title: 'First', artist: 'A', url: '/first.mp3' },
      { title: 'Second', artist: 'B', url: '/second.mp3' },
    ];
    component.currentTrack = component.tracks[0];
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.audio-player-track');
    expect(buttons.length).toBe(2);

    (buttons[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.currentTrack).toEqual(component.tracks[1]);
    expect(buttons[1].classList).toContain('active');
    expect(buttons[0].classList).not.toContain('active');
    expect(buttons[1].getAttribute('aria-current')).toBe('true');
    expect(buttons[0].hasAttribute('aria-current')).toBe(false);
  });

  it('plays and pauses the media element from the transport button', () => {
    const audio = setupTracks();
    const button = fixture.nativeElement.querySelector('.audio-player-toggle') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(audio.play).toHaveBeenCalled();
    expect(component.isPlaying).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    fixture.detectChanges();

    expect(audio.pause).toHaveBeenCalled();
    expect(component.isPlaying).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('reflects timeupdate in the elapsed label and seek slider', () => {
    const audio = setupTracks();
    audio.currentTime = 42;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 100 });

    audio.dispatchEvent(new Event('timeupdate'));
    fixture.detectChanges();

    const elapsed = fixture.nativeElement.querySelector('.audio-player-elapsed');
    const seek = fixture.nativeElement.querySelector('.audio-player-seek') as HTMLInputElement;

    expect(elapsed.textContent.trim()).toBe('0:42');
    expect(seek.value).toBe('42');
    expect(seek.getAttribute('aria-valuetext')).toBe('0:42 of 1:40');
  });

  it('loads and plays a track when it is selected', () => {
    const audio = setupTracks();

    component.selectTrack(component.tracks[1]);
    fixture.detectChanges();

    expect(component.currentTrack).toEqual(component.tracks[1]);
    expect(audio.load).toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalled();
    expect(audio.src).toContain('/second.mp3');
  });

  it('advances to the next track when the current one ends', () => {
    const audio = setupTracks();
    const play = audio.play as unknown as ReturnType<typeof vi.fn>;
    play.mockClear();

    audio.dispatchEvent(new Event('ended'));
    fixture.detectChanges();

    expect(component.currentTrack).toEqual(component.tracks[1]);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('stops paused at the end when the last track ends', () => {
    const audio = setupTracks();
    component.selectTrack(component.tracks[1]);
    fixture.detectChanges();
    (audio.pause as unknown as ReturnType<typeof vi.fn>).mockClear();

    audio.dispatchEvent(new Event('ended'));
    fixture.detectChanges();

    expect(component.currentTrack).toEqual(component.tracks[1]);
    expect(component.isPlaying).toBe(false);
    expect(component.elapsed).toBe(0);
    expect(audio.pause).toHaveBeenCalled();
  });

  it('stays paused without an unhandled rejection when autoplay is blocked', async () => {
    (HTMLMediaElement.prototype.play as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('blocked'));
    setupTracks();

    component.selectTrack(component.tracks[0]);
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.isPlaying).toBe(false);
  });

  it('seeks by setting currentTime from the range input', () => {
    const audio = setupTracks();
    component.duration = 100;
    fixture.detectChanges();
    const seek = fixture.nativeElement.querySelector('.audio-player-seek') as HTMLInputElement;

    seek.value = '30';
    seek.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(audio.currentTime).toBe(30);
    expect(component.elapsed).toBe(30);
  });
});
