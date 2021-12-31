import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaAudioComponent } from './media-audio.component';

describe('AudioComponent', () => {
  let component: MediaAudioComponent;
  let fixture: ComponentFixture<MediaAudioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaAudioComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaAudioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
