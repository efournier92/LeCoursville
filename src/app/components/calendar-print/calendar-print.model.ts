import { Person, PersonDate } from 'src/app/models/person';
import { dayOfWeek, daysInMonth, getHolidaysForYear } from 'src/app/config/calendar-holidays';
import { Months } from 'src/app/services/calendar.service';

export type CalendarEntryKind = 'holiday' | 'birthday' | 'anniversary';

export interface CalendarPrintEntry {
  text: string;
  kind: CalendarEntryKind;
  label: string;
  token: string;
}

interface EntryParts {
  label: string;
  token: string;
  text: string;
}

export interface CalendarPrintOptions {
  year: number;
  months: number[];
  includeBirthdays: boolean;
  includeAnniversaries: boolean;
  includeDeceased: boolean;
  showLifespan: boolean;
  includeHolidays: boolean;
}

export interface CalendarDay {
  day: number | null;
  entries: CalendarPrintEntry[];
  moreCount: number;
}

export interface CalendarPage {
  year: number;
  month: number;
  monthName: string;
  title: string;
  weeks: CalendarDay[][];
}

// Re-exported under the old name so the component import stays stable.
export { Months as MONTH_NAMES };

export const WEEKDAY_NAMES: string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** A day cell fits at most this many printed lines; a truncated day spends one of them on `+N more`. */
const MAX_LINES_PER_DAY = 8;

// minimalist: fixed chars-per-line estimate; upgrade to real text measurement if the type scale changes.
const ENTRY_CHARS_PER_LINE = 20;

const FAMILY_NAME = 'LeCoursville';

/** Canonical deceased rule: a missing isLiving is living, and an unknown death year is not a death. */
export function isDeceased(person: Person): boolean {
  if (person.isLiving === false) {
    return true;
  }
  return person.deathDate != null && person.deathDate.year > 0;
}

export function birthdayParts(person: Person, options: CalendarPrintOptions): EntryParts | null {
  const date = resolveDate(person.birthday, options.year);
  if (!date) {
    return null;
  }

  const label = fullName(person);
  if (isDeceased(person) && options.showLifespan) {
    return { label, token: lifespanToken(person), text: `${label}${lifespanSuffix(person)}` };
  }

  return { label, token: ageToken(person.birthday, options.year), text: `${label}${ageSuffix(person.birthday, options.year)}` };
}

export function anniversaryParts(person: Person, spouse: Person | null, options: CalendarPrintOptions): EntryParts | null {
  const date = resolveDate(person.anniversaryDate, options.year);
  if (!date) {
    return null;
  }

  const years = person.anniversaryDate.year > 0 && options.year >= person.anniversaryDate.year
    ? options.year - person.anniversaryDate.year
    : null;
  const label = anniversaryLabel(person, spouse, options.showLifespan);
  return {
    label,
    token: years === null ? '' : String(years),
    text: years === null ? label : `${label} - ${years}`,
  };
}

function anniversaryLabel(person: Person, spouse: Person | null, lifespanOn: boolean): string {
  if (!spouse) {
    return `${fullName(person)}${lifespanOn ? deceasedSuffix(person) : ''}`;
  }

  const sharedSurname = person.name.last && person.name.last === spouse.name.last;
  if (sharedSurname) {
    const a = `${firstName(person)}${lifespanOn ? deceasedSuffix(person) : ''}`;
    const b = `${firstName(spouse)}${lifespanOn ? deceasedSuffix(spouse) : ''}`;
    return `${a} & ${b} ${person.name.last}`;
  }

  const a = `${fullName(person)}${lifespanOn ? deceasedSuffix(person) : ''}`;
  const b = `${fullName(spouse)}${lifespanOn ? deceasedSuffix(spouse) : ''}`;
  return `${a} & ${b}`;
}

export function buildCalendarPages(people: Person[], options: CalendarPrintOptions): CalendarPage[] {
  const byId = new Map<string, Person>();
  for (const person of people) {
    byId.set(person.id, person);
  }

  const months = Array.from(new Set(options.months)).sort((a, b) => a - b);
  return months.map(month => buildPage(people, byId, options, month));
}

const KIND_ORDER: Record<CalendarEntryKind, number> = {
  holiday: 0,
  birthday: 1,
  anniversary: 2,
};

function buildPage(people: Person[], byId: Map<string, Person>, options: CalendarPrintOptions, month: number): CalendarPage {
  const dateOptions = { ...options, months: [month] };
  const buckets = new Map<number, CalendarPrintEntry[]>();

  const addEntry = (day: number, kind: CalendarEntryKind, parts: EntryParts): void => {
    const bucket = buckets.get(day) || [];
    bucket.push({ kind, ...parts });
    buckets.set(day, bucket);
  };

  if (options.includeHolidays) {
    for (const holiday of getHolidaysForYear(options.year)) {
      if (holiday.month === month) {
        addEntry(holiday.day, 'holiday', { label: holiday.name, token: '', text: holiday.name });
      }
    }
  }

  // A -S spouse birthday is its own date unless it duplicates the primary's virtual copy.
  const seenAnniversaries = new Set<string>();
  for (const person of people) {
    if (options.includeBirthdays && person.birthday && person.birthday.year > 0) {
      const primary = person.id.endsWith('-S') ? byId.get(person.id.slice(0, -2)) : undefined;
      const primaryBirthday = primary?.birthday;
      const duplicatesPrimary = primaryBirthday != null && sameDate(primaryBirthday, person.birthday);
      const date = duplicatesPrimary ? null : resolveDate(person.birthday, options.year);
      if (date && date.month === month && (options.includeDeceased || !isDeceased(person))) {
        const parts = birthdayParts(person, dateOptions);
        if (parts) {
          addEntry(date.day, 'birthday', parts);
        }
      }
    }

    // -S records never emit an anniversary and a linked couple emits one, mirroring the service.
    if (options.includeAnniversaries && !person.id.endsWith('-S') && !seenAnniversaries.has(person.id)) {
      const spouse = person.spouseId ? byId.get(person.spouseId) || null : null;
      const date = resolveDate(person.anniversaryDate, options.year);
      const spouseDeceased = spouse ? isDeceased(spouse) : false;
      if (date && date.month === month
        && (options.includeDeceased || (!isDeceased(person) && !spouseDeceased))) {
        const parts = anniversaryParts(person, spouse, dateOptions);
        if (parts) {
          addEntry(date.day, 'anniversary', parts);
        }
      }
      if (person.anniversaryDate && person.spouseId) {
        seenAnniversaries.add(person.id);
        seenAnniversaries.add(person.spouseId);
      }
    }
  }

  const firstWeekday = dayOfWeek(options.year, month, 1);
  const totalDays = daysInMonth(options.year, month);
  // Row count is dynamic so a short month renders no trailing empty week; the fixed sheet height stretches the rendered rows instead.
  const weekCount = Math.ceil((firstWeekday + totalDays) / 7);
  const weeks: CalendarDay[][] = [];

  for (let row = 0; row < weekCount; row++) {
    const week: CalendarDay[] = [];
    for (let column = 0; column < 7; column++) {
      const day = row * 7 + column - firstWeekday + 1;
      if (day < 1 || day > totalDays) {
        week.push({ day: null, entries: [], moreCount: 0 });
        continue;
      }

      const sorted = (buckets.get(day) || []).sort((a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
        || a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
      const visibleCount = visibleEntryCount(sorted);
      const entries = sorted.slice(0, visibleCount)
        .map(({ text, kind, label, token }) => ({ text, kind, label, token }));
      week.push({
        day,
        entries,
        moreCount: sorted.length - visibleCount,
      });
    }
    weeks.push(week);
  }

  const monthName = Months[month - 1];
  return {
    year: options.year,
    month,
    monthName,
    title: `${FAMILY_NAME} Family - ${monthName} ${options.year}`,
    weeks,
  };
}

// Estimates wrapped label lines so the cap counts printed lines, not entries.
function visibleEntryCount(entries: CalendarPrintEntry[]): number {
  const lines = entries.map(entry => Math.max(1, Math.ceil(entry.text.length / ENTRY_CHARS_PER_LINE)));
  const total = lines.reduce((sum, count) => sum + count, 0);
  if (total <= MAX_LINES_PER_DAY) {
    return entries.length;
  }

  let used = 0;
  let count = 0;
  while (count < entries.length && used + lines[count] <= MAX_LINES_PER_DAY - 1) {
    used += lines[count];
    count += 1;
  }
  return count;
}

function sameDate(a: PersonDate, b: PersonDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function resolveDate(date: PersonDate | null | undefined, year: number): { month: number; day: number } | null {
  if (!date || date.month < 1 || date.month > 12) {
    return null;
  }

  const maxDay = daysInMonth(year, date.month);
  if (date.day < 1) {
    return null;
  }
  // Leap day renders on February 28 in a non-leap target year rather than disappearing.
  if (date.month === 2 && date.day === 29 && maxDay === 28) {
    return { month: 2, day: 28 };
  }
  if (date.day > maxDay) {
    return null;
  }
  return { month: date.month, day: date.day };
}

function fullName(person: Person): string {
  const first = firstName(person);
  const last = (person.name.last || '').trim();
  return [first, last].filter(Boolean).join(' ');
}

function firstName(person: Person): string {
  return (person.name.firstPreferred || person.name.firstGiven || '').trim();
}

function ageToken(birthday: PersonDate, year: number): string {
  if (birthday.year <= 0 || year < birthday.year) {
    return '';
  }
  return String(year - birthday.year);
}

function ageSuffix(birthday: PersonDate, year: number): string {
  const token = ageToken(birthday, year);
  return token ? ` - ${token}` : '';
}

function lifespanToken(person: Person): string {
  const birthYear = person.birthday && person.birthday.year > 0 ? person.birthday.year : 0;
  const deathYear = person.deathDate && person.deathDate.year > 0 ? person.deathDate.year : 0;

  if (birthYear && deathYear) {
    return `${birthYear}-${deathYear}`;
  }
  if (deathYear) {
    return `d. ${deathYear}`;
  }
  if (birthYear) {
    return `b. ${birthYear}`;
  }
  return '';
}

function lifespanSuffix(person: Person): string {
  const token = lifespanToken(person);
  return token ? ` (${token})` : '';
}

function deceasedSuffix(person: Person): string {
  return isDeceased(person) ? lifespanSuffix(person) : '';
}


