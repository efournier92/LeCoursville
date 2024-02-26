import { CalendarEvent } from 'angular-calendar';
import { EventColor, EventAction } from 'calendar-utils';

export class RecurringEvent implements CalendarEvent {
    // Custom RecurringEvent properties
    id: string;
    title: string;
    date: Date;
    type: string;
    isLiving = true;

    // Implemented from CalendarEvent
    start: Date;
    end?: Date;
    color?: EventColor;
    actions?: EventAction[];
    allDay?: boolean;
    cssClass?: string;
    resizable?: { beforeStart?: boolean; afterEnd?: boolean; };
    draggable?: boolean;
    meta?: any;
}
