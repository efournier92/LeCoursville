import { vi } from "vitest";

interface FakeSnapshot {
  val(): unknown;
  exists(): boolean;
}

function clone<T>(value: T): T {
  return value === undefined || value === null
    ? value
    : (JSON.parse(JSON.stringify(value)) as T);
}

class Snapshot implements FakeSnapshot {
  constructor(private readonly value: unknown) {}
  val() {
    return clone(this.value);
  }
  exists() {
    return this.value !== null && this.value !== undefined;
  }
}

function compareFieldValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

class FakeQuery {
  constructor(
    private readonly db: FakeDatabase,
    private readonly path: string,
    private readonly field: string,
    private readonly value?: unknown,
    private readonly startValue?: unknown,
    private readonly endValue?: unknown,
    private readonly limit: number | null = null
  ) {}

  equalTo(value: unknown): FakeQuery {
    return new FakeQuery(
      this.db,
      this.path,
      this.field,
      value,
      this.startValue,
      this.endValue,
      this.limit
    );
  }

  startAt(value: unknown, _key?: string): FakeQuery {
    return new FakeQuery(
      this.db,
      this.path,
      this.field,
      this.value,
      value,
      this.endValue,
      this.limit
    );
  }

  endAt(value: unknown): FakeQuery {
    return new FakeQuery(
      this.db,
      this.path,
      this.field,
      this.value,
      this.startValue,
      value,
      this.limit
    );
  }

  limitToFirst(limit: number): FakeQuery {
    return new FakeQuery(
      this.db,
      this.path,
      this.field,
      this.value,
      this.startValue,
      this.endValue,
      limit
    );
  }

  async get(): Promise<FakeSnapshot> {
    const data = this.db.read(this.path);
    if (!data || typeof data !== "object") {
      return new Snapshot(null);
    }
    const rows = Object.entries(
      data as Record<string, Record<string, unknown>>
    ).filter(([, child]) => {
      if (!child || typeof child !== "object") {
        return false;
      }
      const fieldValue = child[this.field];
      if (this.value !== undefined && fieldValue !== this.value) {
        return false;
      }
      if (
        this.startValue !== undefined &&
        compareFieldValues(fieldValue, this.startValue) < 0
      ) {
        return false;
      }
      if (
        this.endValue !== undefined &&
        compareFieldValues(fieldValue, this.endValue) > 0
      ) {
        return false;
      }
      return true;
    });
    rows.sort((a, b) =>
      compareFieldValues(a[1][this.field], b[1][this.field])
    );
    const limited = this.limit === null ? rows : rows.slice(0, this.limit);
    const matches = Object.fromEntries(limited);
    return new Snapshot(Object.keys(matches).length ? matches : null);
  }
}

export class FakeRef {
  key: string | null;

  constructor(
    private readonly db: FakeDatabase,
    private readonly path: string,
    key: string | null = null
  ) {
    this.key = key;
  }

  async get(): Promise<FakeSnapshot> {
    return new Snapshot(this.db.read(this.path));
  }

  async set(value: unknown): Promise<void> {
    this.db.write(this.path, clone(value));
  }

  async update(value: Record<string, unknown>): Promise<void> {
    for (const [key, entry] of Object.entries(value)) {
      // RTDB update treats keys as paths relative to the ref, so a key may
      // carry slashes (atomic multi-path writes from the root ref).
      const target = this.path ? `${this.path}/${key}` : key;
      this.db.write(target, clone(entry));
    }
  }

  on(
    _event: "value",
    callback: (snapshot: FakeSnapshot) => void
  ): (snapshot: FakeSnapshot) => void {
    callback(new Snapshot(this.db.read(this.path)));
    return callback;
  }

  off(_event: "value", _callback: (snapshot: FakeSnapshot) => void): void {}

  async transaction(fn: (current: unknown) => unknown) {
    const current = clone(this.db.read(this.path) ?? null);
    const next = fn(current);
    if (next === undefined) {
      return { committed: false, snapshot: new Snapshot(current) };
    }
    this.db.write(this.path, clone(next));
    return { committed: true, snapshot: new Snapshot(next) };
  }

  push(key = `key${++this.db.seq}`): FakeRef {
    if (this.db.read(this.path) === null) {
      this.db.write(this.path, {});
    }
    return new FakeRef(this.db, `${this.path}/${key}`, key);
  }

  orderByChild(field: string): FakeQuery {
    return new FakeQuery(this.db, this.path, field);
  }
}

export class FakeDatabase {
  store: Record<string, unknown> = {};
  seq = 0;

  ref(path: string): FakeRef {
    return new FakeRef(this, path);
  }

  read(path: string): unknown {
    let node: unknown = this.store;
    for (const part of path.split("/").filter(Boolean)) {
      if (node === null || typeof node !== "object") {
        return null;
      }
      node = (node as Record<string, unknown>)[part];
    }
    return node ?? null;
  }

  write(path: string, value: unknown): void {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) {
      return;
    }
    let node = this.store;
    for (let i = 0; i < parts.length - 1; i++) {
      const child = node[parts[i]];
      if (child === null || typeof child !== "object") {
        node[parts[i]] = {};
      }
      node = node[parts[i]] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
}

export const fakeDb = new FakeDatabase();

export const authMock = {
  users: new Map<string, { uid: string }>(),
  setCustomUserClaims: vi.fn(async (): Promise<void> => {}),
  revokeRefreshTokens: vi.fn(async (): Promise<void> => {}),
  link: "https://lecoursville.test/auth/action?oobCode=abc",
  linkError: null as Error | null,
  async getUserByEmail(email: string) {
    const user = this.users.get(email);
    if (!user) {
      const err = new Error("no user record") as Error & { code?: string };
      err.code = "auth/user-not-found";
      throw err;
    }
    return user;
  },
  async generatePasswordResetLink(_email?: string) {
    if (this.linkError) {
      throw this.linkError;
    }
    return this.link;
  },
};

export function resetFakeState(): void {
  fakeDb.store = {};
  fakeDb.seq = 0;
  authMock.users.clear();
  authMock.setCustomUserClaims.mockClear();
  authMock.revokeRefreshTokens.mockClear();
  authMock.link = "https://lecoursville.test/auth/action?oobCode=abc";
  authMock.linkError = null;
  process.env.EMAIL_DRY_RUN = "1";
  // Default unit tests to the production transaction path; tests that exercise
  // the emulator branch set the emulator vars themselves.
  delete process.env.FUNCTIONS_EMULATOR;
  delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
}
