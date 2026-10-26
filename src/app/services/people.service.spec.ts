import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { PeopleService } from './people.service';
import { Person } from 'src/app/models/person';
import { RtdbService } from './rtdb.service';

function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    name: {
      firstGiven: 'Ada',
      firstPreferred: null,
      maiden: null,
      last: 'Lovelace',
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
    ...overrides,
  };
}

describe('PeopleService', () => {
  let service: PeopleService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let rootUpdate: jasmine.Spy;
  let capturedUpdates: Record<string, any>;

  function configure(existing: Person[]): void {
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    capturedUpdates = {};
    rootUpdate = jasmine.createSpy('update').and.callFake((updates: Record<string, any>) => {
      capturedUpdates = updates;
      return Promise.resolve();
    });
    rtdbSpy.list.and.returnValue({ valueChanges: () => of(existing) });
    rtdbSpy.object.and.returnValue({
      valueChanges: () => of(null),
      set: jasmine.createSpy('set'),
      update: rootUpdate,
      remove: jasmine.createSpy('remove'),
    });

    TestBed.configureTestingModule({
      providers: [
        PeopleService,
        { provide: RtdbService, useValue: rtdbSpy },
      ],
    });
    service = TestBed.inject(PeopleService);
  }

  it('importPeople sends one root update and leaves people outside the import untouched', async () => {
    const kept = makePerson('kept', { name: { ...makePerson('x').name, firstGiven: 'Grace' } });
    configure([kept]);

    const incoming = [
      makePerson('new-1'),
      makePerson('new-1', { name: { ...makePerson('x').name, firstGiven: 'Repeated' } }),
      makePerson('new-2'),
    ];

    const result = await firstValueFrom(service.importPeople(incoming));

    expect(rtdbSpy.object).toHaveBeenCalledWith('/');
    expect(rootUpdate).toHaveBeenCalledTimes(1);
    const updates = capturedUpdates;
    expect(Object.keys(updates)).toEqual(['people/new-1', 'people/new-2']);
    expect(updates['people/new-1'].name.firstGiven).toBe('Repeated');
    expect(updates['people/kept']).toBeUndefined();
    expect(result).toEqual({ created: 3, updated: 0, inactive: 1, conflicts: [] });
  });

  it('importPeople updates an existing id in place', async () => {
    configure([makePerson('p1')]);

    const result = await firstValueFrom(service.importPeople([makePerson('p1', { generationNumber: 4 })]));

    expect(capturedUpdates['people/p1'].generationNumber).toBe(4);
    expect(result).toEqual({ created: 0, updated: 1, inactive: 0, conflicts: [] });
  });

  it('getAncestors terminates on a cycle', () => {
    const a = makePerson('a', { parentIds: ['b'] });
    const b = makePerson('b', { parentIds: ['a'] });

    const ancestors = service.getAncestors(a, [a, b]);

    expect(ancestors.map(p => p.id)).toEqual(['b', 'a']);
  }, 2000);

  it('getDescendants includes children and grandchildren and skips spouse records', () => {
    const parent = makePerson('p1');
    const child = makePerson('c1', { parentIds: ['p1'] });
    const grandchild = makePerson('g1', { parentIds: ['c1'] });
    const spouse = makePerson('p1-S', { parentIds: ['p1'] });

    const descendants = service.getDescendants(parent, [parent, child, grandchild, spouse]);

    expect(descendants.map(p => p.id)).toEqual(['c1', 'g1']);
  });
});
