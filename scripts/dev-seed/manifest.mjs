/**
 * Dev seed manifest (UI-008). Every seeded record lives under the `devseed-`
 * id prefix, and every downloaded object under the `dev-seed/` Storage prefix,
 * so a rerun or --clean can replace exactly this data and nothing else.
 *
 * Asset sources resolve at seed time from Internet Archive and the Library of
 * Congress. Nothing here is fetched during the e2e gate. The matching license
 * record is scripts/dev-seed/LICENSE_LEDGER.md.
 */

export const PROJECT = 'lecoursville-dev';
export const ID_PREFIX = 'devseed-';
export const STORAGE_PREFIX = 'dev-seed/';
const EXPECTED_ID_PREFIX = 'devseed-';
const EXPECTED_STORAGE_PREFIX = 'dev-seed/';

/** Refuses an empty or drifted namespace before any clean or write. */
export function assertSeedNamespace(idPrefix = ID_PREFIX, storagePrefix = STORAGE_PREFIX) {
  if (!idPrefix || !storagePrefix
    || idPrefix !== EXPECTED_ID_PREFIX || storagePrefix !== EXPECTED_STORAGE_PREFIX) {
    throw new Error(
      `refusing to seed: namespace "${idPrefix}" / "${storagePrefix}" is not `
        + `"${EXPECTED_ID_PREFIX}" / "${EXPECTED_STORAGE_PREFIX}".`,
    );
  }
}
export const OWNER_ID = `${ID_PREFIX}owner`;
export const OWNER_NAME = 'Dev Seed Owner';

export const ASSET_SOURCES = {
  videos: {
    provider: 'internet-archive',
    query: 'collection:prelinger AND mediatype:movies',
    want: 20,
    extensions: ['.mp4', '.webm'],
    license: 'Public domain',
    attribution: 'Prelinger Archives, Internet Archive',
  },
  photoAlbums: {
    provider: 'library-of-congress',
    searchPath: 'photos',
    query: 'national park',
    want: 9,
    perAlbum: 3,
    license: 'Public domain',
    attribution: 'Library of Congress, Prints and Photographs Division',
  },
  audioAlbums: {
    provider: 'internet-archive',
    query: 'collection:great78 AND mediatype:audio',
    want: 6,
    perAlbum: 2,
    extensions: ['.mp3', '.ogg', '.flac'],
    license: 'Public domain',
    attribution: 'Great 78 Project, Internet Archive',
  },
};

export const FAMILIES = [
  { name: 'Alder', hexColor: '#3B7A57', sortOrder: 'A', members: ['Ada', 'Alton', 'Amara', 'Amos', 'Ansel', 'Aubrey'] },
  { name: 'Birch', hexColor: '#8B5E3C', sortOrder: 'B', members: ['Bea', 'Bertram', 'Blythe', 'Bram', 'Briony', 'Basil'] },
  { name: 'Cedar', hexColor: '#4F6D8A', sortOrder: 'C', members: ['Cora', 'Cyril', 'Celeste', 'Casper', 'Clement', 'Cassia'] },
  { name: 'Dogwood', hexColor: '#9A4B57', sortOrder: 'D', members: ['Dara', 'Desmond', 'Daphne', 'Dorian', 'Delia', 'Dexter'] },
];

export const EXPRESSIONS = [
  { title: 'Give me liberty', body: 'Give me liberty, or give me death!', attribution: 'Patrick Henry', yearWritten: '1775' },
  { title: 'Self-evident truths', body: 'We hold these truths to be self-evident, that all men are created equal.', attribution: 'Thomas Jefferson', yearWritten: '1776' },
  { title: 'Four score', body: 'Four score and seven years ago our fathers brought forth on this continent a new nation.', attribution: 'Abraham Lincoln', yearWritten: '1863' },
  { title: 'To be or not to be', body: 'To be, or not to be, that is the question.', attribution: 'William Shakespeare', yearWritten: '1600' },
  { title: 'All the world is a stage', body: "All the world's a stage, and all the men and women merely players.", attribution: 'William Shakespeare', yearWritten: '1599' },
  { title: 'The best of times', body: 'It was the best of times, it was the worst of times.', attribution: 'Charles Dickens', yearWritten: '1859' },
  { title: 'Call me Ishmael', body: 'Call me Ishmael.', attribution: 'Herman Melville', yearWritten: '1851' },
  { title: 'I celebrate myself', body: 'I celebrate myself, and sing myself.', attribution: 'Walt Whitman', yearWritten: '1855' },
  { title: 'Quiet desperation', body: 'The mass of men lead lives of quiet desperation.', attribution: 'Henry David Thoreau', yearWritten: '1854' },
  { title: 'Trust thyself', body: 'Trust thyself: every heart vibrates to that iron string.', attribution: 'Ralph Waldo Emerson', yearWritten: '1841' },
  { title: 'Knowledge is power', body: 'Knowledge is power.', attribution: 'Francis Bacon', yearWritten: '1597' },
  { title: 'No man is an island', body: 'No man is an island, entire of itself.', attribution: 'John Donne', yearWritten: '1624' },
  { title: 'The unexamined life', body: 'The unexamined life is not worth living.', attribution: 'Socrates, as recorded by Plato', yearWritten: 'c. 399 BC' },
  { title: 'I think therefore I am', body: 'I think, therefore I am.', attribution: 'Rene Descartes', yearWritten: '1637' },
  { title: 'The pen and the sword', body: 'The pen is mightier than the sword.', attribution: 'Edward Bulwer-Lytton', yearWritten: '1839' },
  { title: 'Brevity is the soul of wit', body: 'Brevity is the soul of wit.', attribution: 'William Shakespeare', yearWritten: '1602' },
  { title: 'To err is human', body: 'To err is human, to forgive divine.', attribution: 'Alexander Pope', yearWritten: '1711' },
  { title: 'A thing of beauty', body: 'A thing of beauty is a joy for ever.', attribution: 'John Keats', yearWritten: '1818' },
  { title: 'Water everywhere', body: 'Water, water, every where, nor any drop to drink.', attribution: 'Samuel Taylor Coleridge', yearWritten: '1798' },
  { title: 'Reports of my death', body: 'The reports of my death are greatly exaggerated.', attribution: 'Mark Twain', yearWritten: '1897' },
];

export const SONGS = [
  {
    title: 'Amazing Grace',
    body: '[G]Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see',
    source: 'John Newton',
    musicalKey: 'G',
  },
  {
    title: 'Come Thou Fount',
    body: 'Come thou fount of every blessing\nTune my heart to sing thy grace\nStreams of mercy never ceasing\nCall for songs of loudest praise',
    source: 'Robinson',
    musicalKey: 'D',
  },
  {
    title: 'Simple Gifts',
    body: "Tis the gift to be simple, tis the gift to be free\nTis the gift to come down where we ought to be",
    source: 'Joseph Brackett',
    musicalKey: 'F',
  },
  {
    title: 'Wayfaring Stranger',
    body: "I'm just a poor wayfaring stranger\nWhile traveling through this world of woe",
    source: 'Traditional',
    musicalKey: 'Am',
  },
  {
    title: 'Be Thou My Vision',
    body: 'Be thou my vision, O Lord of my heart\nNaught be all else to me, save that thou art',
    source: 'Traditional, translated by Mary Byrne',
    musicalKey: 'Eb',
  },
];

/** Stable, fictional people built from the four families above. */
export function buildPeople() {
  const people = {};
  FAMILIES.forEach((family, familyIndex) => {
    const familyId = `${ID_PREFIX}family-${familyIndex + 1}`;
    family.members.forEach((first, memberIndex) => {
      const id = `${ID_PREFIX}person-${familyIndex + 1}-${memberIndex + 1}`;
      const year = 1920 + familyIndex * 10 + memberIndex * 7;
      const month = (memberIndex % 12) + 1;
      const day = ((memberIndex * 3) % 27) + 1;
      const deceased = memberIndex >= 4;
      const paired = memberIndex < 4 && memberIndex % 2 === 0;
      people[id] = {
        id,
        name: {
          firstGiven: first,
          firstPreferred: first,
          maiden: null,
          last: family.name,
          suffix: null,
        },
        familyId,
        birthday: { year, month, day },
        spouseId: paired ? `${ID_PREFIX}person-${familyIndex + 1}-${memberIndex + 2}` : null,
        anniversaryDate: paired ? { year: year + 24, month, day } : null,
        deathDate: deceased ? { year: year + 82, month, day } : null,
        emails: [{ address: `${first.toLowerCase()}.${family.name.toLowerCase()}@devseed.example`, label: null }],
        phones: [{ label: 'Home', number: `555-01${String(familyIndex * 6 + memberIndex + 1).padStart(2, '0')}` }],
        addresses: [{
          id: null,
          full: `${first} ${family.name}`,
          street: `${memberIndex + 1} ${family.name} Lane`,
          city: 'Fairview',
          state: 'ZZ',
          zip: `0000${familyIndex + 1}`,
          label: 'Home',
        }],
        directDescendent: false,
        generationNumber: Math.min(3, memberIndex + 1),
        parentIds: memberIndex >= 2 ? [`${ID_PREFIX}person-${familyIndex + 1}-1`] : [],
        lineage: null,
        isLiving: !deceased,
        createdAt: 0,
        updatedAt: 0,
      };
    });
  });
  return people;
}

/** Contacts are a derived view over people; no separate contacts node exists. */
export function buildContacts(people) {
  return Object.values(people).map((person) => ({
    id: `${person.id}-contact`,
    personId: person.id,
    email: person.emails[0]?.address ?? '',
    phone: person.phones[0]?.number ?? '',
    address: person.addresses[0]?.full ?? '',
  }));
}

/** Calendar events are derived from people birthdays and anniversaries. */
export function buildCalendarEvents(people) {
  const events = [];
  for (const person of Object.values(people)) {
    events.push({ id: `${person.id}-birthday`, personId: person.id, kind: 'birthday', date: person.birthday });
    if (person.anniversaryDate) {
      events.push({ id: `${person.id}-anniversary`, personId: person.id, kind: 'anniversary', date: person.anniversaryDate });
    }
  }
  return events;
}

export function buildManifest() {
  const people = buildPeople();
  return {
    project: PROJECT,
    families: FAMILIES.map((family, index) => ({
      id: `${ID_PREFIX}family-${index + 1}`,
      name: family.name,
      hexColor: family.hexColor,
      sortOrder: family.sortOrder,
    })),
    people,
    contacts: buildContacts(people),
    calendarEvents: buildCalendarEvents(people),
    expressions: EXPRESSIONS.map((expression, index) => ({
      id: `${ID_PREFIX}expression-${index + 1}`,
      ...expression,
    })),
    songs: SONGS.map((song, index) => ({
      id: `${ID_PREFIX}song-${index + 1}`,
      ...song,
    })),
    assetSources: ASSET_SOURCES,
  };
}
