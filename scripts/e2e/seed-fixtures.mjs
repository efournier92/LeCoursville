/**
 * Pure family-explorer fixtures; names are invented, no real genealogy.
 * Exported as builders so e2e specs restore byte-identical archives.
 * This module must stay side-effect free and import nothing meta — Playwright
 * transpiles spec-imported .mjs to CommonJS, which cannot tolerate either.
 */

export const famPerson = (id, given, surname, extra = {}) => ({
  id,
  given,
  surname,
  name: `${given} ${surname}`,
  suffix: null,
  sex: extra.sex ?? 'M',
  birthDate: extra.birthDate ?? null,
  birthPlace: extra.birthPlace ?? null,
  deathDate: extra.deathDate ?? null,
  deathPlace: extra.deathPlace ?? null,
  burialDate: null,
  burialPlace: null,
  occupation: extra.occupation ?? null,
  fatherId: extra.fatherId ?? null,
  motherId: extra.motherId ?? null,
  spouseIds: extra.spouseIds ?? [],
  childIds: extra.childIds ?? [],
  marriageYears: extra.marriageYears ?? {},
  note: extra.note ?? null,
});

export const FERLAND_ARCHIVE = (now, adminUid) => ({
  title: 'Ferland Family',
  published: true,
  updatedAt: now,
  updatedBy: adminUid,
  people: {
    'fa-1': famPerson('fa-1', 'Ferdinand', 'Fern', { sex: 'M', birthDate: '1901-01-05', birthPlace: 'Fairview', deathDate: '1980-03-02', occupation: 'Farrier', spouseIds: ['fa-2'], childIds: ['fa-3', 'fa-4'], marriageYears: { 'fa-2': 1925 }, note: 'Kept a notebook of family recipes.' }),
    'fa-2': famPerson('fa-2', 'Fabienne', 'Fern', { sex: 'F', birthDate: '1904-07-11', spouseIds: ['fa-1'], childIds: ['fa-3', 'fa-4'], marriageYears: { 'fa-1': 1925 } }),
    'fa-3': famPerson('fa-3', 'Felix', 'Fern', { sex: 'M', birthDate: '1926-04-18', fatherId: 'fa-1', motherId: 'fa-2', spouseIds: ['fa-5'], childIds: ['fa-6'], marriageYears: { 'fa-5': 1948 } }),
    'fa-4': famPerson('fa-4', 'Fiona', 'Fern', { sex: 'F', birthDate: '1929-09-30', fatherId: 'fa-1', motherId: 'fa-2' }),
    'fa-5': famPerson('fa-5', 'Florence', 'Firth', { sex: 'F', birthDate: '1928-02-14', spouseIds: ['fa-3'], childIds: ['fa-6'], marriageYears: { 'fa-3': 1948 } }),
    'fa-6': famPerson('fa-6', 'Faron', 'Fern', { sex: 'M', birthDate: '1950-12-01', occupation: 'Fiddler', fatherId: 'fa-3', motherId: 'fa-5', childIds: ['fa-7'] }),
    'fa-7': famPerson('fa-7', 'Freya', 'Fern', { sex: 'F', birthDate: '1975-05-05', fatherId: 'fa-6' }),
    'fb-1': famPerson('fb-1', 'Barnaby', 'Birch', { sex: 'M', birthDate: '1910-06-06', spouseIds: ['fb-2'], marriageYears: { 'fb-2': 1935 } }),
    'fb-2': famPerson('fb-2', 'Beatrix', 'Birch', { sex: 'F', birthDate: '1912-08-09', spouseIds: ['fb-1'], marriageYears: { 'fb-1': 1935 } }),
  },
});

export const WOLF_ARCHIVE = (adminUid) => ({
  title: 'Wolf Family',
  published: false,
  updatedBy: adminUid,
  people: {
    'w-1': famPerson('w-1', 'Walter', 'Wolf', { spouseIds: ['w-2'], childIds: [], marriageYears: { 'w-2': 1950 } }),
    'w-2': famPerson('w-2', 'Wilma', 'Wolf', { sex: 'F', spouseIds: ['w-1'], childIds: [] }),
  },
});
