import {
  hasBracketChords,
  hasChords,
  layoutChordOver,
  lyricsOnlyBody,
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
      {
        text: 'G' + ' '.repeat(13) + 'D',
        kind: 'chord-line',
        segments: [
          { text: 'G', chord: true },
          { text: ' '.repeat(13), chord: false },
          { text: 'D', chord: true },
        ],
      },
      {
        text: 'Amazing grace how sweet',
        kind: 'lyric',
        segments: [{ text: 'Amazing grace how sweet', chord: false }],
      },
    ]);
    expect(lines.map(line => line.text).join('\n')).not.toMatch(/[[\]]/);
  });

  it('leaves chord-over input verbatim on its own lines (45)', () => {
    const body = 'A          D\nBlessed be the name\nA          E\nBlessed be the name';
    const lines = layoutChordOver(body);

    expect(lines).toEqual([
      {
        text: 'A          D',
        kind: 'chord-line',
        segments: [
          { text: 'A', chord: true },
          { text: '          ', chord: false },
          { text: 'D', chord: true },
        ],
      },
      {
        text: 'Blessed be the name',
        kind: 'plain',
        segments: [{ text: 'Blessed be the name', chord: false }],
      },
      {
        text: 'A          E',
        kind: 'chord-line',
        segments: [
          { text: 'A', chord: true },
          { text: '          ', chord: false },
          { text: 'E', chord: true },
        ],
      },
      {
        text: 'Blessed be the name',
        kind: 'plain',
        segments: [{ text: 'Blessed be the name', chord: false }],
      },
    ]);
  });

  it('keeps plain and empty lines and preserves empty lines (46)', () => {
    const lines = layoutChordOver('Hello world\n\n[Verse] note');

    expect(lines).toEqual([
      { text: 'Hello world', kind: 'plain', segments: [{ text: 'Hello world', chord: false }] },
      { text: '', kind: 'plain', segments: [{ text: '', chord: false }] },
      { text: '[Verse] note', kind: 'plain', segments: [{ text: '[Verse] note', chord: false }] },
    ]);
  });

  it('detects chords and strips only chord lines for a lyrics-only body (47)', () => {
    expect(hasChords('[G]Amazing grace [D]how sweet\nThat saved a wretch')).toBe(true);
    expect(lyricsOnlyBody('[G]Amazing grace [D]how sweet\nThat saved a wretch')).toBe(
      'Amazing grace how sweet\nThat saved a wretch',
    );

    expect(hasChords('A          D\nBlessed be the name')).toBe(true);
    expect(lyricsOnlyBody('A          D\nBlessed be the name')).toBe('Blessed be the name');

    const lyrics = 'Come thou fount\nTune my heart';
    expect(hasChords(lyrics)).toBe(false);
    expect(lyricsOnlyBody(lyrics)).toBe(lyrics);
  });
});
