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
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });

  function album(): any {
    return { id: 'album-1', title: 'Home', artist: 'Family', urls: {}, listing: [] };
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
  });
});
