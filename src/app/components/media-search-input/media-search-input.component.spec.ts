import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaSearchInputComponent } from './media-search-input.component';

describe('MediaSearchInputComponent', () => {
  let component: MediaSearchInputComponent;
  let fixture: ComponentFixture<MediaSearchInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaSearchInputComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaSearchInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
