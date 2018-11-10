import { Component, OnInit, Input } from '@angular/core';
import { RecurringEvent } from '../calendar.service';
import { CalendarView } from 'angular-calendar';

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss']
})
export class CalendarViewComponent implements OnInit {
  view = CalendarView.Month;
  @Input()
  viewDate: Date;
  @Input()
  events: RecurringEvent[];

  constructor() { }

  ngOnInit() { }

}
