import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { CalendarViewComponent } from './calendar-view.component';
import { CalendarAgendaSheetComponent } from '../calendar-agenda-sheet/calendar-agenda-sheet.component';

function change<T>(value: T): any {
  return { currentValue: value, previousValue: value, firstChange: false, isFirstChange: () => false };
}

describe('CalendarViewComponent', () => {
  let component: CalendarViewComponent;
  let fixture: ComponentFixture<CalendarViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule],
      declarations: [CalendarViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarViewComponent);
    component = fixture.componentInstance;
    component.viewDate = new Date(2024, 6, 1);
    component.selectedYear = 2024;
    component.events = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('tears down the user subscription on destroy', () => {
    component.ngOnDestroy();

    expect((component as any).userSub.closed).toBe(true);
  });

  it('getHiddenEventCount returns 0 for a day with few events', () => {
    const day = {
      date: new Date(2024, 6, 1),
      events: [{ date: new Date(2024, 6, 2) }],
    };
    expect(component.getHiddenEventCount(day)).toBe(0);
  });

  it('getHiddenEventCount caps visible events per cell', () => {
    const day = {
      date: new Date(2024, 6, 1),
      events: [1, 2, 3, 4, 5, 6].map(i => ({ date: new Date(2024, 6, i) })),
    };
    expect(component.getHiddenEventCount(day)).toBe(2);
  });

  it('onDaySelect moves selectedDay and agendaAnchor', () => {
    component.agendaAnchor = new Date(2024, 6, 1);
    component.onDaySelect({ date: new Date(2024, 6, 15) });
    expect(component.selectedDay).toEqual(new Date(2024, 6, 15));
    expect(component.agendaAnchor).toEqual(new Date(2024, 6, 15));
  });

  it('changing events does not reset selectedDay or agendaAnchor', () => {
    component.selectedDay = new Date(2024, 6, 15);
    component.agendaAnchor = new Date(2024, 6, 15);
    component.events = [];
    component.ngOnChanges({ events: change([]) });
    expect(component.selectedDay).toEqual(new Date(2024, 6, 15));
    expect(component.agendaAnchor).toEqual(new Date(2024, 6, 15));
  });

  it('changing viewDate resets selectedDay and agendaAnchor', () => {
    component.selectedDay = new Date(2024, 6, 15);
    component.agendaAnchor = new Date(2024, 6, 15);
    component.viewDate = new Date(2024, 8, 1);
    component.ngOnChanges({ viewDate: change(component.viewDate) });
    expect(component.selectedDay).toEqual(new Date(2024, 8, 1));
    expect(component.agendaAnchor).toEqual(new Date(2024, 8, 1));
  });

  it('onTimelineDaySelect moves selectedDay and agendaAnchor', () => {
    component.onTimelineDaySelect(new Date(2024, 6, 20));
    expect(component.selectedDay).toEqual(new Date(2024, 6, 20));
    expect(component.agendaAnchor).toEqual(new Date(2024, 6, 20));
  });

  it('openFullAgenda keeps the full-screen sheet on mobile', () => {
    component.isMobile = true;
    const open = spyOn(component.dialog, 'open').mockReturnValue({} as any);

    component.openFullAgenda();

    const config = open.mock.calls[0][1] as any;
    expect(config.panelClass).toBe('calendar-agenda-sheet');
    expect(config.disableClose).toBe(true);
  });

  it('openFullAgenda routes the mobile sheet day selection back to the grid', () => {
    component.isMobile = true;
    const open = spyOn(component.dialog, 'open').mockReturnValue({} as any);
    component.openFullAgenda();

    const config = open.mock.calls[0][1] as any;
    config.data.onDaySelect(new Date(2024, 6, 20));

    expect(component.selectedDay).toEqual(new Date(2024, 6, 20));
    expect(component.agendaAnchor).toEqual(new Date(2024, 6, 20));
  });
});
