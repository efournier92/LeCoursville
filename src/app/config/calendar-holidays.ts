export type HolidayRule =
  | { kind: 'fixed'; name: string; month: number; day: number }
  | { kind: 'nth-weekday'; name: string; month: number; weekday: number; occurrence: number }
  | { kind: 'last-weekday'; name: string; month: number; weekday: number }
  | { kind: 'easter'; name: string };

export interface CalendarHoliday {
  name: string;
  month: number;
  day: number;
}

// Months are 1-12 and weekdays follow JavaScript's convention (0 = Sunday).
export const HOLIDAYS: readonly HolidayRule[] = [
  { kind: 'fixed', name: "New Year’s Day", month: 1, day: 1 },
  { kind: 'easter', name: 'Easter Sunday' },
  { kind: 'nth-weekday', name: "Mother’s Day", month: 5, weekday: 0, occurrence: 2 },
  { kind: 'last-weekday', name: 'Memorial Day', month: 5, weekday: 1 },
  { kind: 'nth-weekday', name: "Father’s Day", month: 6, weekday: 0, occurrence: 3 },
  { kind: 'fixed', name: 'Independence Day', month: 7, day: 4 },
  { kind: 'nth-weekday', name: 'Labor Day', month: 9, weekday: 1, occurrence: 1 },
  { kind: 'fixed', name: 'Halloween', month: 10, day: 31 },
  { kind: 'nth-weekday', name: 'Thanksgiving', month: 11, weekday: 4, occurrence: 4 },
  { kind: 'fixed', name: 'Christmas Eve', month: 12, day: 24 },
  { kind: 'fixed', name: 'Christmas Day', month: 12, day: 25 },
  { kind: 'fixed', name: "New Year’s Eve", month: 12, day: 31 },
];

export function getHolidaysForYear(year: number): CalendarHoliday[] {
  return HOLIDAYS
    .map((rule) => resolveRule(rule, year))
    .sort((a, b) => a.month - b.month || a.day - b.day);
}

export function getHolidayForDate(year: number, month: number, day: number): string | null {
  const holiday = getHolidaysForYear(year).find(
    (candidate) => candidate.month === month && candidate.day === day,
  );
  return holiday ? holiday.name : null;
}

function resolveRule(rule: HolidayRule, year: number): CalendarHoliday {
  switch (rule.kind) {
    case 'fixed':
      return { name: rule.name, month: rule.month, day: rule.day };
    case 'easter': {
      const { month, day } = easterSunday(year);
      return { name: rule.name, month, day };
    }
    case 'nth-weekday': {
      const firstWeekday = dayOfWeek(year, rule.month, 1);
      const day = 1 + ((rule.weekday - firstWeekday + 7) % 7) + (rule.occurrence - 1) * 7;
      return { name: rule.name, month: rule.month, day };
    }
    case 'last-weekday': {
      const lastDay = daysInMonth(year, rule.month);
      const lastWeekday = dayOfWeek(year, rule.month, lastDay);
      const day = lastDay - ((lastWeekday - rule.weekday + 7) % 7);
      return { name: rule.name, month: rule.month, day };
    }
  }
}

// Anonymous Gregorian computus.
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// Sakamoto's algorithm; avoids Date so the result is timezone-independent.
export function dayOfWeek(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  return (
    adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400) +
    offsets[month - 1] +
    day
  ) % 7;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
