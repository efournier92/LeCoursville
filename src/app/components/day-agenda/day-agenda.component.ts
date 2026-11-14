import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

@Component({
    selector: 'app-day-agenda',
    templateUrl: './day-agenda.component.html',
    styleUrls: ['./day-agenda.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DayAgendaComponent {
  @Input() day: Date;
  @Input() events: RecurringEvent[] = [];

  typeLabel(event: RecurringEvent): string {
    switch (event.type) {
      case 'birth': return 'Birthday';
      case 'anniversary': return 'Anniversary';
      case 'holiday': return 'Holiday';
      default: return 'Event';
    }
  }

  typeClass(event: RecurringEvent): string {
    switch (event.type) {
      case 'birth': return 'day-agenda-marker--birth';
      case 'anniversary': return 'day-agenda-marker--anniv';
      case 'holiday': return 'day-agenda-marker--holiday';
      default: return 'day-agenda-marker--other';
    }
  }
}
