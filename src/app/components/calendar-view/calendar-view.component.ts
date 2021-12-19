import { Component, OnInit, Input, Output, EventEmitter, Inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RecurringEvent, CalendarService } from 'src/app/services/calendar.service';
import { CalendarView } from 'angular-calendar';
import { CalendarDialogComponent } from 'src/app/components/calendar-dialog/calendar-dialog.component';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { DOCUMENT } from '@angular/common';
import scrollIntoView from 'scroll-into-view-if-needed'

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss']
})
export class CalendarViewComponent implements OnInit {
  user: User;
  view: string = CalendarView.Month;
  @Input()
  viewDate: Date;
  @Input()
  selectedYear: number;
  @Input()
  events: RecurringEvent[];
  @Output()
  refreshView: EventEmitter<Event> = new EventEmitter();
  activeDay: Date = new Date("December 10, 2021");

  constructor(
    public dialog: MatDialog,
    private auth: AuthService,
    private calendarService: CalendarService,
    @Inject(DOCUMENT) private document: Document
  ) { }

  ngOnInit(): void {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
  }

  ngAfterViewInit() {
    this.ensureTodaysDateIsInView();
  }

  ensureTodaysDateIsInView() {
    const node = this.document.querySelector(".cal-cell.cal-day-cell.cal-today");

    if (node) {
      scrollIntoView(node, {
        scrollMode: 'if-needed',
        block: 'nearest',
        inline: 'nearest',
      })
    }
  }

  refreshCalendar(): void {
    this.refreshView.emit(event);
  }

  isEventInActiveMonth(event: RecurringEvent) {
    return event.date.getMonth() === this.viewDate.getMonth();
  }

  openDialog(event: RecurringEvent): void {
    if (!this.user || !this.user.roles || this.user.roles.admin !== true)
      return;

    const dialogRef = this.dialog.open(CalendarDialogComponent, {
      width: '30%',
      data: event,
    });

    dialogRef.afterClosed().subscribe(
      (result: RecurringEvent) => {
        if (!result) return;
        let event = result;
        if (event.id) {
          this.calendarService.updateCalendarEvent(event);
        } else {
          this.calendarService.addCalendarEvent(event);
        }
        this.refreshCalendar();
      }
    );
  }
}
