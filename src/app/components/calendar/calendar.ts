import { CalendarEvent } from "angular-calendar";

export class Calendar {
  id: string;
  label: string;
  path: string;
  url: string;
}

export interface RecurringEvent extends CalendarEvent {
  id: string;
  title: string;
  color: any;
  date: Date;
  type: string;
  rrule?: {
    freq: any;
    bymonth?: number;
    bymonthday?: number;
    byweekday?: any;
  };
}


export const Months = [
  { name: 'January', page: '1' },
  { name: 'February', page: '2' },
  { name: 'March', page: '3' },
  { name: 'April', page: '4' },
  { name: 'May', page: '5' },
  { name: 'June', page: '6' },
  { name: 'July', page: '7' },
  { name: 'August', page: '8' },
  { name: 'September', page: '9' },
  { name: 'October', page: '10' },
  { name: 'November', page: '11' },
  { name: 'December', page: '12' },
];