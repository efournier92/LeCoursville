import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeekAgendaComponent } from './week-agenda.component';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

function makeEvent(start: Date, type = 'birth'): RecurringEvent {
  const event = new RecurringEvent();
  event.id = `${type}-${start.getTime()}`;
  event.title = type;
  event.type = type;
  event.start = start;
  return event;
}

function changesFor(inputs: Record<string, unknown>): any {
  return Object.fromEntries(Object.keys(inputs).map(key => [key, {
    currentValue: inputs[key],
    previousValue: undefined,
    firstChange: true,
    isFirstChange: () => true,
  }]));
}

describe('WeekAgendaComponent', () => {
  let component: WeekAgendaComponent;
  let fixture: ComponentFixture<WeekAgendaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [WeekAgendaComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();

    fixture = TestBed.createComponent(WeekAgendaComponent);
    component = fixture.componentInstance;
    component.events = [];
  });

  function setup(inputs: Record<string, unknown>): void {
    Object.assign(component, inputs);
    component.ngOnChanges(changesFor(inputs));
    fixture.detectChanges();
  }

  it('preview builds three days from the anchor', () => {
    setup({
      variant: 'preview',
      anchorDate: new Date(2024, 8, 10),
      selectedDay: new Date(2024, 8, 10),
    });
    expect(component.days.length).toBe(3);
    expect(component.days[0].date).toEqual(new Date(2024, 8, 10));
    expect(component.days[2].date).toEqual(new Date(2024, 8, 12));
  });

  it('full builds twenty-one days from anchor minus seven', () => {
    setup({
      variant: 'full',
      anchorDate: new Date(2024, 8, 10),
      selectedDay: new Date(2024, 8, 10),
    });
    expect(component.days.length).toBe(21);
    expect(component.days[0].date).toEqual(new Date(2024, 8, 3));
    expect(component.days[20].date).toEqual(new Date(2024, 8, 23));
  });

  it('matches person events by month and day across years', () => {
    setup({
      variant: 'full',
      anchorDate: new Date(2024, 11, 31),
      selectedDay: new Date(2024, 11, 31),
    });
    component.events = [makeEvent(new Date(2023, 11, 31))];
    component.ngOnChanges({ events: changesFor({ events: component.events }).events });

    const day = component.days.find(d => d.date.getTime() === new Date(2024, 11, 31).getTime());
    expect(day?.events.length).toBe(1);
  });

  it('locks holidays to the same full date', () => {
    setup({
      variant: 'full',
      anchorDate: new Date(2024, 11, 31),
      selectedDay: new Date(2024, 11, 31),
    });
    component.events = [makeEvent(new Date(2023, 11, 31), 'holiday')];
    component.ngOnChanges({ events: changesFor({ events: component.events }).events });

    const day = component.days.find(d => d.date.getTime() === new Date(2024, 11, 31).getTime());
    expect(day?.events.length).toBe(0);
  });

  it('preserves the window when events change', () => {
    setup({
      variant: 'full',
      anchorDate: new Date(2024, 8, 10),
      selectedDay: new Date(2024, 8, 10),
    });
    component.events = [makeEvent(new Date(2024, 8, 10))];
    component.ngOnChanges({ events: changesFor({ events: component.events }).events });
    expect(component.start).toEqual(new Date(2024, 8, 3));
    expect(component.days.length).toBe(21);
  });

  it('full loadLater appends seven days', () => {
    setup({
      variant: 'full',
      anchorDate: new Date(2024, 8, 10),
      selectedDay: new Date(2024, 8, 10),
    });
    component.loadLater();
    expect(component.count).toBe(28);
    expect(component.days.length).toBe(28);
  });

  it('hides the inner title when the host supplies its own', () => {
    setup({
      variant: 'full',
      anchorDate: new Date(2024, 8, 10),
      selectedDay: new Date(2024, 8, 10),
    });
    (component as any).hideTitle = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.week-agenda-title')).toBeNull();
    expect(fixture.nativeElement.querySelector('.week-agenda-range')).not.toBeNull();
  });
});
