import {
  Component, OnInit, OnDestroy, OnChanges, Input, Output, EventEmitter,
  Inject, DOCUMENT, ChangeDetectionStrategy, SimpleChanges,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { CalendarView } from 'angular-calendar';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { AppSettings } from 'src/app/config/app-settings';

import { AnalyticsService } from 'src/app/services/analytics.service';
import { CalendarAgendaSheetComponent } from 'src/app/components/calendar-agenda-sheet/calendar-agenda-sheet.component';

@Component({
    selector: 'app-calendar-view',
    templateUrl: './calendar-view.component.html',
    styleUrls: ['./calendar-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CalendarViewComponent implements OnInit, OnChanges, OnDestroy {
  @Input() viewDate: Date;
  @Input() selectedYear: number;
  @Input() events: RecurringEvent[];
  @Input() viewMode: 'month' | 'timeline' = 'month';

  @Output() refreshView: EventEmitter<Event> = new EventEmitter();
  @Output() personClick: EventEmitter<string> = new EventEmitter();
  @Output() spouseClick: EventEmitter<string> = new EventEmitter();

  user: User;
  view: string = CalendarView.Month;
  activeDay: Date = new Date();
  selectedDay: Date = new Date();
  agendaAnchor: Date = new Date();
  isMobile = false;
  expandedDays: { [key: string]: boolean } = {};
  maxEventsPerCell = 4;
  readonly maxMobileDots = 3;

  private destroy$ = new Subject<void>();
  private userSub: Subscription | null = null;

  constructor(
    public dialog: MatDialog,
    private authService: AuthService,
    private analyticsService: AnalyticsService,
    private breakpointObserver: BreakpointObserver,
    @Inject(DOCUMENT) private document: Document
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.breakpointObserver.observe('(max-width: 1023px)').pipe(
      takeUntil(this.destroy$),
    ).subscribe(result => this.isMobile = result.matches);
    this.selectDefaultDay();
    this.analyticsService.logEvent('component_load_calendar_view', {
      date: this.viewDate.toString(),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['viewDate'] || changes['selectedYear']) {
      this.selectDefaultDay();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.userSub = this.authService.userObservable.pipe(takeUntil(this.destroy$)).subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  isEventInActiveMonth(event: RecurringEvent): boolean {
    return event.date.getMonth() === this.viewDate.getMonth();
  }

  toggleDayExpanded(day: any): void {
    const key = day.date.toISOString();
    this.expandedDays[key] = !this.expandedDays[key];
  }

  getHiddenEventCount(day: any): number {
    const activeEvents = day.events.filter(e => this.isEventInActiveMonth(e));
    return Math.max(0, activeEvents.length - this.maxEventsPerCell);
  }

  onDaySelect(day: any): void {
    this.selectedDay = new Date(day.date);
    this.agendaAnchor = this.midnight(this.selectedDay);
  }

  onPreviewDaySelect(date: Date): void {
    this.selectedDay = new Date(date);
  }

  onTimelineDaySelect(date: Date): void {
    this.selectedDay = new Date(date);
    this.agendaAnchor = this.midnight(date);
  }

  openFullAgenda(): void {
    const data = {
      events: this.events,
      anchorDate: this.agendaAnchor,
      selectedDay: this.selectedDay,
      onDaySelect: (date: Date) => {
        this.selectedDay = new Date(date);
        this.agendaAnchor = this.midnight(date);
      },
    };
    this.dialog.open(CalendarAgendaSheetComponent, {
      data,
      panelClass: 'calendar-agenda-sheet',
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      autoFocus: 'dialog',
      disableClose: true,
    });
  }

  onDayKeydown(event: KeyboardEvent, day: any): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.key === ' ') event.preventDefault();
    this.onDaySelect(day);
  }

  isSelectedDay(date: Date): boolean {
    return this.sameCalendarDay(date, this.selectedDay);
  }

  getVisibleDayEvents(day: any): RecurringEvent[] {
    return (day.events || []).filter(event => this.isEventInActiveMonth(event) && this.isDisplayable(event));
  }

  getDayAriaLabel(day: any): string {
    const date = day.date as Date;
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const count = this.getVisibleDayEvents(day).length;
    const prefix = `${month} ${date.getDate()}`;
    if (!count) return `${prefix}, no events`;
    const types = [...new Set(this.getVisibleDayEvents(day).map(event => this.typeLabel(event.type)))];
    return `${prefix}, ${count} ${count === 1 ? 'event' : 'events'}: ${types.join(', ')}`;
  }

  getMobileDots(day: any): RecurringEvent[] {
    return this.getVisibleDayEvents(day).slice(0, this.maxMobileDots);
  }

  getMobileOverflowCount(day: any): number {
    return Math.max(0, this.getVisibleDayEvents(day).length - this.maxMobileDots);
  }

  dotClass(event: RecurringEvent): string {
    switch (event.type) {
      case 'birth': return 'day-dot--birth';
      case 'anniversary': return 'day-dot--anniv';
      case 'holiday': return 'day-dot--holiday';
      default: return 'day-dot--other';
    }
  }

  // HELPER METHODS

  private selectDefaultDay(): void {
    if (!this.viewDate) return;
    const today = new Date();
    const sameMonth = today.getFullYear() === this.viewDate.getFullYear()
      && today.getMonth() === this.viewDate.getMonth();
    this.selectedDay = new Date(
      this.viewDate.getFullYear(),
      this.viewDate.getMonth(),
      sameMonth ? today.getDate() : 1
    );
    this.agendaAnchor = this.midnight(this.selectedDay);
  }

  private midnight(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private sameCalendarDay(a: Date, b: Date): boolean {
    return !!a && !!b
      && a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  private isDisplayable(event: RecurringEvent): boolean {
    return !(AppSettings.calendar.excludeNonLivingAnniversaries
      && event.type === 'anniversary'
      && event.isLiving === false);
  }

  private typeLabel(type: string): string {
    switch (type) {
      case 'birth': return 'birthday';
      case 'anniversary': return 'anniversary';
      case 'holiday': return 'holiday';
      default: return 'event';
    }
  }
}
