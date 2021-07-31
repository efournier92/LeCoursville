import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaTypesCheckboxesComponent } from './media-types-checkboxes.component';

describe('MediaTypesRadioSelectorComponent', () => {
  let component: MediaTypesCheckboxesComponent;
  let fixture: ComponentFixture<MediaTypesCheckboxesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaTypesCheckboxesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaTypesCheckboxesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
