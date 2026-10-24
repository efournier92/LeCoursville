import { test, expect } from '../helpers/fixture';
import { signIn } from '../helpers/rules';

// Accepted risk (ledger C-20261023-05): storage.rules.prod lets any signed-in
// member create and delete photos/videoScreenshots and delete userUploads. This
// suite pins that deployed policy as-is; it is not a statement of intent.
const STORAGE_ORIGIN = 'http://127.0.0.1:9199';
const BUCKET = 'lecoursville-dev.appspot.com';
const OBJECTS = `${STORAGE_ORIGIN}/v0/b/${BUCKET}/o`;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function objectUrl(path: string): string {
  return `${OBJECTS}/${encodeURIComponent(path)}`;
}

function authHeader(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function upload(path: string, token?: string): Promise<Response> {
  return fetch(`${OBJECTS}?uploadType=media&name=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', ...authHeader(token) },
    body: PNG,
  });
}

async function getObject(path: string, token?: string): Promise<Response> {
  return fetch(objectUrl(path), { headers: authHeader(token) });
}

async function removeObject(path: string, token?: string): Promise<Response> {
  return fetch(objectUrl(path), { method: 'DELETE', headers: authHeader(token) });
}

test.describe('deployed storage rules', () => {
  test('anonymous get on a seeded photo succeeds', async () => {
    const res = await getObject('photos/album-1/photo1.png');
    expect(res.status).toBe(200);
  });

  test('anonymous write on photos is denied', async () => {
    const res = await upload(`photos/e2e-anon-${Date.now()}.png`);
    expect(res.status).toBe(403);
  });

  test('a signed-in member can create and delete photos (accepted risk)', async () => {
    const token = await signIn('user');
    const path = `photos/e2e-member-${Date.now()}.png`;

    try {
      expect((await upload(path, token)).ok).toBe(true);
      expect((await getObject(path, token)).status).toBe(200);
      expect((await removeObject(path, token)).ok).toBe(true);
      expect((await getObject(path)).status).toBe(404);
    } finally {
      await removeObject(path, token).catch(() => undefined);
    }
  });

  test('anonymous create on userUploads succeeds up to the size condition (accepted risk)', async () => {
    const path = `userUploads/e2e-anon-${Date.now()}/file.png`;
    const token = await signIn('user');

    try {
      expect((await upload(path)).ok).toBe(true);
      // userUploads reads require auth, so prove the anonymous create landed here.
      expect((await getObject(path, token)).status).toBe(200);
    } finally {
      await removeObject(path, token).catch(() => undefined);
    }
  });

  test('a signed-in member can delete userUploads', async () => {
    const path = `userUploads/e2e-delete-${Date.now()}/file.png`;
    const token = await signIn('user');
    expect((await upload(path)).ok).toBe(true);

    try {
      expect((await removeObject(path, token)).ok).toBe(true);
      expect((await getObject(path, token)).status).toBe(404);
    } finally {
      await removeObject(path, token).catch(() => undefined);
    }
  });

  test('anonymous list on photos is denied', async () => {
    const res = await fetch(`${OBJECTS}?prefix=${encodeURIComponent('photos/')}`);
    expect(res.status).toBe(403);
  });

  test('a path outside the matched roots is denied', async () => {
    const token = await signIn('user');
    const path = `private/e2e-${Date.now()}.png`;

    expect((await upload(path)).status).toBe(403);
    expect((await upload(path, token)).status).toBe(403);
    expect((await getObject(path)).status).toBe(403);
  });
});
