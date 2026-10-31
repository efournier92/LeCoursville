import {
  hasBracketChords,
  layoutChordOver,
  segmentSongBody,
  transposeBody,
  transposeKeyName,
} from './chord-transpose';

describe('chord-transpose', () => {
  it('detects bracket chords and bracket-less bodies (35)', () => {
    expect(hasBracketChords('Amazing [G]grace')).toBe(true);
    expect(hasBracketChords('Amazing grace')).toBe(false);
  });

  it('raises a natural root with sharp spelling and wraps within an octave (36)', () => {
    expect(transposeBody('[G]', 1)).toBe('[G#]');
    expect(transposeBody('[B]', 1)).toBe('[C]');
  });

  it('keeps flat roots flat and spells naturals sharp (37)', () => {
    expect(transposeBody('[Bb]', 2)).toBe('[C]');
    expect(transposeBody('[D]', -1)).toBe('[Db]');
  });

  it('preserves chord suffixes (38)', () => {
    expect(transposeBody('[G7]', 2)).toBe('[A7]');
    expect(transposeBody('[Bm7]', -2)).toBe('[Am7]');
  });

  it('transposes the slash bass (39)', () => {
    expect(transposeBody('[G/B]', 1)).toBe('[G#/C]');
  });

  it('leaves non-chord brackets and surrounding text byte-identical (40)', () => {
    const body = '[Verse] Do [Do] re [G]mi';

    expect(transposeBody(body, 2)).toBe('[Verse] Do [Do] re [A]mi');
  });

  it('returns the identical string at offset 0 (41)', () => {
    const body = '[G] [Bb/D] [Verse]';

    expect(transposeBody(body, 0)).toBe(body);
  });

  it('transposes a bare key name and rejects anything that is not one note (42)', () => {
    expect(transposeKeyName('G', 1)).toBe('G#');
    expect(transposeKeyName('Bb', 2)).toBe('C');
    expect(transposeKeyName('Gm', 2)).toBeNull();
    expect(transposeKeyName('H', 2)).toBeNull();
  });

  it('segments bracket chords, chord lines, and plain text without changing bytes (43)', () => {
    const body = '[G]Amazing grace\nA          D\nPlain [Verse] line\n\n[Bb/D]Ends';
    const lines = segmentSongBody(body);

    expect(lines.map(line => line.segments.map(segment => segment.text).join('')).join('\n')).toBe(body);

    // Bracket chord keeps its brackets and is tinted inside a lyric line.
    expect(lines[0].segments).toEqual([
      { text: '[G]', kind: 'chord' },
      { text: 'Amazing grace', kind: 'text' },
    ]);

    // A line of bare chord tokens is a chord line; its spacing stays text.
    expect(lines[1].segments).toEqual([
      { text: 'A', kind: 'chord-line' },
      { text: '          ', kind: 'text' },
      { text: 'D', kind: 'chord-line' },
    ]);

    // A bracket that is not a chord stays plain text on a lyric line.
    expect(lines[2].segments).toEqual([{ text: 'Plain [Verse] line', kind: 'text' }]);
    expect(lines[3].segments).toEqual([]);
    expect(lines[4].segments).toEqual([
      { text: '[Bb/D]', kind: 'chord' },
      { text: 'Ends', kind: 'text' },
    ]);
  });

  it('derives a chord line above its lyric line at the right columns (44)', () => {
    const lines = layoutChordOver('[G]Amazing grace [D]how sweet');

    expect(lines).toEqual([
      { text: 'G' + ' '.repeat(13) + 'D', kind: 'chord-line' },
      { text: 'Amazing grace how sweet', kind: 'lyric' },
    ]);
    expect(lines.map(line => line.text).join('\n')).not.toMatch(/[[\]]/);
  });

  it('leaves chord-over input verbatim on its own lines (45)', () => {
    const body = 'A          D\nBlessed be the name\nA          E\nBlessed be the name';
    const lines = layoutChordOver(body);

    expect(lines).toEqual([
      { text: 'A          D', kind: 'chord-line' },
      { text: 'Blessed be the name', kind: 'plain' },
      { text: 'A          E', kind: 'chord-line' },
      { text: 'Blessed be the name', kind: 'plain' },
    ]);
  });

  it('keeps plain and empty lines and preserves empty lines (46)', () => {
    const lines = layoutChordOver('Hello world\n\n[Verse] note');

    expect(lines).toEqual([
      { text: 'Hello world', kind: 'plain' },
      { text: '', kind: 'plain' },
      { text: '[Verse] note', kind: 'plain' },
    ]);
  });
});
