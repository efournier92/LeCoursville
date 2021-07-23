import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaTypesRadioSelectorComponent } from './media-types-radio-selector.component';

describe('MediaTypesRadioSelectorComponent', () => {
  let component: MediaTypesRadioSelectorComponent;
  let fixture: ComponentFixture<MediaTypesRadioSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaTypesRadioSelectorComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaTypesRadioSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
