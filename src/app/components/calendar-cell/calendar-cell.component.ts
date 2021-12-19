import { Component, OnInit, Input } from '@angular/core';
import { CalendarService, RecurringEvent } from 'src/app/services/calendar.service';

@Component({
  selector: 'app-calendar-cell',
  templateUrl: './calendar-cell.component.html',
  styleUrls: ['./calendar-cell.component.scss']
})
export class CalendarCellComponent implements OnInit {
  @Input() event: RecurringEvent;
  @Input() selectedYear: number;

  constructor(
    private calendarService: CalendarService,
  ) { }

  ngOnInit(): void { }

  getYearsSince(event: RecurringEvent): number {
    let eventYear: number = event.date.getUTCFullYear();
    return this.calendarService.getYearsSince(eventYear, this.selectedYear);
  }
}
