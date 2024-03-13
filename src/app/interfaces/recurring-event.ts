import { CalendarEvent } from 'angular-calendar';
import { EventColor, EventAction } from 'calendar-utils';

export class RecurringEvent implements CalendarEvent {
  // Custom RecurringEvent properties
  id: string = '';
  title: string = '';
  date: Date = new Date();
  type: string = '';
  isLiving = true;

  // Implemented from CalendarEvent
  start: Date = new Date();
  end?: Date = new Date();
  color?: EventColor = {
    primary: '',
    secondary: '',
  };
  actions?: EventAction[] = [];
  allDay?: boolean = true;
  cssClass?: string = '';
  resizable?: { beforeStart?: boolean; afterEnd?: boolean } = {};
  draggable?: boolean = false;
  meta?: any = {};
}
