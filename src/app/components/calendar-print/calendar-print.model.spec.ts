import { Person } from 'src/app/models/person';
import {
  CalendarPrintOptions,
  anniversaryParts,
  birthdayParts,
  buildCalendarPages,
  isDeceased,
} from './calendar-print.model';

function person(overrides: Partial<Person>): Person {
  return {
    id: 'p1',
    name: {
      firstGiven: 'Alice',
      firstPreferred: null,
      maiden: null,
      last: 'Smith',
      suffix: null,
    },
    familyId: null,
    birthday: { year: 1990, month: 5, day: 10 },
    spouseId: null,
    anniversaryDate: null,
    deathDate: null,
    emails: [],
    phones: [],
    addresses: [],
    directDescendent: false,
    generationNumber: 0,
    parentIds: [],
    lineage: null,
    isLiving: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function options(overrides: Partial<CalendarPrintOptions> = {}): CalendarPrintOptions {
  return {
    year: 2026,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    includeBirthdays: true,
    includeAnniversaries: true,
    includeDeceased: false,
    showLifespan: true,
    includeHolidays: false,
    ...overrides,
  };
}

function dayEntries(pages: ReturnType<typeof buildCalendarPages>, month: number, day: number): string[] {
  return dayCell(pages, month, day).entries.map(entry => entry.text);
}

function dayCell(pages: ReturnType<typeof buildCalendarPages>, month: number, day: number) {
  const page = pages.find(p => p.month === month)!;
  return page.weeks.flat().find(c => c.day === day)!;
}

describe('calendar print model', () => {
  it('1. renders a living birthday with the age for the printed year', () => {
    const alice = person({ birthday: { year: 1990, month: 5, day: 10 } });
    const pages = buildCalendarPages([alice], options({ year: 2026, months: [5] }));
    expect(dayEntries(pages, 5, 10)).toEqual(['Alice Smith - 36']);
  });

  it('2. skips a birthday whose import left the birth year unknown', () => {
    const alice = person({ birthday: { year: 0, month: 1, day: 1 } });
    const pages = buildCalendarPages([alice], options({ months: [1] }));
    expect(dayEntries(pages, 1, 1)).toEqual([]);
  });

  it('3. excludes a -S virtual spouse birthday that duplicates the primary', () => {
    const primary = person({ id: 'p1' });
    const spouse = person({ id: 'p1-S', name: { firstGiven: 'Vera', firstPreferred: null, maiden: null, last: 'Smith', suffix: null } });
    const pages = buildCalendarPages([primary, spouse], options({ months: [5] }));
    expect(dayEntries(pages, 5, 10)).toEqual(['Alice Smith - 36']);
  });

  it('3a. includes a -S birthday unique to the spouse', () => {
    const primary = person({ id: 'p1' });
    const spouse = person({
      id: 'p1-S',
      name: { firstGiven: 'Vera', firstPreferred: null, maiden: null, last: 'Smith', suffix: null },
      birthday: { year: 1992, month: 6, day: 20 },
    });
    const pages = buildCalendarPages([primary, spouse], options({ months: [6] }));
    expect(dayEntries(pages, 6, 20)).toEqual(['Vera Smith - 34']);
  });

  it('4. never emits a -S record anniversary as a second anniversary', () => {
    const anniversary = { year: 2010, month: 5, day: 12 };
    const primary = person({ id: 'p1', spouseId: 'p1-S', anniversaryDate: anniversary });
    const spouse = person({ id: 'p1-S', spouseId: 'p1', anniversaryDate: anniversary });
    const pages = buildCalendarPages([primary, spouse], options({ months: [5] }));
    expect(dayEntries(pages, 5, 12)).toEqual(['Alice & Alice Smith - 16']);
  });

  it('4a. emits one anniversary when both primary spouses carry the date', () => {
    const anniversary = { year: 2010, month: 5, day: 12 };
    const alice = person({ id: 'p1', spouseId: 'p2', anniversaryDate: anniversary });
    const bob = person({
      id: 'p2',
      name: { firstGiven: 'Bob', firstPreferred: null, maiden: null, last: 'Smith', suffix: null },
      spouseId: 'p1',
      anniversaryDate: anniversary,
    });
    const pages = buildCalendarPages([alice, bob], options({ months: [5] }));
    expect(dayEntries(pages, 5, 12)).toEqual(['Alice & Bob Smith - 16']);
  });

  it('5. classifies deceased from isLiving, a valid death year, and their absence', () => {
    expect(isDeceased(person({ isLiving: false }))).toBe(true);
    expect(isDeceased(person({ isLiving: true, deathDate: { year: 2015, month: 6, day: 15 } }))).toBe(true);
    expect(isDeceased(person({ isLiving: undefined as unknown as boolean, deathDate: null }))).toBe(false);
    expect(isDeceased(person({ isLiving: true, deathDate: { year: 0, month: 0, day: 0 } }))).toBe(false);
  });

  it('6. excludes deceased people from birthdays and anniversaries when includeDeceased is false', () => {
    const deceased = person({
      id: 'd1',
      isLiving: false,
      deathDate: { year: 2015, month: 6, day: 15 },
      anniversaryDate: { year: 1980, month: 5, day: 12 },
    });
    const pages = buildCalendarPages([deceased], options({ months: [5] }));
    expect(dayEntries(pages, 5, 10)).toEqual([]);
    expect(dayEntries(pages, 5, 12)).toEqual([]);
  });

  it('7. excludes an anniversary when either spouse is deceased unless includeDeceased is true', () => {
    const anniversary = { year: 1980, month: 5, day: 12 };
    const alice = person({ id: 'p1', spouseId: 'p2', anniversaryDate: anniversary });
    const bob = person({ id: 'p2', name: { firstGiven: 'Bob', firstPreferred: null, maiden: null, last: 'Smith', suffix: null }, isLiving: false, deathDate: { year: 2015, month: 6, day: 15 } });

    expect(dayEntries(buildCalendarPages([alice, bob], options({ months: [5] })), 5, 12)).toEqual([]);
    expect(dayEntries(buildCalendarPages([alice, bob], options({ months: [5], includeDeceased: true })), 5, 12))
      .toEqual(['Alice & Bob (1990-2015) Smith - 46']);
  });

  it('8. renders both lifespan years', () => {
    const alice = person({ isLiving: false, deathDate: { year: 2015, month: 6, day: 15 } });
    expect(birthdayParts(alice, options()).text).toBe('Alice Smith (1990-2015)');
  });

  it('9. renders an unknown birth year as a death-only lifespan', () => {
    const alice = person({ birthday: { year: 0, month: 5, day: 10 }, isLiving: false, deathDate: { year: 2015, month: 6, day: 15 } });
    expect(birthdayParts(alice, options()).text).toBe('Alice Smith (d. 2015)');
  });

  it('10. renders an unknown death year as a birth-only lifespan', () => {
    const alice = person({ isLiving: false, deathDate: null });
    expect(birthdayParts(alice, options()).text).toBe('Alice Smith (b. 1990)');
  });

  it('11. renders just the name when both lifespan years are unknown', () => {
    const alice = person({ birthday: { year: 0, month: 5, day: 10 }, isLiving: false, deathDate: null });
    expect(birthdayParts(alice, options()).text).toBe('Alice Smith');
  });

  it('12. renders the age when showLifespan is false', () => {
    const alice = person({ isLiving: false, deathDate: { year: 2015, month: 6, day: 15 } });
    expect(birthdayParts(alice, options({ year: 2015, showLifespan: false })).text).toBe('Alice Smith - 25');
  });

  it('13. never stacks an age and a lifespan', () => {
    const alice = person({ isLiving: false, deathDate: { year: 2015, month: 6, day: 15 } });
    const entry = birthdayParts(alice, options()).text;
    expect(entry).toBe('Alice Smith (1990-2015)');
    expect(entry).not.toContain(' - ');
  });

  it('14. renders a shared-surname anniversary', () => {
    const alice = person({ id: 'p1', spouseId: 'p2', anniversaryDate: { year: 1980, month: 5, day: 12 } });
    const bob = person({ id: 'p2', name: { firstGiven: 'Bob', firstPreferred: null, maiden: null, last: 'Smith', suffix: null } });
    expect(anniversaryParts(alice, bob, options()).text).toBe('Alice & Bob Smith - 46');
  });

  it('15. renders a different-surname anniversary', () => {
    const alice = person({ id: 'p1', spouseId: 'p2', anniversaryDate: { year: 1980, month: 5, day: 12 } });
    const bob = person({ id: 'p2', name: { firstGiven: 'Bob', firstPreferred: null, maiden: null, last: 'Jones', suffix: null } });
    expect(anniversaryParts(alice, bob, options()).text).toBe('Alice Smith & Bob Jones - 46');
  });

  it('16. renders the primary name when the spouse does not resolve', () => {
    const alice = person({ id: 'p1', spouseId: 'missing', anniversaryDate: { year: 1980, month: 5, day: 12 } });
    expect(anniversaryParts(alice, null, options()).text).toBe('Alice Smith - 46');
  });

  it('17. places a deceased spouse lifespan after that spouse name', () => {
    const alice = person({ id: 'p1', spouseId: 'p2', anniversaryDate: { year: 1980, month: 5, day: 12 } });
    const bob = person({
      id: 'p2',
      name: { firstGiven: 'Bob', firstPreferred: null, maiden: null, last: 'Smith', suffix: null },
      isLiving: false,
      deathDate: { year: 2022, month: 3, day: 1 },
      birthday: { year: 1951, month: 4, day: 2 },
    });
    expect(anniversaryParts(alice, bob, options()).text).toBe('Alice & Bob (1951-2022) Smith - 46');
  });

  it('18. renders a 02-29 birthday on February 28 in a non-leap year', () => {
    const alice = person({ birthday: { year: 2000, month: 2, day: 29 } });
    const pages = buildCalendarPages([alice], options({ year: 2026, months: [2] }));
    expect(dayEntries(pages, 2, 28)).toEqual(['Alice Smith - 26']);
    expect(pages[0].weeks.flat().some(cell => cell.day === 29)).toBe(false);
  });

  it('19. builds a Sunday-first grid whose row count matches the weeks the month spans', () => {
    const pages = buildCalendarPages([], options());
    for (const page of pages) {
      expect(page.weeks.length).toBeGreaterThanOrEqual(4);
      expect(page.weeks.length).toBeLessThanOrEqual(6);
      page.weeks.forEach(week => expect(week).toHaveLength(7));
      const lastWeek = page.weeks[page.weeks.length - 1];
      expect(lastWeek.some(cell => cell.day !== null)).toBe(true);
    }
    const may = pages.find(p => p.month === 5)!;
    const mayFirst = may.weeks.flat().findIndex(cell => cell.day === 1);
    expect(mayFirst % 7).toBe(5); // May 1 2026 is a Friday, index 5 in Sunday-first order.
  });

  it('19a. February 2026 spans exactly 4 weeks', () => {
    // Feb 1 2026 is a Sunday (weekday 0) and February 2026 has 28 days: ceil((0 + 28) / 7) = 4.
    const page = buildCalendarPages([], options({ months: [2] }))[0];
    expect(page.weeks).toHaveLength(4);
  });

  it('19b. March 2026 spans exactly 5 weeks', () => {
    // Mar 1 2026 is a Sunday (weekday 0) and March has 31 days: ceil((0 + 31) / 7) = 5.
    const page = buildCalendarPages([], options({ months: [3] }))[0];
    expect(page.weeks).toHaveLength(5);
  });

  it('19c. May 2026 spans exactly 6 weeks', () => {
    // May 1 2026 is a Friday (weekday 5) and May has 31 days: ceil((5 + 31) / 7) = 6.
    const page = buildCalendarPages([], options({ months: [5] }))[0];
    expect(page.weeks).toHaveLength(6);
  });

  it('20. leaves leading and trailing cells outside the month empty', () => {
    const pages = buildCalendarPages([], options({ months: [5] }));
    const cells = pages[0].weeks.flat();
    expect(cells.filter(cell => cell.day === null).length).toBeGreaterThan(0);
    expect(cells.find(cell => cell.day === null)!.entries).toEqual([]);
  });

  it('21. orders birthdays before anniversaries, then alphabetically', () => {
    const anniversary = { year: 1980, month: 5, day: 10 };
    const alice = person({ id: 'p1', name: { firstGiven: 'Alice', firstPreferred: null, maiden: null, last: 'Smith', suffix: null } });
    const bob = person({ id: 'p2', name: { firstGiven: 'Bob', firstPreferred: null, maiden: null, last: 'Smith', suffix: null } });
    const couple = person({ id: 'p3', birthday: { year: 1980, month: 1, day: 1 }, spouseId: 'p4', anniversaryDate: anniversary });
    const partner = person({
      id: 'p4',
      birthday: { year: 1980, month: 1, day: 1 },
      name: { firstGiven: 'Carol', firstPreferred: null, maiden: null, last: 'LeBlanc', suffix: null },
    });
    const pages = buildCalendarPages([couple, partner, bob, alice], options({ months: [5] }));
    const entries = dayEntries(pages, 5, 10);
    expect(entries.slice(0, 2)).toEqual(['Alice Smith - 36', 'Bob Smith - 36']);
    expect(entries[2]).toContain('&');
  });

  it('22. yields one empty-grid page for a month with no entries', () => {
    const pages = buildCalendarPages([], options({ months: [7] }));
    expect(pages).toHaveLength(1);
    expect(pages[0].weeks.flat().every(cell => cell.entries.length === 0)).toBe(true);
  });

  it('23. yields one page for single-month and twelve for a full year', () => {
    expect(buildCalendarPages([], options({ months: [5] }))).toHaveLength(1);
    expect(buildCalendarPages([], options())).toHaveLength(12);
  });

  it('24. includes holidays when enabled', () => {
    const pages = buildCalendarPages([], options({ months: [12], includeHolidays: true }));
    expect(dayEntries(pages, 12, 25)).toEqual(['Christmas Day']);
  });

  it('25. omits holidays when disabled', () => {
    const pages = buildCalendarPages([], options({ months: [12], includeHolidays: false }));
    expect(dayEntries(pages, 12, 25)).toEqual([]);
  });

  it('26. preserves the holiday kind', () => {
    const pages = buildCalendarPages([], options({ months: [12], includeHolidays: true }));
    expect(dayCell(pages, 12, 25).entries[0]).toEqual({
      text: 'Christmas Day',
      kind: 'holiday',
      label: 'Christmas Day',
      token: '',
    });
  });

  it('27. sorts a holiday before birthdays and anniversaries on the same day', () => {
    const alice = person({ birthday: { year: 1990, month: 7, day: 4 } });
    const pages = buildCalendarPages([alice], options({ months: [7], includeHolidays: true }));
    const entries = dayCell(pages, 7, 4).entries;
    expect(entries[0]).toEqual({
      text: 'Independence Day',
      kind: 'holiday',
      label: 'Independence Day',
      token: '',
    });
    expect(entries[1].kind).toBe('birthday');
  });

  it('28. splits a living birthday into a name label and an age token', () => {
    const alice = person({ birthday: { year: 1990, month: 5, day: 10 } });
    expect(birthdayParts(alice, options({ year: 2026 }))).toEqual({
      label: 'Alice Smith',
      token: '36',
      text: 'Alice Smith - 36',
    });
  });

  it('29. splits a deceased lifespan into a label and an unparenthesized token', () => {
    const edith = person({
      name: { firstGiven: 'Edith', firstPreferred: null, maiden: null, last: 'Evans', suffix: null },
      birthday: { year: 1935, month: 1, day: 10 },
      isLiving: false,
      deathDate: { year: 2015, month: 6, day: 15 },
    });
    expect(birthdayParts(edith, options())).toEqual({
      label: 'Edith Evans',
      token: '1935-2015',
      text: 'Edith Evans (1935-2015)',
    });
  });

  it('30. leaves the token empty when the birth year is unknown', () => {
    const alice = person({ birthday: { year: 0, month: 5, day: 10 } });
    expect(birthdayParts(alice, options())).toEqual({
      label: 'Alice Smith',
      token: '',
      text: 'Alice Smith',
    });
  });

  it('31. splits an anniversary into a suffix-free label and a years token', () => {
    const alice = person({ id: 'p1', spouseId: 'p2', anniversaryDate: { year: 1980, month: 5, day: 12 } });
    const bob = person({ id: 'p2', name: { firstGiven: 'Bob', firstPreferred: null, maiden: null, last: 'Smith', suffix: null } });
    expect(anniversaryParts(alice, bob, options())).toEqual({
      label: 'Alice & Bob Smith',
      token: '46',
      text: 'Alice & Bob Smith - 46',
    });
  });

  it('32. renders all eight entries with no more line when a day has exactly eight', () => {
    const people = Array.from({ length: 8 }, (_, i) => person({
      id: `p${i}`,
      name: { firstGiven: `Person${i}`, firstPreferred: null, maiden: null, last: 'Dawson', suffix: null },
      birthday: { year: 1990, month: 7, day: 4 },
    }));
    const cell = dayCell(buildCalendarPages(people, options({ months: [7] })), 7, 4);
    expect(cell.entries).toHaveLength(8);
    expect(cell.moreCount).toBe(0);
  });

  it('33. renders seven entries and a more count of four when a day has eleven', () => {
    const people = Array.from({ length: 11 }, (_, i) => person({
      id: `p${i}`,
      name: { firstGiven: `Person${i}`, firstPreferred: null, maiden: null, last: 'Dawson', suffix: null },
      birthday: { year: 1990, month: 7, day: 4 },
    }));
    const cell = dayCell(buildCalendarPages(people, options({ months: [7] })), 7, 4);
    expect(cell.entries).toHaveLength(7);
    expect(cell.moreCount).toBe(4);
  });

  it('34. hides an age token when the printed year precedes the birth year', () => {
    const alice = person({ birthday: { year: 1990, month: 5, day: 10 } });
    const pages = buildCalendarPages([alice], options({ year: 1900, months: [5] }));
    expect(dayEntries(pages, 5, 10)).toEqual(['Alice Smith']);
  });

  it('35. hides an anniversary years token when the printed year precedes the wedding', () => {
    const alice = person({ id: 'p1', spouseId: 'p2', anniversaryDate: { year: 1990, month: 5, day: 12 } });
    const bob = person({ id: 'p2', name: { firstGiven: 'Bob', firstPreferred: null, maiden: null, last: 'Smith', suffix: null } });
    expect(anniversaryParts(alice, bob, options({ year: 1900 }))).toEqual({
      label: 'Alice & Bob Smith',
      token: '',
      text: 'Alice & Bob Smith',
    });
  });

  it('36. caps a day by estimated wrapped lines and reports the dropped entries', () => {
    const people = Array.from({ length: 6 }, (_, i) => person({
      id: `p${i}`,
      name: { firstGiven: `Person${i}Longname`, firstPreferred: null, maiden: null, last: 'Dawson', suffix: null },
      birthday: { year: 1990, month: 7, day: 4 },
    }));
    const cell = dayCell(buildCalendarPages(people, options({ months: [7] })), 7, 4);
    expect(cell.entries).toHaveLength(3);
    expect(cell.moreCount).toBe(3);
  });

  it('37. treats 1900 and 2100 as non-leap and 2000 as leap for a 02-29 birthday', () => {
    const alice = person({ birthday: { year: 1896, month: 2, day: 29 } });

    const page1900 = buildCalendarPages([alice], options({ year: 1900, months: [2] }))[0];
    expect(dayEntries([page1900], 2, 28)).toEqual(['Alice Smith - 4']);
    expect(page1900.weeks.flat().some(cell => cell.day === 29)).toBe(false);

    const page2000 = buildCalendarPages([alice], options({ year: 2000, months: [2] }))[0];
    expect(dayEntries([page2000], 2, 29)).toEqual(['Alice Smith - 104']);

    const page2100 = buildCalendarPages([alice], options({ year: 2100, months: [2] }))[0];
    expect(dayEntries([page2100], 2, 28)).toEqual(['Alice Smith - 204']);
    expect(page2100.weeks.flat().some(cell => cell.day === 29)).toBe(false);
  });
});
