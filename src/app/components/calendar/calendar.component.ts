import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CalendarView } from 'angular-calendar';
import { Subject, Observable, Subscription } from 'rxjs';
import { filter, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { Router, ActivatedRoute } from '@angular/router';
import { CalendarService, Months } from 'src/app/services/calendar.service';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { CalendarPrinterComponent } from 'src/app/components/calendar-printer/calendar-printer.component';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { FeatureFlagsService } from 'src/app/services/feature-flags.service';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { PersonDetailModalComponent } from 'src/app/components/person-detail-modal/person-detail-modal.component';

// Single source for the flags-ready -> legacyCalendarPdf chain used by both the
// component and the print route guard.
export function legacyCalendarPdfEnabled(featureFlagsService: FeatureFlagsService): Observable<boolean> {
  return featureFlagsService.flagsReady().pipe(
    filter(ready => ready),
    take(1),
    switchMap(() => featureFlagsService.getAllFeatureFlags().pipe(take(1))),
    map(flags => flags?.['legacyCalendarPdf']?.enabled === true),
  );
}

@Component({
    selector: 'app-calendar',
    templateUrl: './calendar.component.html',
    styleUrls: ['./calendar.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CalendarComponent implements OnInit, OnDestroy {
  @ViewChild('monthPill') monthPill?: ElementRef<HTMLButtonElement>;

  user: User;
  status: 'loading' | 'error' | 'ready' | 'empty' = 'loading';
  view = CalendarView.Month;
  months: string[] = Months;
  years: number[];
  viewDate: Date = new Date();
  viewMonth: string;
  selectedYear: number;
  allEvents: RecurringEvent[] = [];
  events: RecurringEvent[] = [];
  showBirthdays = true;
  showAnniversaries = true;
  showNotLiving = false;
  showHolidays = true;
  selectedPersonId: string | null = null;
  datePickerOpen = false;
  pickerDate: Date;
  pickerYear: number;
  legacyCalendarPdf = false;
  printFlagsReady = false;
  prefsError = false;

  private userSub: Subscription | null = null;
  private eventsSub: Subscription | null = null;
  private loadedSub: Subscription | null = null;
  private errorSub: Subscription | null = null;
  private querySub: Subscription | null = null;
  private flagsSub: Subscription | null = null;
  private destroy$ = new Subject<void>();
  private userArrived = false;
  private eventsArrived = false;
  private eventsLoaded = false;
  private calendarPrefsApplied = false;

  constructor(
    public authService: AuthService,
    public printerPrompt: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private calendarService: CalendarService,
    private analyticsService: AnalyticsService,
    private featureFlagsService: FeatureFlagsService,
  ) { }

  // LIFECYCLE

  ngOnInit(): void {
    this.initializeDates();

    this.subscribeToUserObservable();

    this.subscribeToCalendarEventsObservable();

    this.subscribeToQueryParams();

    this.subscribeToPrintFlag();

    this.pickerDate = new Date(this.selectedYear, this.months.indexOf(this.viewMonth), 1);
    this.pickerYear = this.selectedYear;

    this.analyticsService.logEvent('component_load_calendar',
      { viewDate: this?.viewDate.toString() });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // SUBSCRIPTIONS

  retry(): void {
    this.status = 'loading';
    this.subscribeToUserObservable();
    this.subscribeToCalendarEventsObservable();
  }

  private subscribeToUserObservable(): void {
    this.userSub?.unsubscribe();
    this.userSub = this.authService.userObservable.pipe(takeUntil(this.destroy$)).subscribe(
      (user: User) => {
        if (user) {
          this.user = user;
          this.userArrived = true;
          this.applyCalendarPrefs(user);
          this.updateStatus();
        }
      },
      () => (this.status = 'error'),
    );
  }

  // The service seeds its BehaviorSubject with [], so an empty replay is the
  // seed until eventsLoaded$ confirms the people load finished.
  private subscribeToCalendarEventsObservable(): void {
    this.eventsSub?.unsubscribe();
    this.loadedSub?.unsubscribe();
    this.errorSub?.unsubscribe();
    if (this.calendarService.loadError$) {
      this.errorSub = this.calendarService.loadError$.pipe(takeUntil(this.destroy$)).subscribe(
        (error: string | null) => {
          if (error) this.status = 'error';
        },
      );
    }
    this.eventsArrived = false;
    this.eventsLoaded = false;
    let isSeed = true;
    this.eventsSub = this.calendarService.calendarEventsObservable.pipe(takeUntil(this.destroy$)).subscribe(
      (events: RecurringEvent[]) => {
        const seedEmpty = isSeed && events.length === 0 && !this.eventsLoaded;
        isSeed = false;
        this.allEvents = events;
        this.events = this.calendarService.updateEvents(events, this.selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving, this.showHolidays);
        if (!seedEmpty) {
          this.eventsArrived = true;
          this.updateStatus();
        }
      },
      () => (this.status = 'error'),
    );
    this.loadedSub = this.calendarService.eventsLoaded$.pipe(takeUntil(this.destroy$)).subscribe(
      (loaded: boolean) => {
        if (!loaded) return;
        this.eventsLoaded = true;
        this.eventsArrived = true;
        this.updateStatus();
      },
    );
  }

  private updateStatus(): void {
    if (this.userArrived && this.eventsArrived) {
      // Derive from what is actually on screen, including holiday events.
      this.status = this.events.length > 0 ? 'ready' : 'empty';
    }
  }

  private subscribeToPrintFlag(): void {
    this.flagsSub?.unsubscribe();
    this.flagsSub = legacyCalendarPdfEnabled(this.featureFlagsService).pipe(
      takeUntil(this.destroy$),
    ).subscribe(enabled => {
      this.legacyCalendarPdf = enabled;
      this.printFlagsReady = true;
    });
  }

  private subscribeToQueryParams(): void {
    this.querySub = this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(queryParams => {
      const selected = queryParams.get('selected');
      this.selectedPersonId = selected || null;

      const monthParam = queryParams.get('month');
      const yearParam = queryParams.get('year');

      if (monthParam && /^\d{1,2}$/.test(monthParam)) {
        const monthIndex = parseInt(monthParam) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          this.viewMonth = this.months[monthIndex];
        }
      }
      const year = this.parseYearParam(yearParam);
      if (year !== null) {
        this.selectedYear = year;
        this.pickerYear = year;
      }

      if (monthParam || yearParam) {
        this.viewDate = new Date(this.selectedYear, this.months.indexOf(this.viewMonth), 1);
        this.events = this.calendarService.updateEvents(this.allEvents, this.selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving, this.showHolidays);
        this.updateStatus();
      }
    }, () => (this.status = 'error'));
  }

  private parseYearParam(yearParam: string | null): number | null {
    if (!yearParam || !/^\d{4}$/.test(yearParam)) return null;
    const year = parseInt(yearParam, 10);
    // Date maps 0-99 to 1900-1999, so reject those as nonsensical view years.
    return year >= 100 ? year : null;
  }

  // PUBLIC METHODS

  openPersonModal(personId: string | null): void {
    if (!personId) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: personId },
      queryParamsHandling: 'merge'
    });
  }

  closeModal(): void {
    this.selectedPersonId = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: null },
      queryParamsHandling: 'merge'
    });
  }

  isCurrentPickerMonth(index: number): boolean {
    return this.months[index] === this.viewMonth && this.pickerYear === this.selectedYear;
  }

  selectPickerMonth(monthIndex: number): void {
    this.viewMonth = this.months[monthIndex];
    this.viewDate = new Date(this.pickerYear, monthIndex, 1);
    this.selectedYear = this.pickerYear;
    this.datePickerOpen = false;
    this.events = this.calendarService.updateEvents(this.allEvents, this.pickerYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving, this.showHolidays);
    this.updateStatus();
    this.updateQueryParams();
  }

  onPickerDismiss(reason: 'outside' | 'escape'): void {
    this.datePickerOpen = false;
    if (reason === 'escape') {
      this.monthPill?.nativeElement.focus();
    }
  }

  navigateYear(direction: number): void {
    this.pickerYear += direction;
  }

  toggleBirthdays(event: any): void {
    this.showBirthdays = event.checked;
    this.rederiveEvents();
    void this.persistCalendarPrefs(() => { this.showBirthdays = !event.checked; });
    this.analyticsService.logEvent('calendar_toggle_birthdays', {
      isTrue: event?.checked, userId: this.user?.id,
    });
  }

  toggleAnniversaries(event: any): void {
    this.showAnniversaries = event.checked;
    this.rederiveEvents();
    void this.persistCalendarPrefs(() => { this.showAnniversaries = !event.checked; });
    this.analyticsService.logEvent('calendar_toggle_anniversaries', {
      isTrue: event?.checked, userId: this.user?.id,
    });
  }

  toggleNotLiving(event: any): void {
    this.showNotLiving = event.checked;
    this.rederiveEvents();
    void this.persistCalendarPrefs(() => { this.showNotLiving = !event.checked; });
    this.analyticsService.logEvent('calendar_toggle_notLiving', {
      isTrue: event?.checked, userId: this.user?.id,
    });
  }

  toggleHolidays(event: any): void {
    this.showHolidays = event.checked;
    this.rederiveEvents();
    void this.persistCalendarPrefs(() => { this.showHolidays = !event.checked; });
    this.analyticsService.logEvent('calendar_toggle_holidays', {
      isTrue: event?.checked, userId: this.user?.id,
    });
  }

  changeView(date: Date): void {
    this.viewMonth = this.months[date.getMonth()];
    const selectedYear = date.getFullYear();
    if (selectedYear !== this.selectedYear) {
      this.selectedYear = selectedYear;
      this.pickerYear = selectedYear;
      this.events = this.calendarService.updateEvents(this.allEvents, selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving, this.showHolidays);
      this.updateStatus();
    }
    this.updateQueryParams();
    this.analyticsService.logEvent('calendar_change_selected_year', {
      newDate: date.toString(),
      isTrue: `Birthdays: ${this.showBirthdays}; Anniversaries: ${this.showAnniversaries}`,
      userId: this.user?.id,
    });
  }

  printPdf(): void {
    if (!this.printFlagsReady) return;

    if (this.legacyCalendarPdf) {
      const included: string[] = [];
      if (this.showBirthdays) included.push('birthdays');
      if (this.showAnniversaries) included.push('anniversaries');
      if (this.showNotLiving) included.push('relatives who have passed');
      const filtersSummary = included.length
        ? `Including ${included.join(', ')}.`
        : 'No event types selected.';
      this.printerPrompt.open(CalendarPrinterComponent, {
        data: { events: this.allEvents, filtersSummary },
      });
      this.analyticsService.logEvent('calendar_print_legacy_open', {
        date: this.viewDate.toString(),
        isTrue: `Birthdays: ${this.showBirthdays}; Anniversaries: ${this.showAnniversaries}`,
        userId: this.user?.id,
      });
      return;
    }

    this.router.navigate(['/calendar/print'], {
      queryParams: {
        year: this.selectedYear,
        month: this.months.indexOf(this.viewMonth) + 1,
      },
    });
  }

  private updateQueryParams(): void {
    const monthNum = this.months.indexOf(this.viewMonth) + 1;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { month: monthNum, year: this.selectedYear },
      queryParamsHandling: 'merge'
    });
  }

  // HELPERS

  private applyCalendarPrefs(user: User): void {
    if (this.calendarPrefsApplied) return;
    this.calendarPrefsApplied = true;

    const prefs = user.prefs?.calendar ?? {};
    this.showBirthdays = prefs.showBirthdays ?? true;
    this.showAnniversaries = prefs.showAnniversaries ?? true;
    this.showNotLiving = prefs.showNotLiving ?? false;
    this.showHolidays = prefs.showHolidays ?? true;
    this.rederiveEvents();
  }

  private rederiveEvents(): void {
    this.events = this.calendarService.updateEvents(this.allEvents, this.selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving, this.showHolidays);
    this.updateStatus();
  }

  private async persistCalendarPrefs(rollback: () => void): Promise<void> {
    this.prefsError = false;
    const current = this.authService.user;
    try {
      // Merge into the latest stored calendar prefs so concurrent changes are not clobbered.
      await this.authService.updateUser({
        ...current,
        prefs: {
          ...current?.prefs,
          calendar: {
            ...current?.prefs?.calendar,
            showBirthdays: this.showBirthdays,
            showAnniversaries: this.showAnniversaries,
            showNotLiving: this.showNotLiving,
            showHolidays: this.showHolidays,
          },
        },
      });
    } catch {
      rollback();
      this.rederiveEvents();
      this.prefsError = true;
    }
  }

  private initializeDates(): void {
    this.years = this.calendarService.getViewYears();

    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.viewDate = new Date();

    const monthIndex: number = now.getMonth();
    this.viewMonth = this.months[monthIndex];
  }
}