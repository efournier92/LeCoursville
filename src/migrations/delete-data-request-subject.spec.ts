// @ts-ignore -- the migration runner is plain ESM with no type declarations.
import {
  assertGrantedRemoval,
  main,
  parseArgs,
  validateTargetPath,
} from '../../scripts/migrations/delete-data-request-subject.mjs';

const REQUEST_ID = 'Request1234567890ab';
const TARGET = 'people/person-1';

function grantedRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    kind: 'removal',
    dataClass: 'people',
    status: 'resolved',
    verifiedAt: 1000,
    verifiedBy: 'admin-uid',
    grantedAt: 2000,
    grantedBy: 'admin-uid',
    ...overrides,
  };
}

function makeDb({
  request = grantedRequest(),
  target = { id: 'person-1', name: 'Person One' },
}: { request?: unknown; target?: unknown } = {}) {
  const store: Record<string, unknown> = {
    [`dataRequests/${REQUEST_ID}`]: request,
    [TARGET]: target,
  };
  const events: string[] = [];
  const db = {
    ref: vi.fn((path: string) => ({
      get: vi.fn(async () => ({ val: () => store[path] ?? null })),
      remove: vi.fn(async () => {
        events.push(`remove:${path}`);
        delete store[path];
      }),
      push: vi.fn((value: unknown) => {
        events.push(`audit:${JSON.stringify(value)}`);
        return { key: 'audit-key-1' };
      }),
    })),
  };
  return { db, store, events };
}

function makeDeps(db: any, events: string[]) {
  const admin = {
    initializeApp: vi.fn(),
    getApp: () => ({ delete: vi.fn(async () => {}) }),
  };
  return {
    admin,
    getDatabase: () => db,
    now: () => 5000,
    writeFile: vi.fn((file: string, content: string) => {
      events.push(`write:${file}:${content}`);
    }),
  };
}

const base = [
  '--project', 'lecoursville-dev',
  '--request-id', REQUEST_ID,
  '--path', TARGET,
  '--export', '/tmp/export.json',
  '--actor', 'admin-uid',
];

describe('delete-data-request-subject migration', () => {
  it('defaults to a dry run and requires every operator argument', () => {
    expect(parseArgs(base).confirm).toBe(false);
    expect(parseArgs([...base, '--confirm']).confirm).toBe(true);
    expect(() => parseArgs(['--project', 'lecoursville-dev'])).toThrow(/--request-id/);
    expect(() => parseArgs(base.filter(arg => arg !== '--export' && arg !== '/tmp/export.json')))
      .toThrow(/--export/);
  });

  it('allowlists the five target classes and rejects traversal', () => {
    expect(validateTargetPath('people/person-1')[0]).toBe('people');
    expect(() => validateTargetPath('contacts/contact-1')).toThrow(/class must be/);
    expect(() => validateTargetPath('people/../users/admin')).toThrow(/traversal|\.\./);
    expect(() => validateTargetPath('people')).toThrow(/--path must be/);
  });

  it('refuses a request that is not granted and verified', () => {
    expect(() => assertGrantedRemoval(grantedRequest({ kind: 'update' }), 'people', REQUEST_ID))
      .toThrow(/not removal/);
    expect(() => assertGrantedRemoval(grantedRequest({ status: 'open' }), 'people', REQUEST_ID))
      .toThrow(/not resolved/);
    expect(() => assertGrantedRemoval(grantedRequest({ verifiedAt: undefined }), 'people', REQUEST_ID))
      .toThrow(/identity verification/);
    expect(() => assertGrantedRemoval(grantedRequest({ grantedAt: undefined }), 'people', REQUEST_ID))
      .toThrow(/granted removal decision/);
    expect(() => assertGrantedRemoval(grantedRequest(), 'photos', REQUEST_ID))
      .toThrow(/names people/);
  });

  it('a dry run reads but writes, audits, and deletes nothing', async () => {
    const { db, store, events } = makeDb();

    const result = await main(base, makeDeps(db, events));

    expect(result).toMatchObject({ deleted: false, exported: false, found: true });
    expect(events).toEqual([]);
    expect(store[TARGET]).toEqual({ id: 'person-1', name: 'Person One' });
  });

  it('writes the export before the delete and audits the completed deletion', async () => {
    const { db, store, events } = makeDb();

    const result = await main([...base, '--confirm'], makeDeps(db, events));

    expect(result).toMatchObject({ deleted: true, exported: true, auditKey: 'audit-key-1' });
    expect(events.map(event => event.split(':')[0])).toEqual(['write', 'remove', 'audit']);
    expect(events[0]).toContain('"targetPath": "people/person-1"');
    expect(events[0]).toContain('"name": "Person One"');
    expect(events[1]).not.toContain('Person One');
    expect(store[TARGET]).toBeUndefined();
  });

  it('does nothing when the target record is already gone', async () => {
    const { db, events } = makeDb({ target: null });

    const result = await main([...base, '--confirm'], makeDeps(db, events));

    expect(result).toEqual({ deleted: false, exported: false });
    expect(events).toEqual([]);
  });

  it('refuses before writing an export when the request does not match', async () => {
    const { db, events } = makeDb({ request: grantedRequest({ verifiedAt: undefined }) });

    await expect(main([...base, '--confirm'], makeDeps(db, events)))
      .rejects.toThrow(/identity verification/);
    expect(events).toEqual([]);
  });
});
