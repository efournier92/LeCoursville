import { HOLIDAYS, getHolidayForDate, getHolidaysForYear } from './calendar-holidays';

describe('calendar holidays', () => {
  it('defines the twelve holidays in calendar order', () => {
    expect(HOLIDAYS.length).toBe(12);
    expect(HOLIDAYS[0].name).toBe("New Year’s Day");
    expect(HOLIDAYS[11].name).toBe("New Year’s Eve");
  });

  it('resolves all twelve holidays for 2026', () => {
    expect(getHolidaysForYear(2026)).toEqual([
      { name: "New Year’s Day", month: 1, day: 1 },
      { name: 'Easter Sunday', month: 4, day: 5 },
      { name: "Mother’s Day", month: 5, day: 10 },
      { name: 'Memorial Day', month: 5, day: 25 },
      { name: "Father’s Day", month: 6, day: 21 },
      { name: 'Independence Day', month: 7, day: 4 },
      { name: 'Labor Day', month: 9, day: 7 },
      { name: 'Halloween', month: 10, day: 31 },
      { name: 'Thanksgiving', month: 11, day: 26 },
      { name: 'Christmas Eve', month: 12, day: 24 },
      { name: 'Christmas Day', month: 12, day: 25 },
      { name: "New Year’s Eve", month: 12, day: 31 },
    ]);
  });

  it('resolves the movable rules for a second year', () => {
    const holidays = getHolidaysForYear(2025);
    const dateOf = (name: string) => holidays.find((holiday) => holiday.name === name);

    expect(dateOf('Easter Sunday')).toEqual({ name: 'Easter Sunday', month: 4, day: 20 });
    expect(dateOf("Mother’s Day")).toEqual({ name: "Mother’s Day", month: 5, day: 11 });
    expect(dateOf('Memorial Day')).toEqual({ name: 'Memorial Day', month: 5, day: 26 });
    expect(dateOf("Father’s Day")).toEqual({ name: "Father’s Day", month: 6, day: 15 });
    expect(dateOf('Labor Day')).toEqual({ name: 'Labor Day', month: 9, day: 1 });
    expect(dateOf('Thanksgiving')).toEqual({ name: 'Thanksgiving', month: 11, day: 27 });
  });

  it('resolves a last-weekday holiday that lands on the final day of the month', () => {
    // Memorial Day is the last Monday of May; 2021 and 2027 both land on May 31.
    for (const year of [2021, 2027]) {
      expect(getHolidayForDate(year, 5, 31)).toBe('Memorial Day');
    }
  });

  it('finds a holiday by date and returns null for ordinary days', () => {
    expect(getHolidayForDate(2026, 12, 25)).toBe('Christmas Day');
    expect(getHolidayForDate(2026, 4, 5)).toBe('Easter Sunday');
    expect(getHolidayForDate(2026, 12, 26)).toBeNull();
  });
});
