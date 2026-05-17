import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
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
  @Output() personClick = new EventEmitter<string>();
  @Output() spouseClick = new EventEmitter<string>();

  constructor(
    private calendarService: CalendarService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void { }

  // PUBLIC METHODS

  getYearsSinceString(event: RecurringEvent): string {
    const eventYear = event.date.getUTCFullYear();
    return this.calendarService.getYearsSince(eventYear, this.selectedYear).toString();
  }

  shouldDisplayEvent(): boolean {
    return !this.isNonLivingAnniversary();
  }

  onEventTitleClick(): void {
    if (this.event.personId) {
      this.personClick.emit(this.event.personId);
    }
  }

  onSpouseTitleClick(): void {
    if (this.event.personId2) {
      this.spouseClick.emit(this.event.personId2);
    }
  }

  getPrimaryName(): string {
    return this.event.title.split(' & ')[0] || this.event.title;
  }

  getSpouseName(): string | null {
    const parts = this.event.title.split(' & ');
    return parts.length > 1 ? parts[1] : null;
  }

  // HELPER METHODS

  private isNonLivingAnniversary(): boolean {
    return AppSettings.calendar.excludeNonLivingAnniversaries
      && this.event.type === 'anniversary'
      && this.event.isLiving === false;
  }
}
