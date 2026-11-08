import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { TestSharedModule } from '../../../test-shared.module';
import { AppModule } from '../../app.module';
import { CalendarComponent } from './calendar.component';
import { CalendarCellComponent } from '../calendar-cell/calendar-cell.component';
import { CalendarService, Months } from 'src/app/services/calendar.service';
import { AuthService } from 'src/app/services/auth.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { DismissOnOutsideDirective } from 'src/app/directives/dismiss-on-outside.directive';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;
  let mockCalendarService: jasmine.SpyObj<CalendarService>;
  let mockAnalyticsService: jasmine.SpyObj<AnalyticsService>;
  let mockAuthService: any;
  let userSubject: BehaviorSubject<any>;
  let eventsSubject: BehaviorSubject<any[]>;
  let eventsLoadedSubject: BehaviorSubject<boolean>;
  let loadErrorSubject: BehaviorSubject<string | null>;

  beforeEach(() => {
    mockCalendarService = jasmine.createSpyObj('CalendarService', ['getViewYears', 'updateEvents']);
    mockCalendarService.getViewYears.and.returnValue([2023, 2024, 2025, 2026, 2027, 2028, 2029]);
    mockCalendarService.updateEvents.and.callFake((
      events: any[], year: number, birthdays: boolean, anniversaries: boolean,
      notLiving: boolean, holidays: boolean,
    ) => {
      const output = events.filter(event => {
        if (event.type === 'birth' && !birthdays) return false;
        if (event.type === 'anniversary' && !anniversaries) return false;
        if (!event.isLiving && !notLiving) return false;
        return true;
      });
      if (holidays) {
        output.push({
          id: `holiday-${year}`, type: 'holiday', title: 'Holiday',
          date: new Date(year, 0, 1), start: new Date(year, 0, 1), isLiving: true,
        });
      }
      return output;
    });
    eventsSubject = new BehaviorSubject<any[]>([]);
    eventsLoadedSubject = new BehaviorSubject<boolean>(false);
    loadErrorSubject = new BehaviorSubject<string | null>(null);
    mockCalendarService.calendarEventsObservable = eventsSubject.asObservable();
    mockCalendarService.eventsLoaded$ = eventsLoadedSubject.asObservable();
    mockCalendarService.loadError$ = loadErrorSubject.asObservable();
    mockAnalyticsService = jasmine.createSpyObj('AnalyticsService', ['logEvent']);
    userSubject = new BehaviorSubject<any>(null);
    mockAuthService = {
      userObservable: userSubject.asObservable(),
      updateUser: jasmine.createSpy('updateUser').and.returnValue(Promise.resolve()),
    };

    TestBed.configureTestingModule({
      imports: [AppModule, TestSharedModule, DismissOnOutsideDirective],
      declarations: [CalendarComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: AuthService, useValue: mockAuthService },
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

  it('syncs pickerYear when changeView crosses into a new year', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').mockResolvedValue(true);
    component.selectedYear = 2025;
    component.pickerYear = 2025;

    component.changeView(new Date(2026, 0, 15));

    expect(component.selectedYear).toBe(2026);
    expect(component.pickerYear).toBe(2026);
  });

  it('rejects nonsensical 0000-0099 query years', () => {
    expect((component as any).parseYearParam('0000')).toBeNull();
    expect((component as any).parseYearParam('0099')).toBeNull();
    expect((component as any).parseYearParam('2024')).toBe(2024);
    expect((component as any).parseYearParam('abcd')).toBeNull();
  });

  it('reaches ready for a signed-in user without a displayName', () => {
    eventsSubject.next([{
      id: 'birth-1', type: 'birth', title: 'No Name',
      date: new Date(2020, 0, 1), start: new Date(2020, 0, 1), isLiving: true,
    }]);
    userSubject.next({ prefs: {} });

    expect(component.status).toBe('ready');
  });

  it('derives ready status from displayed holidays', () => {
    eventsSubject.next([]);
    userSubject.next({ prefs: { calendar: { showHolidays: true } } });

    expect(component.status).toBe('ready');
  });

  it('reaches empty status when a loaded dataset has no events', () => {
    userSubject.next({ prefs: { calendar: { showHolidays: false } } });
    eventsSubject.next([]);

    expect(component.status).toBe('empty');
  });

  it('reaches empty on a warm route where loaded is already true with no events', () => {
    userSubject.next({ prefs: { calendar: { showHolidays: false } } });
    eventsLoadedSubject.next(true);

    const warmFixture = TestBed.createComponent(CalendarComponent);
    const warmComponent = warmFixture.componentInstance;
    warmComponent.months = Months;
    warmFixture.detectChanges();

    expect(warmComponent.status).toBe('empty');
    warmFixture.destroy();
  });

  it('resolves a late empty emission after load', () => {
    userSubject.next({ prefs: { calendar: { showHolidays: false } } });
    eventsLoadedSubject.next(true);
    expect(component.status).toBe('empty');

    eventsSubject.next([]);

    expect(component.status).toBe('empty');
  });

  it('tears down component subscriptions on destroy', () => {
    component.ngOnDestroy();

    expect((component as any).userSub.closed).toBe(true);
    expect((component as any).eventsSub.closed).toBe(true);
    expect((component as any).loadedSub.closed).toBe(true);
    expect((component as any).flagsSub.closed).toBe(true);
  });

  it('shows the error state when the load error stream emits', () => {
    loadErrorSubject.next('boom');
    fixture.detectChanges();

    expect(component.status).toBe('error');
    expect(fixture.nativeElement.querySelector('app-load-error')).not.toBeNull();
  });

  it('recovers from an error when retry re-subscribes into fresh data', () => {
    userSubject.next({ prefs: { calendar: { showHolidays: false } } });
    loadErrorSubject.next('boom');
    fixture.detectChanges();
    expect(component.status).toBe('error');

    loadErrorSubject.next(null);
    component.retry();
    eventsSubject.next([{
      id: 'birth-1', type: 'birth', title: 'Alice Anderson',
      date: new Date(1996, 2, 10), start: new Date(2026, 2, 10), isLiving: true,
    }]);
    fixture.detectChanges();

    expect(component.status).toBe('ready');
    expect(fixture.nativeElement.querySelector('app-load-error')).toBeNull();
  });

  it('toggleBirthdays re-filters events and logs analytics', () => {
    component.allEvents = [];
    component.toggleBirthdays({ checked: false });
    expect(mockCalendarService.updateEvents).toHaveBeenCalled();
    expect(mockAnalyticsService.logEvent).toHaveBeenCalledWith('calendar_toggle_birthdays', jasmine.any(Object));
  });

  it('passes the events and a changing filter summary to the legacy printer', () => {
    const open = spyOn(component.printerPrompt, 'open').mockReturnValue({} as any);
    component.printFlagsReady = true;
    component.legacyCalendarPdf = true;
    component.allEvents = [{
      id: 'birth-1', type: 'birth', title: 'Alice Anderson',
      date: new Date(1996, 2, 10), start: new Date(2026, 2, 10), isLiving: true,
      personId: 'person-a', personId2: null,
    }];
    component.showBirthdays = true;
    component.showAnniversaries = false;
    component.showNotLiving = false;

    component.printPdf();
    expect(open).toHaveBeenCalledWith(jasmine.any(Function), jasmine.objectContaining({
      data: { events: component.allEvents, filtersSummary: 'Including birthdays.' },
    }));

    open.mockClear();
    component.showBirthdays = false;
    component.printPdf();
    expect(open).toHaveBeenCalledWith(jasmine.any(Function), jasmine.objectContaining({
      data: { events: component.allEvents, filtersSummary: 'No event types selected.' },
    }));
  });

  it('applies persisted calendar prefs once when the user arrives', () => {
    userSubject.next({
      name: 'Admin User',
      prefs: {
        calendar: {
          showBirthdays: false,
          showAnniversaries: false,
          showNotLiving: true,
          showHolidays: false,
        },
      },
    });

    expect(component.showBirthdays).toBe(false);
    expect(component.showAnniversaries).toBe(false);
    expect(component.showNotLiving).toBe(true);
    expect(component.showHolidays).toBe(false);
  });

  it('does not clobber in-session toggles on later user emits', () => {
    userSubject.next({ name: 'Admin User', prefs: { calendar: { showHolidays: false } } });
    component.showHolidays = true;

    userSubject.next({ name: 'Admin User', prefs: { calendar: { showHolidays: false } } });

    expect(component.showHolidays).toBe(true);
  });

  it('toggleHolidays persists the full filter set without dropping the theme', () => {
    mockAuthService.user = { id: 'user-1', prefs: { theme: 'dark' } };
    userSubject.next(mockAuthService.user);
    component.showAnniversaries = false;
    component.showNotLiving = true;

    component.toggleHolidays({ checked: false });

    expect(mockAuthService.updateUser).toHaveBeenCalledWith(jasmine.objectContaining({
      prefs: {
        theme: 'dark',
        calendar: {
          showBirthdays: true,
          showAnniversaries: false,
          showNotLiving: true,
          showHolidays: false,
        },
      },
    }));
    expect(mockAnalyticsService.logEvent).toHaveBeenCalledWith(
      'calendar_toggle_holidays', jasmine.any(Object),
    );
  });

  it('merges into the latest stored calendar prefs before writing', () => {
    mockAuthService.user = { id: 'user-1', prefs: { calendar: { showHolidays: true, custom: 'kept' } } };
    userSubject.next(mockAuthService.user);

    component.toggleBirthdays({ checked: false });

    expect(mockAuthService.updateUser).toHaveBeenCalledWith(jasmine.objectContaining({
      prefs: {
        calendar: jasmine.objectContaining({ custom: 'kept', showHolidays: true, showBirthdays: false }),
      },
    }));
  });

  it('rolls back the checkbox and flags an error when the prefs write fails', async () => {
    mockAuthService.user = { id: 'user-1', prefs: { calendar: { showHolidays: true } } };
    userSubject.next(mockAuthService.user);
    mockAuthService.updateUser.and.returnValue(Promise.reject(new Error('write failed')));

    component.toggleHolidays({ checked: false });
    await new Promise(resolve => setTimeout(resolve));

    expect(component.showHolidays).toBe(true);
    expect(component.prefsError).toBe(true);
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

  it('selecting a month changes the rendered month and re-derives its events', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').mockResolvedValue(true);
    component.status = 'ready';
    component.selectedYear = 2026;
    component.pickerYear = 2026;
    component.viewMonth = 'March';
    component.viewDate = new Date(2026, 2, 1);
    component.allEvents = [{
      id: 'birth-march', type: 'birth', title: 'Alice Anderson',
      date: new Date(1996, 2, 10), start: new Date(2026, 2, 10), isLiving: true,
      personId: 'person-a', personId2: null,
    }];
    component.datePickerOpen = true;
    fixture.detectChanges();

    const cell = fixture.nativeElement.querySelectorAll('.calendar-datepicker-cell')[10] as HTMLElement;
    mockCalendarService.updateEvents.mockClear();
    cell.click();
    fixture.detectChanges();

    expect(component.datePickerOpen).toBe(false);
    expect(component.viewMonth).toBe('November');
    expect(component.selectedYear).toBe(2026);
    expect(component.viewDate.getMonth()).toBe(10);
    expect(mockCalendarService.updateEvents).toHaveBeenCalledWith(
      component.allEvents, 2026, true, true, false, true,
    );
  });
});

describe('CalendarCellComponent years-since', () => {
  let cell: CalendarCellComponent;

  beforeEach(() => {
    cell = new CalendarCellComponent({
      getYearsSince: (eventYear: number, currentYear: number) => currentYear - eventYear,
    } as any);
  });

  it('uses the local year, not the UTC year, for the age', () => {
    const date = new Date(2020, 0, 1);
    // Simulate a UTC+ zone where local Jan 1 midnight is still the prior UTC year.
    (date as any).getUTCFullYear = () => 2019;
    cell.selectedYear = 2021;

    expect(cell.getYearsSinceString({ date } as any)).toBe('1');
  });

  it('suppresses the token when the view year precedes the event year', () => {
    cell.selectedYear = 2019;

    expect(cell.getYearsSinceString({ date: new Date(2020, 5, 1) } as any)).toBe('');
  });
});
