import { Person } from 'src/app/models/person';
import { parseSongText } from './song-parser';

function makePerson(id: string, firstPreferred: string | null, firstGiven: string | null): Person {
  return {
    id,
    name: {
      firstGiven,
      firstPreferred,
      maiden: null,
      last: null,
      suffix: null,
    },
    familyId: null,
    birthday: null as any,
    spouseId: null,
    anniversaryDate: null,
    deathDate: null,
    emails: [],
    phones: [],
    addresses: [],
    directDescendent: false,
    generationNumber: 1,
    parentIds: [],
    lineage: null,
    isLiving: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

const ada = makePerson('p-ada', 'Ada', 'Adaline');
const grace = makePerson('p-grace', null, 'Grace');
const eric = makePerson('p-eric', null, 'Éric');

describe('parseSongText', () => {
  it('parses a header block, trimming every value (27)', () => {
    const raw = 'Title:  Amazing Grace  \nSource: John Newton  \nKey:  G  \nLeader:  Ada  \n\nAmazing grace how sweet\nthe sound';

    const result = parseSongText(raw, [ada]);

    expect(result.title).toBe('Amazing Grace');
    expect(result.source).toBe('John Newton');
    expect(result.musicalKey).toBe('G');
    expect(result.leaderIds).toEqual(['p-ada']);
    expect(result.body).toBe('Amazing grace how sweet\nthe sound');
  });

  it('lets the last duplicate title win (28)', () => {
    const result = parseSongText('Title: First\nTitle: Second\nbody', []);

    expect(result.title).toBe('Second');
  });

  it('uses the first non-empty line as the title when no header exists (29)', () => {
    const raw = '\n\n  My Song  \nline one\nline two\n';

    const result = parseSongText(raw, []);

    expect(result.title).toBe('My Song');
    expect(result.body).toBe('line one\nline two');
  });

  it('matches a leader by firstPreferred and falls back to firstGiven (30)', () => {
    const result = parseSongText('Title: T\nLeader: Ada\nLeader: Grace', [ada, grace]);

    expect(result.leaderIds).toEqual(['p-ada', 'p-grace']);
    expect(result.unmatchedLeaders).toEqual([]);
  });

  it('deduplicates a leader named more than once', () => {
    const result = parseSongText('Title: T\nLeader: Ada\nLeader: Ada\nLeader: Ada', [ada]);

    expect(result.leaderIds).toEqual(['p-ada']);
    expect(result.unmatchedLeaders).toEqual([]);
  });

  it('folds case and diacritics when matching leaders (31)', () => {
    const result = parseSongText('Title: T\nLeader: eric', [eric]);

    expect(result.leaderIds).toEqual(['p-eric']);
    expect(result.unmatchedLeaders).toEqual([]);
  });

  it('reports unmatched leader names separately (32)', () => {
    const result = parseSongText('Title: T\nLeader: Ada\nLeader: Nobody', [ada]);

    expect(result.leaderIds).toEqual(['p-ada']);
    expect(result.unmatchedLeaders).toEqual(['Nobody']);
  });

  it('handles blank lines: leading skipped, header separator dropped, internal kept, trailing trimmed (33)', () => {
    const raw = '\n\nTitle: T\n\nfirst\n\nthird\n\n\n';

    const result = parseSongText(raw, []);

    expect(result.title).toBe('T');
    expect(result.body).toBe('first\n\nthird');
  });

  it('returns empty fields for empty input without throwing (34)', () => {
    const result = parseSongText('', []);

    expect(result).toEqual({
      title: '',
      body: '',
      source: null,
      musicalKey: null,
      leaderIds: [],
      unmatchedLeaders: [],
    });
  });
});
