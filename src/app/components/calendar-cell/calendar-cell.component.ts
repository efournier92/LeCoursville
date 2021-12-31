import { Component, OnInit, Input } from '@angular/core';
import { RecurringEvent } from 'src/app/interfaces/RecurringEvent';
import { CalendarService } from 'src/app/services/calendar.service';
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

  // LIFECYCLE HOOKS

  ngOnInit(): void { }

  // PUBLIC METHODS

  getYearsSinceString(event: RecurringEvent): string   {
    const eventYear = event.date.getUTCFullYear();
    return this.calendarService.getYearsSince(eventYear, this.selectedYear).toString();
    // return this.calendarService.formatYearsSinceString(yearsSince, 3);
  }

  shouldDisplayEvent(): boolean {
    return !this.isNonLivingAnniversary();
  }

  // HELPER METHODS

  private isNonLivingAnniversary(): boolean {
    return AppSettings.calendar.excludeNonLivingAnniversaries
      && this.event.type === 'anniversary'
      && this.event.isLiving === false;
  }
}
