import { Component, OnInit, Input } from '@angular/core';
import { CalendarService, RecurringEvent } from '../../calendar.service';

@Component({
  selector: 'app-calendar-cell',
  templateUrl: './calendar-cell.component.html',
  styleUrls: ['./calendar-cell.component.scss']
})
export class CalendarCellComponent implements OnInit {
  @Input()
  event: RecurringEvent;
  @Input()
  isDialog: boolean;
  @Input()
  isPrintView: boolean;

  constructor(
    private calendarService: CalendarService,
  ) { }

  ngOnInit() { }

  getYearsSince(event: RecurringEvent): number {
    let eventYear: number = event.date.getUTCFullYear();
    return this.calendarService.getYearsSince(eventYear);
  }
}
