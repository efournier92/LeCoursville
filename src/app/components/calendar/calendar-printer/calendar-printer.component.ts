import { Component, OnInit, Input } from '@angular/core';
import { RecurringEvent } from '../calendar.service';

@Component({
  selector: 'app-calendar-printer',
  templateUrl: './calendar-printer.component.html',
  styleUrls: ['./calendar-printer.component.scss']
})
export class CalendarPrinterComponent implements OnInit {
  @Input()
  viewDate: Date;
  @Input()
  events: RecurringEvent[];

  constructor() { }

  ngOnInit() {
  }

}
