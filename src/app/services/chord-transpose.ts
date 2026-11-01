export const BRACKET_CHORD = /\[([A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add|M)?[0-9]*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?)\]/g;

const LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function accidentalOffset(accidental: string): number {
  if (accidental === '#') { return 1; }
  if (accidental === 'b') { return -1; }
  return 0;
}

function transposeNote(letter: string, accidental: string, semitones: number): string {
  const base = LETTER_SEMITONES[letter] + accidentalOffset(accidental);
  const target = ((base + semitones) % 12 + 12) % 12;
  // Flats stay flat and downward shifts spell flats; all other moves spell sharps.
  const names = accidental === 'b' || semitones < 0 ? FLAT_NAMES : SHARP_NAMES;
  return names[target];
}

function transposeChord(chord: string, semitones: number): string {
  const match = chord.match(/^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/);
  if (!match) { return chord; }
  const [, rootLetter, rootAccidental, suffix, bassLetter, bassAccidental] = match;

  let result = transposeNote(rootLetter, rootAccidental, semitones) + suffix;
  if (bassLetter) {
    result += '/' + transposeNote(bassLetter, bassAccidental || '', semitones);
  }
  return result;
}

/** Transposes a bare note name ("G", "Bb"); null when it is not a single note. */
export function transposeKeyName(key: string, semitones: number): string | null {
  const match = key.trim().match(/^([A-G])([#b]?)$/);
  if (!match) { return null; }
  return transposeNote(match[1], match[2], semitones);
}

export function hasBracketChords(body: string): boolean {
  return new RegExp(BRACKET_CHORD.source).test(body);
}

export function transposeBody(body: string, semitones: number): string {
  if (semitones === 0) { return body; }
  return body.replace(
    new RegExp(BRACKET_CHORD.source, 'g'),
    (_full: string, chord: string) => '[' + transposeChord(chord, semitones) + ']',
  );
}

/** One renderable run of a song line; `text` keeps the literal source bytes. */
export type SongSegmentKind = 'text' | 'chord' | 'chord-line';

export interface SongSegment {
  text: string;
  kind: SongSegmentKind;
}

export interface SongLine {
  segments: SongSegment[];
}

// A bare chord token: letter, optional accidental, quality/digits, slash bass.
const BARE_CHORD_TOKEN = /^[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add|M)?[0-9]*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/;
const BRACKET_CHORD_TOKEN = new RegExp('^' + BRACKET_CHORD.source + '$');

function isChordToken(token: string): boolean {
  return BARE_CHORD_TOKEN.test(token) || BRACKET_CHORD_TOKEN.test(token);
}

/** Appends `text`, tinting bare chord tokens when the whole line is chords. */
function pushTextRun(out: SongSegment[], text: string, chordLine: boolean): void {
  if (!text) { return; }
  if (!chordLine) {
    out.push({ text, kind: 'text' });
    return;
  }
  for (const part of text.split(/(\s+)/)) {
    if (!part) { continue; }
    out.push({ text: part, kind: /^\s+$/.test(part) ? 'text' : 'chord-line' });
  }
}

/** One renderable run of a chord-over line; spaces stay their own run. */
export interface ChordOverSegment {
  text: string;
  chord: boolean;
}

/** One display line of the derived chord-over presentation. */
export interface ChordOverLine {
  text: string;
  kind: 'chord-line' | 'lyric' | 'plain';
  segments: ChordOverSegment[];
}

function chordOverSegments(text: string, kind: ChordOverLine['kind']): ChordOverSegment[] {
  if (kind !== 'chord-line') {
    return [{ text, chord: false }];
  }
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map(part => ({ text: part, chord: !/^\s+$/.test(part) }));
}

function chordOverLine(text: string, kind: ChordOverLine['kind']): ChordOverLine {
  return { text, kind, segments: chordOverSegments(text, kind) };
}

/**
 * Derives the chord-over presentation from a bracket-inline body. Bracket lines
 * expand into a chord line above their lyric line; every other line is kept as
 * a verbatim chord line or plain text.
 */
export function layoutChordOver(body: string): ChordOverLine[] {
  const out: ChordOverLine[] = [];
  for (const rawLine of body.split('\n')) {
    const pattern = new RegExp(BRACKET_CHORD.source, 'g');
    const matches = Array.from(rawLine.matchAll(pattern));
    if (matches.length === 0) {
      const tokens = rawLine.split(/\s+/).filter(Boolean);
      const chordLine = tokens.length > 0 && tokens.every(isChordToken);
      out.push(chordOverLine(rawLine, chordLine ? 'chord-line' : 'plain'));
      continue;
    }

    let lyric = '';
    let chordLine = '';
    let cursor = 0;
    for (const match of matches) {
      lyric += rawLine.slice(cursor, match.index);
      const column = lyric.length;
      if (chordLine.length > column) {
        chordLine += ' ';
      }
      while (chordLine.length < column) {
        chordLine += ' ';
      }
      chordLine += match[1];
      cursor = match.index + match[0].length;
    }
    lyric += rawLine.slice(cursor);

    const trimmed = chordLine.replace(/ +$/, '');
    if (trimmed) {
      out.push(chordOverLine(trimmed, 'chord-line'));
    }
    out.push(chordOverLine(lyric, 'lyric'));
  }
  return out;
}

/** True when the body has at least one chord-only line in either notation. */
export function hasChords(body: string): boolean {
  return layoutChordOver(body).some(line => line.kind === 'chord-line');
}

/** The body with every chord line removed, suitable for a lyrics-only sheet. */
export function lyricsOnlyBody(body: string): string {
  return layoutChordOver(body)
    .filter(line => line.kind !== 'chord-line')
    .map(line => line.text)
    .join('\n');
}

/**
 * Splits a song body into lines of segments for safe interpolation rendering.
 * Bracket chords become `chord` segments (brackets kept verbatim); a line whose
 * non-space tokens are all chords turns its tokens into `chord-line` segments.
 * Joining every segment with "\n" between lines reproduces the input bytes.
 */
export function segmentSongBody(body: string): SongLine[] {
  return body.split('\n').map(rawLine => {
    const tokens = rawLine.split(/\s+/).filter(Boolean);
    const chordLine = tokens.length > 0 && tokens.every(isChordToken);
    const segments: SongSegment[] = [];
    const pattern = new RegExp(BRACKET_CHORD.source, 'g');
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(rawLine)) !== null) {
      pushTextRun(segments, rawLine.slice(cursor, match.index), chordLine);
      segments.push({ text: match[0], kind: 'chord' });
      cursor = match.index + match[0].length;
    }
    pushTextRun(segments, rawLine.slice(cursor), chordLine);

    // An empty line yields no segments; the template still emits its newline.
    return { segments };
  });
}
