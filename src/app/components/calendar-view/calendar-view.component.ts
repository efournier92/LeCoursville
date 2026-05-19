import { Component, OnInit, Input, Output, EventEmitter, Inject, AfterViewInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { CalendarView } from 'angular-calendar';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { DOCUMENT } from '@angular/common';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss']
})
export class CalendarViewComponent implements OnInit, AfterViewInit {
  @Input() viewDate: Date;
  @Input() selectedYear: number;
  @Input() events: RecurringEvent[];

  @Output() refreshView: EventEmitter<Event> = new EventEmitter();
  @Output() personClick: EventEmitter<string> = new EventEmitter();
  @Output() spouseClick: EventEmitter<string> = new EventEmitter();

  user: User;
  view: string = CalendarView.Month;
  activeDay: Date = new Date();
  expandedDays: { [key: string]: boolean } = {};
  maxEventsPerCell = 4;

  constructor(
    public dialog: MatDialog,
    private authService: AuthService,
    private analyticsService: AnalyticsService,
    @Inject(DOCUMENT) private document: Document
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.analyticsService.logEvent('component_load_calendar_view', {
      date: this.viewDate.toString(),
    });
  }

  ngAfterViewInit(): void {
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
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

  // HELPER METHODS
}
