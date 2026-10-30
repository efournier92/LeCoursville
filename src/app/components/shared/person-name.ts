export interface NameParts {
  given?: string | null;
  surname?: string | null;
  name?: string | null;
  suffix?: string | null;
  id?: string | null;
}

/** Full display name: explicit name, else given + surname + suffix, else the id fallback. */
export function fullName(person: NameParts): string {
  return person.name || [person.given, person.surname, person.suffix].filter(Boolean).join(' ') || person.id || '';
}

/** First whitespace token, used by branch-head and couple labels. */
export function firstName(person: NameParts): string {
  return fullName(person).split(/\s+/)[0];
}
