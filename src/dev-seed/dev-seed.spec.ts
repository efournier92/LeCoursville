// @ts-ignore -- the dev seed is plain ESM with no type declarations.
import {
  cleanDevRecords,
  main,
  readExisting,
  resolveMode,
  upload,
} from '../../scripts/dev-seed/index.mjs';
// @ts-ignore
import { downloadAll, verifyArchiveChecksum } from '../../scripts/dev-seed/downloader.mjs';
// @ts-ignore
import {
  assertSeedNamespace,
  buildCalendarEvents,
  buildContacts,
  buildManifest,
  buildPeople,
  ID_PREFIX,
  STORAGE_PREFIX,
} from '../../scripts/dev-seed/manifest.mjs';
// @ts-ignore
import {
  assertDevCredential,
  assertDevProject,
  assertManifestProject,
  assertProjectConfig,
  credentialProjectFromFile,
  DEV_PROJECT,
  expectedProjectConfig,
  resolveProjectId,
} from '../../scripts/dev-seed/project-guard.mjs';
// @ts-ignore
import { buildPerAssetLedger } from '../../scripts/dev-seed/ledger.mjs';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeDb(store: Record<string, any> = {}) {
  const updates: Array<[string, any]> = [];
  const db = {
    ref: (node: string) => ({
      get: async () => ({ val: () => (node in store ? store[node] : null) }),
      update: async (value: any) => {
        updates.push([node, value]);
      },
    }),
    updates,
  };
  return { db, store, updates };
}

function makeBucket(files: any[] = [], failName?: string) {
  return {
    name: `${DEV_PROJECT}.appspot.com`,
    getFiles: async ({ prefix }: { prefix: string }) => [files.filter((file) => file.name.startsWith(prefix))],
    file: (destination: string) => ({
      save: vi.fn(async () => ({ destination })),
    }),
  };
}

function makeDeps(overrides: Record<string, any> = {}) {
  const { db, store, updates } = makeDb();
  const bucket = makeBucket();
  return {
    db,
    store,
    updates,
    bucket,
    deps: {
      initAdmin: () => ({
        admin: { getApp: () => ({ delete: vi.fn(async () => {}) }) },
        db,
        bucket,
      }),
      downloadAll: async () => ({ videos: [], photoAlbums: [], audioAlbums: [] }),
      cleanupCache: () => {},
      resolveCredentialProject: async () => DEV_PROJECT,
      ...overrides,
    },
  };
}

describe('dev seed project guard', () => {
  it('refuses any project but the exact dev project', () => {
    expect(() => assertDevProject(DEV_PROJECT)).not.toThrow();
    expect(() => assertDevProject('lecoursville')).toThrow(/refusing to seed/);
    expect(() => assertDevProject(undefined)).toThrow(/refusing to seed/);
  });

  it('resolves the project from argv, then env, then .firebaserc', () => {
    const root = mkdtempSync(join(tmpdir(), 'devseed-guard-'));
    writeFileSync(join(root, '.firebaserc'), JSON.stringify({ projects: { default: 'from-rc' } }));
    try {
      expect(resolveProjectId(['--project', 'from-argv'], {}, root)).toBe('from-argv');
      expect(resolveProjectId([], { GCLOUD_PROJECT: 'from-env' }, root)).toBe('from-env');
      expect(resolveProjectId([], { FIREBASE_PROJECT: 'from-env' }, root)).toBe('from-env');
      expect(resolveProjectId([], {}, root)).toBe('from-rc');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('asserts the exact Admin SDK project, database, and bucket', () => {
    const expected = expectedProjectConfig(DEV_PROJECT);
    expect(() => assertProjectConfig(expected, expected)).not.toThrow();
    expect(() => assertProjectConfig({ ...expected, projectId: 'lecoursville' }, expected)).toThrow(/projectId/);
    expect(() => assertProjectConfig({ ...expected, databaseURL: 'https://prod' }, expected)).toThrow(/databaseURL/);
    expect(() => assertProjectConfig({ ...expected, storageBucket: 'prod.appspot.com' }, expected)).toThrow(/storageBucket/);
  });

  it('requires the manifest project to match the validated project', () => {
    expect(() => assertManifestProject(DEV_PROJECT, DEV_PROJECT)).not.toThrow();
    expect(() => assertManifestProject('lecoursville', DEV_PROJECT)).toThrow(/manifest project/);
  });

  it('refuses an unknown or production credential project', () => {
    expect(() => assertDevCredential(DEV_PROJECT)).not.toThrow();
    expect(() => assertDevCredential(null)).toThrow(/cannot verify the credential project/);
    expect(() => assertDevCredential('lecoursville')).toThrow(/credential project/);
  });

  it('reads project_id from a service-account file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'devseed-cred-'));
    const file = join(dir, 'sa.json');
    writeFileSync(file, JSON.stringify({ project_id: 'lecoursville' }));
    try {
      expect(credentialProjectFromFile(file)).toBe('lecoursville');
      expect(credentialProjectFromFile(join(dir, 'missing.json'))).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('dev seed namespace and manifest builders', () => {
  it('refuses an empty or drifted namespace', () => {
    expect(() => assertSeedNamespace()).not.toThrow();
    expect(() => assertSeedNamespace('', STORAGE_PREFIX)).toThrow(/namespace/);
    expect(() => assertSeedNamespace(ID_PREFIX, '')).toThrow(/namespace/);
    expect(() => assertSeedNamespace('other-', STORAGE_PREFIX)).toThrow(/namespace/);
  });

  it('builds a manifest where every record is under devseed-', () => {
    const manifest = buildManifest();
    expect(manifest.project).toBe(DEV_PROJECT);
    expect(manifest.families.length).toBe(4);
    expect(Object.keys(manifest.people).length).toBe(24);
    expect(manifest.contacts.length).toBe(24);
    expect(manifest.calendarEvents.length).toBeGreaterThan(24);
    expect(manifest.songs.length).toBe(5);
    expect(manifest.expressions.length).toBe(20);
    expect(Object.keys(manifest.people).every((id) => id.startsWith(ID_PREFIX))).toBe(true);
    expect(manifest.families.every((family: any) => family.id.startsWith(ID_PREFIX))).toBe(true);
  });

  it('excludes ogv and prefers the small mp4 or webm source', () => {
    const manifest = buildManifest();
    const extensions = manifest.assetSources.videos.extensions;
    expect(extensions).not.toContain('.ogv');
    expect(extensions).toContain('.mp4');
    expect(extensions).toContain('.webm');
  });

  it('derives contacts and calendar events from people', () => {
    const people = buildPeople();
    expect(buildContacts(people)[0].personId).toBe(Object.keys(people)[0]);
    const events = buildCalendarEvents(people);
    expect(events[0].id.endsWith('-birthday')).toBe(true);
    expect(events.some((event: any) => event.kind === 'anniversary')).toBe(true);
  });
});

describe('dev seed downloader checksum path', () => {
  const buffer = Buffer.from('dev seed bytes');
  const md5 = createHash('md5').update(buffer).digest('hex');
  const sha1 = createHash('sha1').update(buffer).digest('hex');

  it('accepts a matching published md5 or sha1', () => {
    expect(() => verifyArchiveChecksum({ name: 'a.mp4', md5 }, buffer)).not.toThrow();
    expect(() => verifyArchiveChecksum({ name: 'a.mp4', sha1 }, buffer)).not.toThrow();
  });

  it('rejects a mismatch and an unverified file', () => {
    expect(() => verifyArchiveChecksum({ name: 'a.mp4', md5: 'deadbeef' }, buffer)).toThrow(/md5/);
    expect(() => verifyArchiveChecksum({ name: 'a.mp4' }, buffer)).toThrow(/no published checksum/);
  });

  it('returns the downloaded buffer and identifier for upload', async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), 'devseed-cache-'));
    const fetchStub = vi.fn(async (url: string) => {
      if (String(url).startsWith('https://archive.org/advancedsearch.php')) {
        return { ok: true, json: async () => ({ response: { docs: [{ identifier: 'item-1', title: 'Item' }] } }) };
      }
      if (String(url).startsWith('https://archive.org/metadata/')) {
        return { ok: true, json: async () => ({ files: [{ name: 'movie.mp4', size: String(buffer.length), md5 }] }) };
      }
      return { ok: true, arrayBuffer: async () => buffer, headers: { get: () => 'video/mp4' } };
    });
    vi.stubGlobal('fetch', fetchStub);
    try {
      const result = await downloadAll({
        videos: {
          provider: 'internet-archive',
          query: 'q',
          want: 1,
          extensions: ['.mp4'],
          license: 'Public domain',
          attribution: 'Test',
        },
      }, cacheRoot);
      expect(result.videos[0].identifier).toBe('item-1');
      expect(Buffer.isBuffer(result.videos[0].buffer)).toBe(true);
      expect(result.videos[0].buffer.equals(buffer)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});

describe('dev seed clean scoping', () => {
  it('deletes only devseed- records and dev-seed/ objects', async () => {
    const { db, store, updates } = makeDb({
      media: { 'devseed-video-1': {}, other: {} },
      photos: { 'devseed-photo-1': {} },
    });
    const deleted: string[] = [];
    const bucket = makeBucket([
      { name: `${STORAGE_PREFIX}run/a.mp4`, delete: async () => { deleted.push('a'); } },
      { name: `${STORAGE_PREFIX}run/b.mp4`, delete: async () => { deleted.push('b'); } },
      { name: 'other/a.mp4', delete: async () => { deleted.push('other'); } },
    ]);

    const result = await cleanDevRecords(db, bucket);

    expect(result.removed.media).toBe(1);
    expect(result.removed.photos).toBe(1);
    expect(result.objects).toBe(2);
    expect(deleted).toEqual(['a', 'b']);
    expect(updates[0][1]).toEqual({ 'devseed-video-1': null });
    expect(store.media.other).toBeDefined();
  });

  it('surfaces a storage delete failure and reports no removed object count', async () => {
    const { db } = makeDb({ media: { 'devseed-video-1': {} } });
    const bucket = makeBucket([
      { name: `${STORAGE_PREFIX}a.mp4`, delete: async () => {} },
      { name: `${STORAGE_PREFIX}b.mp4`, delete: async () => { throw new Error('denied'); } },
    ]);

    await expect(cleanDevRecords(db, bucket)).rejects.toThrow(/failed to delete 1 storage object/);
  });

  it('counts only devseed- records in the read-only plan', async () => {
    const { db } = makeDb({ media: { 'devseed-a': {}, other: {} }, songs: { 'devseed-s': {} } });
    const existing = await readExisting(db);
    expect(existing.media).toBe(1);
    expect(existing.songs).toBe(1);
    expect(existing.photos).toBe(0);
  });
});

describe('dev seed upload path', () => {
  it('uploads the exact non-empty buffer', async () => {
    const save = vi.fn(async (_buffer?: Buffer, _options?: any) => ({}));
    const bucket = { name: `${DEV_PROJECT}.appspot.com`, file: () => ({ save }) };
    const buffer = Buffer.from('non-empty media bytes');

    const url = await upload(bucket, buffer, 'dev-seed/runs/1/videos/a.mp4', 'video/mp4');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBe(buffer);
    expect(Buffer.isBuffer(save.mock.calls[0][0])).toBe(true);
    expect(save.mock.calls[0][0].length).toBeGreaterThan(0);
    expect(save.mock.calls[0][1]).toMatchObject({ resumable: false, contentType: 'video/mp4' });
    expect(url).toContain(encodeURIComponent('dev-seed/runs/1/videos/a.mp4'));
  });

  it('refuses an empty or non-buffer upload', async () => {
    const bucket = { name: 'b', file: () => ({ save: vi.fn() }) };
    await expect(upload(bucket, Buffer.alloc(0), 'dev-seed/a.mp4', 'video/mp4')).rejects.toThrow(/empty/);
    await expect(upload(bucket, { bytes: 1 }, 'dev-seed/a.mp4', 'video/mp4')).rejects.toThrow(/non-buffer/);
  });
});

describe('dev seed confirm gate and modes', () => {
  it('defaults to plan and only writes after --confirm', () => {
    expect(resolveMode([])).toBe('plan');
    expect(resolveMode(['--clean'])).toBe('plan');
    expect(resolveMode(['--confirm'])).toBe('seed');
    expect(resolveMode(['--confirm', '--clean'])).toBe('clean');
  });

  it('runs a plan that reads existing records and writes nothing', async () => {
    const { deps, updates } = makeDeps();
    const result = await main(['--project', DEV_PROJECT], deps);
    expect(result.mode).toBe('plan');
    expect(updates).toEqual([]);
  });

  it('writes records only with --confirm and a dev credential', async () => {
    const { deps, updates } = makeDeps();
    const result = await main(['--project', DEV_PROJECT, '--confirm'], deps);
    expect(result.mode).toBe('seed');
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.some(([node]) => node === 'people')).toBe(true);
  });

  it('refuses a production credential before any write', async () => {
    const { deps, updates } = makeDeps({ resolveCredentialProject: async () => 'lecoursville' });
    await expect(main(['--project', DEV_PROJECT, '--confirm'], deps)).rejects.toThrow(/credential project/);
    expect(updates).toEqual([]);
  });
});

describe('dev seed per-asset ledger', () => {
  it('lists every asset with source URL and identifier under pending sign-off', () => {
    const ledger = buildPerAssetLedger({
      videos: [{
        identifier: 'item-1',
        title: 'Item',
        sourceUrl: 'https://archive.org/download/item-1/movie.mp4',
        license: 'Public domain',
        attribution: 'Test',
        bytes: 12,
        sha256: 'abc',
      }],
    }, '2026-11-09T00:00:00.000Z');

    expect(ledger).toContain('PENDING HUMAN SIGN-OFF');
    expect(ledger).toContain('item-1');
    expect(ledger).toContain('https://archive.org/download/item-1/movie.mp4');
  });
});
