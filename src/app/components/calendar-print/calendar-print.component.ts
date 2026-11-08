import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Person } from 'src/app/models/person';
import { User } from 'src/app/models/user';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';
import { PeopleService } from 'src/app/services/people.service';
import {
  CalendarDay,
  CalendarPage,
  CalendarPrintOptions,
  MONTH_NAMES,
  WEEKDAY_NAMES,
  buildCalendarPages,
} from './calendar-print.model';

interface OverflowWarning {
  monthName: string;
  day: number;
  count: number;
}

@Component({
    selector: 'app-calendar-print',
    templateUrl: './calendar-print.component.html',
    styleUrls: ['./calendar-print.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CalendarPrintComponent implements OnInit, OnDestroy {
  readonly months = MONTH_NAMES;
  readonly weekdays = WEEKDAY_NAMES;
  options: CalendarPrintOptions;
  scope: 'year' | 'month' = 'year';
  selectedMonth: number;
  customizeOpen = false;
  pages: CalendarPage[] = [];
  overflowWarnings: OverflowWarning[] = [];
  status: 'loading' | 'ready' | 'error' = 'loading';
  yearError = '';

  private people: Person[] = [];
  private peopleSub?: Subscription;
  private loadedSub?: Subscription;
  private errorSub?: Subscription;
  private retrySub?: Subscription;
  private userSub?: Subscription;
  private dataLoaded = false;
  private pagesBuilt = false;
  private prefsApplied = false;

  constructor(
    private peopleService: PeopleService,
    private analyticsService: AnalyticsService,
    private authService: AuthService,
    private route: ActivatedRoute,
  ) {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.options = {
      year: now.getFullYear(),
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      includeBirthdays: true,
      includeAnniversaries: true,
      includeDeceased: false,
      showLifespan: true,
      includeHolidays: true,
    };
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const year = Number(params.get('year'));
    const month = Number(params.get('month'));
    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      this.options.year = year;
    }
    if (Number.isInteger(month) && month >= 1 && month <= 12) {
      this.selectedMonth = month;
    }
    this.applyScope();

    this.subscribeToPeople();
    this.subscribeToPrefs();

    this.analyticsService.logEvent('calendar_print_open', {
      year: this.options.year,
      month: this.selectedMonth,
    });
  }

  ngOnDestroy(): void {
    this.peopleSub?.unsubscribe();
    this.loadedSub?.unsubscribe();
    this.errorSub?.unsubscribe();
    this.retrySub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  retry(): void {
    this.peopleSub?.unsubscribe();
    this.loadedSub?.unsubscribe();
    this.errorSub?.unsubscribe();
    this.retrySub?.unsubscribe();
    this.status = 'loading';
    this.dataLoaded = false;
    this.pagesBuilt = false;
    this.pages = [];
    this.overflowWarnings = [];
    // PeopleService exposes no reload API; getPeople() is the only path that opens a fresh stream.
    // minimalist: call PeopleService.reload() here if the service grows one.
    this.retrySub = this.peopleService.getPeople().valueChanges().subscribe({
      next: people => {
        this.people = people;
        this.dataLoaded = true;
        this.rebuild();
        this.status = this.pagesBuilt ? 'ready' : 'loading';
      },
      error: () => (this.status = 'error'),
    });
  }

  get yearValid(): boolean {
    const year = Number(this.options.year);
    return Number.isInteger(year) && year >= 1900 && year <= 2100;
  }

  get printDisabled(): boolean {
    return !this.yearValid || this.status === 'error' || !this.dataLoaded || !this.pagesBuilt;
  }

  get statusText(): string {
    if (!this.yearValid) {
      return 'Enter a year between 1900 and 2100.';
    }
    if (!this.dataLoaded || !this.pagesBuilt) {
      return 'Loading calendar…';
    }
    return `${this.pages.length} ${this.pages.length === 1 ? 'page' : 'pages'}`;
  }

  stepYear(delta: number): void {
    const next = Number(this.options.year || 0) + delta;
    this.options.year = next;
    this.onOptionsChange();
  }

  onOptionsChange(): void {
    this.yearError = this.yearValid ? '' : 'Enter a year between 1900 and 2100.';
    this.applyScope();
  }

  onDeceasedChange(): void {
    if (!this.options.includeDeceased) {
      this.options.showLifespan = true;
    }
    this.onOptionsChange();
  }

  onMonthChange(value: number | string): void {
    this.selectedMonth = Number(value);
    this.applyScope();
  }

  applyScope(): void {
    this.options.months = this.scope === 'month'
      ? [this.selectedMonth]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    this.rebuild();
  }

  async print(): Promise<void> {
    if (this.printDisabled) {
      return;
    }

    this.analyticsService.logEvent('calendar_print_run', {
      year: this.options.year,
      months: this.options.months,
      includeBirthdays: this.options.includeBirthdays,
      includeAnniversaries: this.options.includeAnniversaries,
      includeDeceased: this.options.includeDeceased,
      showLifespan: this.options.showLifespan,
      includeHolidays: this.options.includeHolidays,
    });

    const previousTitle = document.title;
    document.title = this.pages.length === 1
      ? this.pages[0].title
      : 'LeCoursville Family Calendar';
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      window.print();
    } finally {
      document.title = previousTitle;
    }
  }

  // minimalist: a 30-character label threshold triggers the dense scale; upgrade to a measured line count if the type scale changes.
  hasLongLabel(cell: CalendarDay): boolean {
    return cell.entries.some(entry => entry.label.length > 30);
  }

  private subscribeToPeople(): void {
    this.peopleSub?.unsubscribe();
    this.loadedSub?.unsubscribe();
    this.errorSub?.unsubscribe();
    this.loadedSub = this.peopleService.peopleLoaded$.subscribe(
      loaded => {
        if (loaded) {
          this.dataLoaded = true;
          this.status = this.pagesBuilt ? 'ready' : 'loading';
        }
      },
      () => (this.status = 'error'),
    );
    this.errorSub = this.peopleService.loadError$.subscribe(
      error => {
        if (error) {
          this.status = 'error';
        }
      },
      () => (this.status = 'error'),
    );
    this.peopleSub = this.peopleService.people$.subscribe(
      people => {
        this.people = people;
        this.rebuild();
        if (this.dataLoaded && this.pagesBuilt) {
          this.status = 'ready';
        }
      },
      () => (this.status = 'error'),
    );
  }

  // Prefs live on the async user record, so apply them once it lands instead of the constructor.
  private subscribeToPrefs(): void {
    this.userSub?.unsubscribe();
    this.userSub = this.authService.userObservable.subscribe(
      (user: User) => {
        if (this.prefsApplied || !user?.id) {
          return;
        }
        this.prefsApplied = true;
        const prefs = user.prefs?.calendar ?? {};
        this.options.includeBirthdays = prefs.showBirthdays ?? true;
        this.options.includeAnniversaries = prefs.showAnniversaries ?? true;
        this.options.includeDeceased = prefs.showNotLiving ?? false;
        this.options.includeHolidays = prefs.showHolidays ?? true;
        if (!this.options.includeDeceased) {
          this.options.showLifespan = true;
        }
        this.rebuild();
      },
      () => (this.status = 'error'),
    );
  }

  private rebuild(): void {
    if (!this.yearValid) {
      this.pages = [];
      this.overflowWarnings = [];
      this.pagesBuilt = false;
      return;
    }
    this.pages = buildCalendarPages(this.people, this.options);
    this.overflowWarnings = this.pages.flatMap(page =>
      page.weeks.flat()
        .filter(cell => cell.moreCount > 0)
        .map(cell => ({
          monthName: page.monthName,
          day: cell.day as number,
          count: cell.moreCount,
        })));
    this.pagesBuilt = true;
  }
}
