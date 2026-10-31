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
