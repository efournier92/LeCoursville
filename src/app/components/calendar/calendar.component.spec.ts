import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { CalendarComponent } from './calendar.component';
import { CalendarService, Months } from 'src/app/services/calendar.service';
import { AuthService } from 'src/app/services/auth.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { DismissOnOutsideDirective } from 'src/app/directives/dismiss-on-outside.directive';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;
  let mockCalendarService: jasmine.SpyObj<CalendarService>;
  let mockAnalyticsService: jasmine.SpyObj<AnalyticsService>;

  beforeEach(() => {
    mockCalendarService = jasmine.createSpyObj('CalendarService', ['getViewYears', 'updateEvents']);
    mockCalendarService.getViewYears.and.returnValue([2023, 2024, 2025, 2026, 2027, 2028, 2029]);
    mockCalendarService.updateEvents.and.callFake((events: any[]) => events);
    mockCalendarService.calendarEventsObservable = of([]);
    mockAnalyticsService = jasmine.createSpyObj('AnalyticsService', ['logEvent']);

    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, DismissOnOutsideDirective],
      declarations: [CalendarComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: AuthService, useValue: { userObservable: of({}) } },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    // UI constants come from the service module; pin them so the component
    // behaves identically regardless of module-load order in the test bundle.
    component.months = Months;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('initializes the view to the current month and year', () => {
    const now = new Date();
    expect(component.selectedYear).toBe(now.getFullYear());
    expect(component.viewMonth).toBe(Months[now.getMonth()]);
  });

  it('navigateYear moves the picker year forward and backward', () => {
    const start = component.pickerYear;
    component.navigateYear(1);
    expect(component.pickerYear).toBe(start + 1);
    component.navigateYear(-2);
    expect(component.pickerYear).toBe(start - 1);
  });

  it('toggleBirthdays re-filters events and logs analytics', () => {
    component.allEvents = [];
    component.toggleBirthdays({ checked: false });
    expect(mockCalendarService.updateEvents).toHaveBeenCalled();
    expect(mockAnalyticsService.logEvent).toHaveBeenCalledWith('calendar_toggle_birthdays', jasmine.any(Object));
  });

  it('toggles the month picker from the pill', () => {
    component.status = 'ready';
    fixture.detectChanges();
    const pill = fixture.nativeElement.querySelector('.calendar-month-year-pill') as HTMLButtonElement;

    pill.click();
    fixture.detectChanges();
    expect(component.datePickerOpen).toBe(true);
    expect(fixture.nativeElement.querySelector('.calendar-datepicker-panel')).toBeTruthy();

    pill.click();
    fixture.detectChanges();
    expect(component.datePickerOpen).toBe(false);
  });

  it('closes the month picker on an outside pointerdown', () => {
    component.status = 'ready';
    component.datePickerOpen = true;
    fixture.detectChanges();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(component.datePickerOpen).toBe(false);
    expect(fixture.nativeElement.querySelector('.calendar-datepicker-panel')).toBeFalsy();
  });

  it('closes the month picker on Escape and returns focus to the pill', () => {
    component.status = 'ready';
    component.datePickerOpen = true;
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(component.datePickerOpen).toBe(false);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.calendar-month-year-pill'));
  });

  it('closes the month picker after selecting a month', () => {
    component.status = 'ready';
    component.datePickerOpen = true;
    fixture.detectChanges();

    const cell = fixture.nativeElement.querySelectorAll('.calendar-datepicker-cell')[1] as HTMLElement;
    cell.click();
    fixture.detectChanges();

    expect(component.datePickerOpen).toBe(false);
  });
});
