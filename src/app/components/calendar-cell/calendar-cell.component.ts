import { Component, OnInit, Input } from '@angular/core';
import { CalendarService, RecurringEvent } from 'src/app/services/calendar.service';
import { AppSettings } from 'src/environments/app-settings';

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
    const eventYear: number = event.date.getUTCFullYear();
    return this.calendarService.getYearsSince(eventYear, this.selectedYear);
  }

  shouldDisplayEvent(): boolean {
    return !this.isNonLivingAnniversary();
  }

  private isNonLivingAnniversary(): boolean {
    return AppSettings.calendar.excludeNonLivingAnniversaries
      && this.event.type === 'anniversary'
      && this.event.isLiving === false;
  }
}
