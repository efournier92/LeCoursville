import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { CalendarService } from 'src/app/services/calendar.service';
import { AppSettings } from 'src/app/config/app-settings';
import { ensureContrast } from 'src/app/utils/contrast';

@Component({
    selector: 'app-calendar-cell',
    templateUrl: './calendar-cell.component.html',
    styleUrls: ['./calendar-cell.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CalendarCellComponent implements OnInit {
  @Input() event: RecurringEvent;
  @Input() selectedYear: number;
  @Output() personClick = new EventEmitter<string>();
  @Output() spouseClick = new EventEmitter<string>();

  lightAccent = '';
  darkAccent = '';

  constructor(
    private calendarService: CalendarService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.resolveAccents();
  }

  // PUBLIC METHODS

  getYearsSinceString(event: RecurringEvent): string {
    const eventYear = event.date.getFullYear();
    // Suppress the token when viewing a year before the event exists.
    if (this.selectedYear < eventYear) return '';
    return this.calendarService.getYearsSince(eventYear, this.selectedYear).toString();
  }

  shouldDisplayEvent(): boolean {
    return !this.isNonLivingAnniversary();
  }

  onEventTitleClick(): void {
    if (this.event.type === 'holiday') return;
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

  private resolveAccents(): void {
    const color = this.event?.familyColor;
    if (!color) return;
    const root = getComputedStyle(document.documentElement);
    const light = root.getPropertyValue('--cal-tag-bg-light').trim();
    const dark = root.getPropertyValue('--cal-tag-bg-dark').trim();
    if (light) this.lightAccent = ensureContrast(color, light);
    if (dark) this.darkAccent = ensureContrast(color, dark);
  }

  private isNonLivingAnniversary(): boolean {
    return AppSettings.calendar.excludeNonLivingAnniversaries
      && this.event.type === 'anniversary'
      && this.event.isLiving === false;
  }
}
