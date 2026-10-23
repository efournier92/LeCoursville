import { vi } from 'vitest';

vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  onValue: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  push: vi.fn(),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  orderByChild: vi.fn((child: string) => ({ child })),
  equalTo: vi.fn((value: unknown) => ({ value })),
  limitToFirst: vi.fn((limit: number) => ({ limit })),
}));

type RtdbModule = typeof import('./rtdb.service');

describe('RtdbService', () => {
  let RtdbListRef: RtdbModule['RtdbListRef'];
  let RtdbService: RtdbModule['RtdbService'];
  let rxjs: typeof import('rxjs');
  let db: any;

  beforeAll(async () => {
    vi.resetModules();
    rxjs = await import('rxjs');
    db = await import('firebase/database');
    const mod = await import('./rtdb.service');
    RtdbListRef = mod.RtdbListRef;
    RtdbService = mod.RtdbService;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db.ref.mockImplementation((_db: unknown, path: string) => ({ path }));
  });

  function emit(snapshot: { val: () => unknown; key?: string | null }): void {
    db.onValue.mockImplementation((_ref: unknown, callback: (snap: any) => void) => {
      callback(snapshot);
      return () => undefined;
    });
  }

  it('list valueChanges maps null to an empty array', async () => {
    const list = new RtdbListRef<{ id: string }>({} as any, 'people');
    emit({ val: () => null });

    expect(await rxjs.firstValueFrom(list.valueChanges())).toEqual([]);
  });

  it('list valueChanges maps an object to its values', async () => {
    const list = new RtdbListRef<{ id: string }>({} as any, 'people');
    emit({ val: () => ({ a: { id: 'a' }, b: { id: 'b' } }) });

    expect(await rxjs.firstValueFrom(list.valueChanges())).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('snapshotChanges keeps the database keys', async () => {
    const list = new RtdbListRef<{ id: string }>({} as any, 'people');
    emit({ val: () => ({ a: { id: 'a' }, b: { id: 'b' } }) });

    expect(await rxjs.firstValueFrom(list.snapshotChanges())).toEqual([
      { key: 'a', value: { id: 'a' } },
      { key: 'b', value: { id: 'b' } },
    ]);
  });

  it('createPushId delegates to one push under pushIds', () => {
    db.push.mockReturnValue({ key: 'push-1' });
    const service = new RtdbService({ db: {} } as any);

    expect(service.createPushId()).toBe('push-1');
    expect(db.push).toHaveBeenCalledTimes(1);
    expect(db.ref).toHaveBeenCalledWith({}, 'pushIds');
  });
});
