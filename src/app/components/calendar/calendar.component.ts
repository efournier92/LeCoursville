import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
// As an alternative to rrule there is also rSchedule
// See https://github.com/mattlewis92/angular-calendar/issues/711#issuecomment-418537158 for more info
import RRule from 'rrule';
import moment from 'moment-timezone';
import {
  CalendarDayViewBeforeRenderEvent,
  CalendarEvent,
  CalendarMonthViewBeforeRenderEvent,
  CalendarView,
  CalendarWeekViewBeforeRenderEvent
} from 'angular-calendar';
import { colors } from './colors';
import { ViewPeriod } from 'calendar-utils';

// FIX
// Bruce Emerson (Birthday)
class Event {
  detail: string;
  type: string;
  date: string;
  constructor(detail: string, type: string, date: string) {
    this.detail = detail;
    this.type = type;
    this.date = date
  }
}

interface RecurringEvent extends CalendarEvent {
  title: string;
  color: any;
  date: any;
  rrule?: {
    freq: any;
    bymonth?: number;
    bymonthday?: number;
    byweekday?: any;
  };
}

// we set the timezone to UTC to avoid issues with DST changes
// see https://github.com/mattlewis92/angular-calendar/issues/717 for more info
moment.tz.setDefault('Utc');

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  view = CalendarView.Month;

  viewDate = moment().toDate();

  recurringEvents: RecurringEvent[] = [];

  ngOnInit(): void {
    let events = this.buildEvents();
    for (const event of events) {
      let calendarEvent = new Object as RecurringEvent;
      let date: Date = new Date(event.type);
      calendarEvent.title = event.detail;
      calendarEvent.color = colors.blue;
      calendarEvent.date = date;
      calendarEvent.rrule = {
        freq: RRule.YEARLY,
        bymonth: date.getMonth() + 1,
        bymonthday: date.getDate() + 1,
      }
      this.recurringEvents.push(calendarEvent);
    }
    console.log('Recurring Events:', this.recurringEvents);

  }

  calendarEvents: RecurringEvent[] = [];

  viewPeriod: ViewPeriod;

  buildEvents() {
    let events = new Array<Event>();
    events.push(new Event('Anselme LeCours', '04 JAN 1904', 'birth'));
    events.push(new Event('Violette LeCours', '09 DEC 1908', 'birth'));
    events.push(new Event('Mignonne LeBlanc', '03 JUL 1929', 'birth'));
    events.push(new Event('Vincent LeBlanc', '03 SEP 1927', 'birth'));
    events.push(new Event('Daniel LeBlanc', '03 MAR 1956', 'birth'));
    events.push(new Event('Nicole LeBlanc', '23 FEB 1957', 'birth'));
    events.push(new Event('Claire LeBlanc', '02 OCT 1958', 'birth'));
    events.push(new Event('Michele LeBlanc', '22 AUG 1961', 'birth'));
    events.push(new Event('Monique LeBlanc', '21 DEC 1962', 'birth'));
    events.push(new Event('Elisabeth LeBlanc', '03 JUL 1965', 'birth'));
    events.push(new Event('Claire Shea Kantany', '19 NOV 2013', 'birth'));
    events.push(new Event('Tiffani LeBlanc', '26 JAN 1994', 'birth'));
    events.push(new Event('Joseph LeBlanc', '12 JUL 2003', 'birth'));
    events.push(new Event('Charles Decker', '17 APR 1952', 'birth'));
    events.push(new Event('Matthew Decker', '19 NOV 1982', 'birth'));
    events.push(new Event('Michael Decker', '19 OCT 1984', 'birth'));
    events.push(new Event('Kenneth Decker', '16 JUN 1986', 'birth'));
    events.push(new Event('David Kapusta', '18 NOV 1954', 'birth'));
    events.push(new Event('John Kapusta', '22 JAN 1987', 'birth'));
    events.push(new Event('Thomas Kapusta', '15 FEB 1990', 'birth'));
    events.push(new Event('Genevieve Coup', '24 APR 2012', 'birth'));
    events.push(new Event('William Gunther', '25 MAR 1989', 'birth'));
    events.push(new Event('Stephen Gunther', '29 APR 1992', 'birth'));
    events.push(new Event('Daniel Gunther', '02 DEC 1993', 'birth'));
    events.push(new Event('Brian Gunther', '03 SEP 1996', 'birth'));
    events.push(new Event('Mark Miculcy', '22 MAY 1958', 'birth'));
    events.push(new Event('Kevin Miculcy', '10 MAR 1986', 'birth'));
    events.push(new Event('Kristin Miculcy', '22 JUN 1987', 'birth'));
    events.push(new Event('Konnor Miculcy', '29 APR 1991', 'birth'));
    events.push(new Event('Kyle Miculcy', '09 FEB 1998', 'birth'));
    events.push(new Event('Adam Emerson', '26 FEB 1965', 'birth'));
    events.push(new Event('Justin Emerson', '05 JUN 1992', 'birth'));
    events.push(new Event('Alexa Emerson', '29 SEP 1994', 'birth'));
    events.push(new Event('Hope Emerson', '14 APR 1998', 'birth'));
    events.push(new Event('Denis LeCours', '03 SEP 1930', 'birth'));
    events.push(new Event('Denise Lemay Hark', '31 JUL 1937', 'birth'));
    events.push(new Event('David LeCours', '28 JUL 1961', 'birth'));
    events.push(new Event('Patrick LeCours', '08 JAN 1963', 'birth'));
    events.push(new Event('Deborah LeCours', '08 AUG 1964', 'birth'));
    events.push(new Event('James LeCours', '03 NOV 1965', 'birth'));
    events.push(new Event('Steven LeCours', '18 JAN 1968', 'birth'));
    events.push(new Event('Suzanne Barrett', '08 JUN 1965', 'birth'));
    events.push(new Event('Bayley LeCours', '30 MAR 1994', 'birth'));
    events.push(new Event('Megan LeCours', '21 FEB 1997', 'birth'));
    events.push(new Event('Carter Tosch', '27 JUL 2007', 'birth'));
    events.push(new Event('Gregory Potter', '24 FEB 1994', 'birth'));
    events.push(new Event('Mark Potter', '31 JAN 1998', 'birth'));
    events.push(new Event('Sarah Potter', '25 MAY 2001', 'birth'));
    events.push(new Event('Beth Peters', '04 JAN 1961', 'birth'));
    events.push(new Event('Denis LeCours', '23 JAN 1999', 'birth'));
    events.push(new Event('Jay LeCours', '25 DEC 2000', 'birth'));
    events.push(new Event('Jason Coup', '24 APR 2012', 'birth'));
    events.push(new Event('Andrew LeCours', '20 OCT 1995', 'birth'));
    events.push(new Event('Henry LeCours', '26 JAN 1999', 'birth'));
    events.push(new Event('Robert LeCours', '16 DEC 1931', 'birth'));
    events.push(new Event('Lawrence LeCours', '09 FEB 1935', 'birth'));
    events.push(new Event('Roger LeCours', '27 MAY 1936', 'birth'));
    events.push(new Event('Leo LeCours', '29 DEC 1937', 'birth'));
    events.push(new Event('Annette LeCours', '07 OCT 1940', 'birth'));
    events.push(new Event('Jacqueline LeCours', '15 AUG 1943', 'birth'));
    events.push(new Event('Diane LeCours', '26 AUG 1946', 'birth'));
    events.push(new Event('Paulette LeCours', '06 OCT 1947', 'birth'));
    events.push(new Event('Dan LeCours', '06 FEB 1953', 'birth'));
    events.push(new Event('Michael LeCours', '06 FEB 1953', 'birth'));
    events.push(new Event('Bonnie Boulrisse', '16 MAR 1945', 'birth'));
    events.push(new Event('Tim LeCours', '12 APR 1967', 'birth'));
    events.push(new Event('Mary LeCours', '18 FEB 1969', 'birth'));
    events.push(new Event('Kathy LeCours', '22 JUL 1970', 'birth'));
    events.push(new Event('Michele LeCours', '02 DEC 1972', 'birth'));
    events.push(new Event('Chris Morrissey', '16 JAN 1962', 'birth'));
    events.push(new Event('Riley Morrissey', '08 SEP 1997', 'birth'));
    events.push(new Event('Allie Morrissey', '24 NOV 1998', 'birth'));
    events.push(new Event('Syd Banfield', '01 NOV 1964', 'birth'));
    events.push(new Event('Jeff Martel', '24 JUN 1967', 'birth'));
    events.push(new Event('Gail Jones', '27 JAN 1955', 'birth'));
    events.push(new Event('Julie Cole', '27 MAY 1974', 'birth'));
    events.push(new Event('Luke LeCours', '24 AUG 1985', 'birth'));
    events.push(new Event('Brandon Coburn', '06 AUG 1994', 'birth'));
    events.push(new Event('Tyler LeCours', '19 MAR 1992', 'birth'));
    events.push(new Event('Sam LeCours', '23 MAR 1994', 'birth'));
    events.push(new Event('Romain Dion', '19 FEB 1930', 'birth'));
    events.push(new Event('Lucille Mathieus', '13 OCT 1930', 'birth'));
    events.push(new Event('Denise Dion', '01 JUN 1959', 'birth'));
    events.push(new Event('Susan Dion', '12 JUL 1960', 'birth'));
    events.push(new Event('Michelle Dion', '18 JUL 1968', 'birth'));
    events.push(new Event("Keith O'Neil", '21 MAY 1959', 'birth'));
    events.push(new Event("Ian O'Neil", '19 NOV 1992', 'birth'));
    events.push(new Event("Aubrey O'Neil", '25 DEC 1993', 'birth'));
    events.push(new Event('Mark Kearney', '19 APR 1961', 'birth'));
    events.push(new Event('Colin Kearney', '12 JAN 1986', 'birth'));
    events.push(new Event('Lee Kearney', '26 MAY 1988', 'birth'));
    events.push(new Event('Logan Kearney', '03 SEP 1991', 'birth'));
    events.push(new Event('Bob Marchessault', '08 JUL 1961', 'birth'));
    events.push(new Event('Jacqueline Marchessault', '27 SEP 1994', 'birth'));
    events.push(new Event('Zachary LeCours', '24 JUL 2006', 'birth'));
    events.push(new Event('Scott LeCours', '29 MAR 1970', 'birth'));
    events.push(new Event('Amy LeCours', '02 JUN 1974', 'birth'));
    events.push(new Event('Andy Tosch', '23 JUL 1970', 'birth'));
    events.push(new Event('Sadie Tosch', '07 MAR 2002', 'birth'));
    events.push(new Event('Nita Boulrisse', '13 MAR 1940', 'birth'));
    events.push(new Event('Karen LeCours', '04 JAN 1970', 'birth'));
    events.push(new Event('Madison Martel', '04 DEC 2007', 'birth'));
    events.push(new Event('Michelle Yando', '27 JUN 1996', 'birth'));
    events.push(new Event('Joseph Yando', '09 MAY 1999', 'birth'));
    events.push(new Event('Amy Yando', '30 MAY 2002', 'birth'));
    events.push(new Event('Madeleine Ballargeon', '22 AUG 1933', 'birth'));
    events.push(new Event('Marc LeCours', '27 MAY 1956', 'birth'));
    events.push(new Event('Suzanne LeCours', '10 DEC 1957', 'birth'));
    events.push(new Event('Alan LeCours', '18 NOV 1958', 'birth'));
    events.push(new Event('Brian LeCours', '10 FEB 1960', 'birth'));
    events.push(new Event('John LeCours', '21 APR 1961', 'birth'));
    events.push(new Event('Thomas LeCours', '05 SEP 1962', 'birth'));
    events.push(new Event('Lisa LeCours', '11 FEB 1967', 'birth'));
    events.push(new Event('Mary Bell', '23 FEB 1958', 'birth'));
    events.push(new Event('Diane LeCours', '08 OCT 1984', 'birth'));
    events.push(new Event('Elise LeCours', '16 SEP 1986', 'birth'));
    events.push(new Event('Laura Yates', '24 JUL 1959', 'birth'));
    events.push(new Event('Daniel LeCours', '07 MAR 1984', 'birth'));
    events.push(new Event('Katherine LeCours', '12 JUN 1987', 'birth'));
    events.push(new Event('Colleen Curley', '22 FEB 1961', 'birth'));
    events.push(new Event('Catherine LeCours', '22 FEB 2000', 'birth'));
    events.push(new Event("Erin O'Neil", '21 MAR 1961', 'birth'));
    events.push(new Event('Eric LeCours', '11 APR 1989', 'birth'));
    events.push(new Event('Douglas LeCours', '28 DEC 1992', 'birth'));
    events.push(new Event('David Coup', '16 APR 1965', 'birth'));
    events.push(new Event('Nikki Nadeau', '16 OCT 1978', 'birth'));
    events.push(new Event('Noah LeCours', '29 JUN 2004', 'birth'));
    events.push(new Event('Pat Tucker', '19 JUL 1941', 'birth'));
    events.push(new Event('Jeffrey LeCours', '28 JAN 1964', 'birth'));
    events.push(new Event('Jennifer LeCours', '21 SEP 1966', 'birth'));
    events.push(new Event('Mamadou Drame', '01 JUL 1983', 'birth'));
    events.push(new Event('Christi LeCours', '31 OCT 1986', 'birth'));
    events.push(new Event('Lindsay LeCours', '30 SEP 1989', 'birth'));
    events.push(new Event('Hayley LeCours', '29 AUG 1994', 'birth'));
    events.push(new Event('Natalie Morrissey', '22 DEC 2004', 'birth'));
    events.push(new Event('Donald Miller', '22 APR 1933', 'birth'));
    events.push(new Event('Michael Miller', '24 MAY 1963', 'birth'));
    events.push(new Event('Stacey Miller', '24 APR 1965', 'birth'));
    events.push(new Event('Stefanie Miller', '18 FEB 1970', 'birth'));
    events.push(new Event('Daniel Miller', '11 SEP 1974', 'birth'));
    events.push(new Event('Rania Naccoches', '15 APR 1974', 'birth'));
    events.push(new Event('Robert Borges', '12 OCT 1943', 'birth'));
    events.push(new Event('Maria Borges', '13 JAN 1969', 'birth'));
    events.push(new Event('Julie Borges', '12 MAR 1971', 'birth'));
    events.push(new Event('Amanda Smith', '12 AUG 1988', 'birth'));
    events.push(new Event('Brittani Tharp', '07 NOV 1991', 'birth'));
    events.push(new Event('Blake Brooking', '12 JUL 1997', 'birth'));
    events.push(new Event('Morgan Brooking', '22 JUL 1991', 'birth'));
    events.push(new Event('Emile Fournier', '29 SEP 1946', 'birth'));
    events.push(new Event('Kevin Ingraham', '15 AUG 1970', 'birth'));
    events.push(new Event('Lori Ingraham', '09 AUG 1971', 'birth'));
    events.push(new Event('Brian Fournier', '10 OCT 1984', 'birth'));
    events.push(new Event('Eric Fournier', '13 FEB 1992', 'birth'));
    events.push(new Event('Mark Branda', '20 FEB 1973', 'birth'));
    events.push(new Event('Nate Branda', '19 AUG 2004', 'birth'));
    events.push(new Event('Richard Bessette', '02 JUN 1948', 'birth'));
    events.push(new Event('Jason Bessette', '20 NOV 1971', 'birth'));
    events.push(new Event('Matt Bessette', '05 MAY 1976', 'birth'));
    events.push(new Event('Rachel Bessette', '10 SEP 1979', 'birth'));
    events.push(new Event('Bruce Grandchamp', '21 AUG', 'birth'));
    events.push(new Event('Richard LeCours', '22 NOV 1950', 'birth'));
    events.push(new Event('Andrew Whitney', '31 MAR 1991', 'birth'));
    events.push(new Event('Timothy Whitney', '29 SEP 1964', 'birth'));
    events.push(new Event('Al Hark', '07 JUL 1923', 'birth'));
    events.push(new Event('Alyssa Whitney', '14 JUN 1995', 'birth'));
    events.push(new Event('Adam Whitney', '25 JUN 1993', 'birth'));
    events.push(new Event('Catrina Miller', '09 OCT 2006', 'birth'));
    events.push(new Event('Michael Monte', '17 SEP 1967', 'birth'));
    events.push(new Event('Michael Thorsted', '21 MAY 1956', 'birth'));
    events.push(new Event('Lauren Park', '31 JUL 1984', 'birth'));
    events.push(new Event('Nathaniel Coup', '09 MAR 2008', 'birth'));
    events.push(new Event('Brandon Miller', '27 FEB 2008', 'birth'));
    events.push(new Event('Nick LeBlanc', '02 JUL 1989', 'birth'));
    events.push(new Event('Lilyana LeBlanc', '30 JAN 2010', 'birth'));
    events.push(new Event('Olivia Martel', '10 FEB 2010', 'birth'));
    events.push(new Event('Katie Austin', '14 AUG 1987', 'birth'));
    events.push(new Event("Leslie O'Neil", '17 JUN 1956', 'birth'));
    events.push(new Event('Matt Fraijo', '06 FEB 1986', 'birth'));
    events.push(new Event('Jimmy Kantany', '14 SEP 1984', 'birth'));
    events.push(new Event('Kenley Joanne LeBlanc', '31 OCT 2012', 'birth'));
    events.push(new Event('Grant Thomas Fournier', '28 NOV 2013', 'birth'));
    events.push(new Event('Molly Allen Dimick', '14 OCT 1961', 'birth'));
    events.push(new Event('Maisie LeCours Brown', '02 JUL 2014', 'birth'));
    events.push(new Event('Stacey Hollenbach', '10 APR 1986', 'birth'));
    events.push(new Event('Lynn Nikell', '27 AUG 1961', 'birth'));
    events.push(new Event('Natalie Fraijo', '11 DEC 2014', 'birth'));
    events.push(new Event('Jack James Kantany', '27 JUN 2015', 'birth'));
    events.push(new Event('Maggie Stahlin', '27 MAY 1988', 'birth'));
    events.push(new Event('Anna Aschenbach', '17 DEC 2015', 'birth'));
    events.push(new Event('Jason Morris', '23 JUN 1979', 'birth'));
    events.push(new Event('Gordon Charles Decker', '22 JUL 2016', 'birth'));
    events.push(new Event('Mamadou Robert Drame', '13 FEB 2016', 'birth'));
    events.push(new Event('Matthew Fraijo', '06 JUL 2017', 'birth'));
    events.push(new Event('Brycen Andrew LeBlanc', '07 NOV 2017', 'birth'));
    events.push(new Event('Mariah-Jeanne Lanctot', '29 SEP 1990', 'birth'));
    events.push(new Event('Jameson Richard Whitney', '13 OCT 2017', 'birth'));
    events.push(new Event('Simon Junliang Kapusta', '02 MAR 2017', 'birth'));
    events.push(new Event('Violette LeCours Morris', '07 AUG 2017', 'birth'));
    return events;
  }

  constructor(private cdr: ChangeDetectorRef) { }

  getYearsSince(event) {
    let eventYear: number = event.date.getUTCFullYear();
    let now: Date = new Date();
    let currentYear = now.getUTCFullYear();
    return currentYear - eventYear;
  }

  updateCalendarEvents(
    viewRender:
      | CalendarMonthViewBeforeRenderEvent
      | CalendarWeekViewBeforeRenderEvent
      | CalendarDayViewBeforeRenderEvent
  ): void {
    if (
      !this.viewPeriod ||
      !moment(this.viewPeriod.start).isSame(viewRender.period.start) ||
      !moment(this.viewPeriod.end).isSame(viewRender.period.end)
    ) {
      this.viewPeriod = viewRender.period;
      this.calendarEvents = Array<RecurringEvent>();

      this.recurringEvents.forEach(event => {
        const rule: RRule = new RRule({
          ...event.rrule,
          dtstart: moment(viewRender.period.start)
            .startOf('day')
            .toDate(),
          until: moment(viewRender.period.end)
            .endOf('day')
            .toDate()
        });
        const { title, color } = event;

        rule.all().forEach(date => {
          this.calendarEvents.push({
            title,
            color,
            date: event.date,
            start: moment(date).toDate(),
          });
        });
      });
      this.cdr.detectChanges();
    }
  }
}
