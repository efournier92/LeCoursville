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
  authMock.link = "https://lecoursville.test/auth/action?oobCode=abc";
  authMock.linkError = null;
  process.env.EMAIL_DRY_RUN = "1";
  // Default unit tests to the production transaction path; tests that exercise
  // the emulator branch set the emulator vars themselves.
  delete process.env.FUNCTIONS_EMULATOR;
  delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
}
