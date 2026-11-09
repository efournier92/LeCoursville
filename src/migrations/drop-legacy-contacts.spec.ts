// @ts-ignore -- the migration runner is plain ESM with no type declarations.
import {
  CONTACTS_NODE,
  contactsWriteRule,
  main,
  parseArgs,
  summarizeContacts,
} from '../../scripts/migrations/drop-legacy-contacts.mjs';

const CLEAN_RULES = { rules: {} };

function makeDb({ contacts = null, deployedRules = CLEAN_RULES }: any = {}) {
  const store: Record<string, any> = { [CONTACTS_NODE]: contacts };
  const refCalls: string[] = [];
  const removed: string[] = [];
  const db = {
    getRules: vi.fn(async () => JSON.stringify(deployedRules)),
    ref: vi.fn((node: string) => {
      refCalls.push(node);
      return {
        get: vi.fn(async () => ({ val: () => (node in store ? store[node] : null) })),
        remove: vi.fn(async () => {
          removed.push(node);
          delete store[node];
        }),
      };
    }),
  };
  return { db, store, refCalls, removed };
}

function makeDeps(db: any, checkedInRules = CLEAN_RULES) {
  const admin = {
    initializeApp: vi.fn(),
    getApp: () => ({ delete: vi.fn(async () => {}) }),
  };
  return { admin, getDatabase: () => db, readCheckedInRules: () => checkedInRules };
}

describe('drop-legacy-contacts migration', () => {
  it('requires an explicit project id', () => {
    expect(() => parseArgs([])).toThrow(/--project/);
    expect(parseArgs(['--project', 'lecoursville-dev']).project).toBe('lecoursville-dev');
  });

  it('defaults to a dry run and only deletes with --confirm', () => {
    expect(parseArgs(['--project', 'lecoursville-dev']).confirm).toBe(false);
    expect(
      parseArgs(['--project', 'lecoursville-dev', '--confirm', '--acknowledge-people-source'])
        .confirm,
    ).toBe(true);
  });

  it('requires the People source acknowledgement before --confirm', () => {
    expect(() => parseArgs(['--project', 'lecoursville-dev', '--confirm'])).toThrow(
      /--acknowledge-people-source/,
    );
  });

  it('accepts only the known dev and prod project ids', () => {
    expect(parseArgs(['--project', 'lecoursville']).project).toBe('lecoursville');
    expect(() => parseArgs(['--project', 'some-other-project'])).toThrow(/not allowed/);
  });

  it('rejects unknown arguments, including the old --rules bypass', () => {
    expect(() => parseArgs(['--project', 'lecoursville-dev', '--force'])).toThrow(/unknown argument/);
    expect(() =>
      parseArgs(['--project', 'lecoursville-dev', '--rules', 'other.rules.json']),
    ).toThrow(/unknown argument/);
  });

  it('detects a top-level write rule on the contacts node', () => {
    const rules = {
      rules: {
        contacts: { '.read': 'auth != null', '.write': 'auth != null' },
      },
    };
    expect(contactsWriteRule(rules)).toBe('auth != null');
  });

  it('detects a nested $id write grant (C-118)', () => {
    const rules = { rules: { contacts: { $id: { '.write': 'auth != null' } } } };
    expect(contactsWriteRule(rules)).toBe('auth != null');
  });

  it('returns null when the contacts write rule is absent', () => {
    expect(contactsWriteRule({ rules: {} })).toBeNull();
    expect(contactsWriteRule({ rules: { contacts: { '.read': 'auth != null' } } })).toBeNull();
    expect(contactsWriteRule({ rules: { contacts: null } })).toBeNull();
  });

  it('reports zero records for an absent or empty node', () => {
    expect(summarizeContacts(null)).toEqual({ records: 0, bytes: 4 });
    expect(summarizeContacts({})).toEqual({ records: 0, bytes: 2 });
  });

  it('counts top-level records and serialized bytes', () => {
    const node = { 'contact-1': { name: 'One' }, 'contact-2': { name: 'Two' } };
    const result = summarizeContacts(node);
    expect(result.records).toBe(2);
    expect(result.bytes).toBe(Buffer.byteLength(JSON.stringify(node)));
  });

  it('dry run reads deployed rules but performs no remove (C-119)', async () => {
    const { db, store, removed } = makeDb({ contacts: { 'contact-1': { name: 'One' } } });

    await main(['--project', 'lecoursville-dev'], makeDeps(db));

    expect(db.getRules).toHaveBeenCalled();
    expect(removed).toEqual([]);
    expect(store[CONTACTS_NODE]).toEqual({ 'contact-1': { name: 'One' } });
  });

  it('--confirm removes only contacts and leaves other nodes intact (C-120)', async () => {
    const { db, store, refCalls, removed } = makeDb({
      contacts: { 'contact-1': { name: 'One' } },
    });
    store.people = { 'person-1': { name: 'Person' } };

    const result = await main(
      ['--project', 'lecoursville-dev', '--confirm', '--acknowledge-people-source'],
      makeDeps(db),
    );

    expect(result).toMatchObject({ removed: true, after: { records: 0 } });
    expect(removed).toEqual([CONTACTS_NODE]);
    expect(refCalls.every((node) => node === CONTACTS_NODE)).toBe(true);
    expect(store.people).toEqual({ 'person-1': { name: 'Person' } });
    expect(store[CONTACTS_NODE]).toBeUndefined();
  });

  it('a second --confirm run is a zero-exit no-op (C-120)', async () => {
    const { db, removed } = makeDb({ contacts: { 'contact-1': { name: 'One' } } });
    const deps = makeDeps(db);
    const args = ['--project', 'lecoursville-dev', '--confirm', '--acknowledge-people-source'];

    await main(args, deps);
    await expect(main(args, deps)).resolves.toMatchObject({ removed: false, before: { records: 0 } });

    expect(removed).toEqual([CONTACTS_NODE]);
  });

  it('refuses through main() when the checked-in rules grant a write (C-121)', async () => {
    const { db, removed } = makeDb();
    const deps = makeDeps(db, { rules: { contacts: { '.write': 'auth != null' } } });

    await expect(main(['--project', 'lecoursville-dev'], deps)).rejects.toThrow(/checked-in|database.rules.json/);
    expect(deps.admin.initializeApp).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it('refuses through main() when deployed rules grant a nested write (C-111, C-121)', async () => {
    const { db, removed } = makeDb({
      contacts: { 'contact-1': { name: 'One' } },
      deployedRules: { rules: { contacts: { $id: { '.write': 'auth != null' } } } },
    });

    await expect(main(['--project', 'lecoursville-dev'], makeDeps(db))).rejects.toThrow(
      /deployed rules/,
    );
    expect(removed).toEqual([]);
  });

  it('fails after the delete when records remain (C-116)', async () => {
    const { db, store } = makeDb({ contacts: { 'contact-1': { name: 'One' } } });
    db.ref = vi.fn((node: string) => ({
      get: vi.fn(async () => ({ val: () => store[node] })),
      remove: vi.fn(async () => {}),
    }));

    await expect(
      main(
        ['--project', 'lecoursville-dev', '--confirm', '--acknowledge-people-source'],
        makeDeps(db),
      ),
    ).rejects.toThrow(/records remain after delete/);
  });
});
