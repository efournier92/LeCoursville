/** First four-digit year in a GEDCOM-ish date string. */
export function yearOf(date: string | null | undefined): string {
  return (date || '').match(/\b\d{4}\b/)?.[0] || '';
}

/** En-dash year span, or whichever year exists. */
export function yearsSpan(birth: string | null | undefined, death: string | null | undefined): string {
  const starts = yearOf(birth);
  const ends = yearOf(death);
  if (starts && ends) {
    return `${starts}\u2013${ends}`;
  }
  return starts || ends;
}

export function yearsOf(person: { birthDate?: string | null; deathDate?: string | null }): string {
  return yearsSpan(person.birthDate, person.deathDate);
}

function monthName(month: number): string {
  return new Date(2026, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

/** `YYYY-MM-DD` -> en-US long month/day/year; anything else returned raw. */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (full) {
    const year = Number(full[1]);
    const month = Number(full[2]);
    const day = Number(full[3]);
    // Reject rollover dates like 1901-02-30 by checking the Date kept the components.
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return iso;
    }
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return iso;
}

/** `YYYY-MM` -> `Month YYYY`; anything else returned raw. */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const month = /^(\d{4})-(\d{2})$/.exec(iso);
  if (month) {
    const monthNumber = Number(month[2]);
    if (monthNumber < 1 || monthNumber > 12) {
      return iso;
    }
    return `${monthName(monthNumber)} ${month[1]}`;
  }
  return iso;
}
