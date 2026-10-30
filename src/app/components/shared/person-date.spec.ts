import { formatLongDate, formatMonthYear, yearOf, yearsOf, yearsSpan } from './person-date';

describe('person-date', () => {
  it('extracts the first four-digit year', () => {
    expect(yearOf('ABT 1901')).toBe('1901');
    expect(yearOf('1901-01-05')).toBe('1901');
    expect(yearOf(null)).toBe('');
    expect(yearOf(undefined)).toBe('');
  });

  it('renders an en-dash span and single years', () => {
    expect(yearsSpan('1901-01-05', '1970-12-31')).toBe('1901\u20131970');
    expect(yearsSpan('1901', null)).toBe('1901');
    expect(yearsSpan(null, '1970')).toBe('1970');
    expect(yearsSpan('', '')).toBe('');
  });

  it('derives a span from a person', () => {
    expect(yearsOf({ birthDate: '1901-01-05', deathDate: '1970-12-31' })).toBe('1901\u20131970');
    expect(yearsOf({ birthDate: null, deathDate: null })).toBe('');
  });

  it('formats full dates as en-US long dates', () => {
    expect(formatLongDate('1901-01-05')).toBe('January 5, 1901');
    expect(formatLongDate('1901-02-30')).toBe('1901-02-30');
    expect(formatLongDate('')).toBe('');
    expect(formatLongDate('1901')).toBe('1901');
  });

  it('formats month-only dates and passes everything else through', () => {
    expect(formatMonthYear('1901-01')).toBe('January 1901');
    expect(formatMonthYear('1901-13')).toBe('1901-13');
    expect(formatMonthYear('1901-01-05')).toBe('1901-01-05');
    expect(formatMonthYear('spring')).toBe('spring');
    expect(formatMonthYear(undefined)).toBe('');
  });
});
