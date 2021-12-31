import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaVideoComponent } from './media-video.component';

describe('MediaVideoComponent', () => {
  let component: MediaVideoComponent;
  let fixture: ComponentFixture<MediaVideoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaVideoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
