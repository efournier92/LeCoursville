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

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
