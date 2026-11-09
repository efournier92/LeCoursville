import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { MediaTypesCheckboxesComponent } from './media-types-checkboxes.component';

describe('MediaTypesRadioSelectorComponent', () => {
  let component: MediaTypesCheckboxesComponent;
  let fixture: ComponentFixture<MediaTypesCheckboxesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatSlideToggleModule],
      declarations: [ MediaTypesCheckboxesComponent ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaTypesCheckboxesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // MediaType constants are shared singletons; never leak a selected state.
    component.allTypes.forEach(type => (type.isSelected = false));
    fixture.detectChanges();
  });

  it('renders one switch per visible type', () => {
    const hosts = fixture.nativeElement.querySelectorAll('mat-slide-toggle');
    const switches = fixture.nativeElement.querySelectorAll('button[role="switch"]');

    expect(hosts.length).toBe(component.allTypes.length);
    expect(switches.length).toBe(component.allTypes.length);
    expect(component.allTypes.length).toBeGreaterThan(0);
    expect(hosts[0].textContent).toContain(component.allTypes[0].name);
  });

  it('toggles each switch, reflects aria-checked, and emits the cumulative selected ids', () => {
    const emitted: string[][] = [];
    component.selectMediaTypeEvent.subscribe(ids => emitted.push(ids));

    const switches = fixture.nativeElement.querySelectorAll(
      'button[role="switch"]',
    ) as NodeListOf<HTMLButtonElement>;
    component.allTypes.forEach((type, index) => {
      expect(switches[index].getAttribute('aria-checked')).toBe('false');
      switches[index].click();
      fixture.detectChanges();
      expect(switches[index].getAttribute('aria-checked')).toBe('true');
      expect(emitted.length).toBe(index + 1);
      expect(emitted[index]).toContain(type.id);
    });

    expect(component.allTypes.every(type => type.isSelected)).toBe(true);
    expect(emitted[emitted.length - 1]).toEqual(
      component.allTypes.map(type => type.id),
    );
  });

  it('emits an empty selection when the last switch is turned off', () => {
    const emitted: string[][] = [];
    component.selectMediaTypeEvent.subscribe(ids => emitted.push(ids));
    const switches = fixture.nativeElement.querySelectorAll(
      'button[role="switch"]',
    ) as NodeListOf<HTMLButtonElement>;

    component.allTypes.forEach((_type, index) => {
      switches[index].click();
      fixture.detectChanges();
    });
    component.allTypes.forEach((_type, index) => {
      switches[index].click();
      fixture.detectChanges();
    });

    expect(emitted[emitted.length - 1]).toEqual([]);
  });
});
