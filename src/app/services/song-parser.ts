import { Person } from 'src/app/models/person';

export interface ParsedSong {
  title: string;
  body: string;
  source: string | null;
  musicalKey: string | null;
  leaderIds: string[];
  unmatchedLeaders: string[];
}

const HEADER_LINE = /^(title|source|key|leader)\s*:\s*(.*)$/i;

function fold(value: string | null | undefined): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function parseSongText(raw: string, people: Person[]): ParsedSong {
  let lines = raw.split('\n');

  // Skip leading blank lines.
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  let title = '';
  let source: string | null = null;
  let musicalKey: string | null = null;
  const leaderCandidates: string[] = [];
  let headerMatched = false;
  let cursor = 0;

  while (cursor < lines.length) {
    const match = lines[cursor].match(HEADER_LINE);
    if (!match) { break; }
    headerMatched = true;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    cursor++;
    if (value === '') { continue; }
    if (key === 'title') { title = value; }
    else if (key === 'source') { source = value; }
    else if (key === 'key') { musicalKey = value; }
    else { leaderCandidates.push(value); }
  }

  let bodyLines: string[];

  if (headerMatched) {
    // The blank line that ends a header block is structural, not part of the body.
    if (cursor < lines.length && lines[cursor].trim() === '') {
      cursor++;
    }
    bodyLines = lines.slice(cursor);
  } else {
    // Header-less input: first non-empty line is the title, the rest the body.
    if (lines.length > 0) {
      title = lines[0].trim();
      bodyLines = lines.slice(1);
    } else {
      bodyLines = [];
    }
  }

  const body = trimTrailingBlankLines(bodyLines.join('\n'));

  const leaderIds: string[] = [];
  const unmatchedLeaders: string[] = [];

  for (const candidate of leaderCandidates) {
    const folded = fold(candidate);
    if (folded === '') { continue; }
    const person = people.find(p =>
      fold(p.name.firstPreferred) === folded || fold(p.name.firstGiven) === folded
    );
    if (person) {
      if (!leaderIds.includes(person.id)) {
        leaderIds.push(person.id);
      }
    } else {
      unmatchedLeaders.push(candidate);
    }
  }

  return {
    title,
    body,
    source,
    musicalKey,
    leaderIds,
    unmatchedLeaders,
  };
}

/** Saved lyrics drop the same trailing blank lines the parser drops. */
export function trimTrailingBlankLines(value: string): string {
  const lines = value.split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  return lines.join('\n');
}
