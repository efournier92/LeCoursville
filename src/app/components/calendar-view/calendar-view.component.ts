import { Component, OnInit, Input, Output, EventEmitter, Inject, AfterViewInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RecurringEvent } from 'src/app/interfaces/RecurringEvent';
import { CalendarView } from 'angular-calendar';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { DOCUMENT } from '@angular/common';
import scrollIntoView from 'scroll-into-view-if-needed';

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

  user: User;
  view: string = CalendarView.Month;
  activeDay: Date = new Date();

  constructor(
    public dialog: MatDialog,
    private auth: AuthService,
    @Inject(DOCUMENT) private document: Document
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
  }

  ngAfterViewInit(): void {
    this.ensureTodaysDateIsInView();
  }

  // PUBLIC METHODS

  isEventInActiveMonth(event: RecurringEvent): boolean {
    return event.date.getMonth() === this.viewDate.getMonth();
  }

  // HELPER METHODS

  private ensureTodaysDateIsInView(): void {
    const node = this.document.querySelector('.cal-cell.cal-day-cell.cal-today');

    if (node) {
      scrollIntoView(node, {
        scrollMode: 'if-needed',
        block: 'nearest',
        inline: 'center',
      });
    }
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    );
  }
}
