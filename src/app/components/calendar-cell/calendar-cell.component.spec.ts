import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { CalendarCellComponent } from './calendar-cell.component';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

function makeEvent(overrides: Partial<RecurringEvent> = {}): RecurringEvent {
  const event = new RecurringEvent();
  event.id = 'evt-1';
  event.title = 'John Doe';
  event.type = 'birth';
  event.personId = 'person-1';
  event.personId2 = null;
  event.date = new Date(1990, 5, 15);
  event.isLiving = true;
  return { ...event, ...overrides };
}

describe('CalendarCellComponent', () => {
  let component: CalendarCellComponent;
  let fixture: ComponentFixture<CalendarCellComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [CalendarCellComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarCellComponent);
    component = fixture.componentInstance;
    component.event = makeEvent();
    component.selectedYear = 2024;
    fixture.detectChanges();
  });

  it('should create and render a calendar cell', () => {
    expect(component).toBeTruthy();
  });

  describe('getPrimaryName', () => {
    it('returns the name before the " & " separator', () => {
      component.event = makeEvent({ title: 'John & Jane' });
      expect(component.getPrimaryName()).toBe('John');
    });

    it('returns the full title when there is no separator', () => {
      component.event = makeEvent({ title: 'John Doe' });
      expect(component.getPrimaryName()).toBe('John Doe');
    });
  });

  describe('getSpouseName', () => {
    it('returns the name after the " & " separator', () => {
      component.event = makeEvent({ title: 'John & Jane' });
      expect(component.getSpouseName()).toBe('Jane');
    });

    it('returns null when there is no separator', () => {
      component.event = makeEvent({ title: 'John Doe' });
      expect(component.getSpouseName()).toBeNull();
    });
  });

  describe('getYearsSinceString', () => {
    it('computes years between event year and selected year', () => {
      component.event = makeEvent({ date: new Date(1990, 5, 15) });
      expect(component.getYearsSinceString(component.event)).toBe('34');
    });
  });
});
