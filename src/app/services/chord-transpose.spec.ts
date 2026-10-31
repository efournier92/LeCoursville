import { hasBracketChords, transposeBody } from './chord-transpose';

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
});
