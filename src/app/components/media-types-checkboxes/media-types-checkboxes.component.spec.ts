import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { MediaTypesCheckboxesComponent } from './media-types-checkboxes.component';

describe('MediaTypesRadioSelectorComponent', () => {
  let component: MediaTypesCheckboxesComponent;
  let fixture: ComponentFixture<MediaTypesCheckboxesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaTypesCheckboxesComponent ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaTypesCheckboxesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // MediaType constants are shared singletons; never leak a selected state.
    component.allTypes.forEach(type => (type.isSelected = false));
  });

  it('renders one checkbox per visible type', () => {
    const boxes = fixture.nativeElement.querySelectorAll('mat-checkbox');

    expect(boxes.length).toBe(component.allTypes.length);
    expect(component.allTypes.length).toBeGreaterThan(0);
    expect(boxes[0].textContent).toContain(component.allTypes[0].name);
  });

  it('toggles each type and emits the cumulative selected ids', () => {
    const emitted: string[][] = [];
    component.selectMediaTypeEvent.subscribe(ids => emitted.push(ids));

    const boxes = fixture.nativeElement.querySelectorAll('mat-checkbox');
    component.allTypes.forEach((type, index) => {
      (boxes[index] as HTMLElement).click();
      expect(emitted.length).toBe(index + 1);
      expect(emitted[index]).toContain(type.id);
    });

    expect(component.allTypes.every(type => type.isSelected)).toBe(true);
    expect(emitted[emitted.length - 1]).toEqual(
      component.allTypes.map(type => type.id),
    );
  });
});
