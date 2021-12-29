import { CalendarEvent } from 'angular-calendar';

export interface RecurringEvent extends CalendarEvent {
    id: string;
    title: string;
    date: Date;
    type: string;
    isLiving: boolean;
}
