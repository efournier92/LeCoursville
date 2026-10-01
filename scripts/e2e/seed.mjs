#!/usr/bin/env node
/**
 * E2E seed: resets and populates the Firebase Emulator Suite with
 * deterministic data. Runs INSIDE `firebase emulators:exec` (all emulators up).
 *
 * Zero runtime dependencies: uses global fetch + Node Buffer only.
 *
 * Usage: node scripts/e2e/seed.mjs
 */

const AUTH_PORT = 9099;
const DB_PORT = 9000;
const STORAGE_PORT = 9199;
const BUCKET = 'lecoursville-dev.appspot.com';
// The app's RTDB SDK connects with the namespace taken from the
// firebaseConfig.databaseURL host (lecoursville-dev-default-rtdb). The
// emulator keeps namespaces separate, so writes MUST target that same
// namespace or the app reads an empty database.
const DB = `http://localhost:${DB_PORT}/.json?ns=lecoursville-dev-default-rtdb`;

const PASSWORD = 'E2e-pass-2026';

const USERS = [
  { email: 'admin@e2e.local', name: 'Admin User', roles: { user: true, admin: true } },
  { email: 'user@e2e.local', name: 'Regular User', roles: { user: true } },
  { email: 'other@e2e.local', name: 'Other User', roles: { user: true } },
];

const FEATURE_IDS = [
  'people', 'contacts', 'calendar', 'music', 'videos',
  'photos', 'enablePhotoAlbums', 'expressions', 'chat',
];

async function fetchJson(url, options = {}, errorLabel = url) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`${errorLabel} -> HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function signUpOrIn(email) {
  const body = { email, password: PASSWORD, returnSecureToken: true };
  // The auth emulator REST endpoint requires a key query param; any value works.
  const base = `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1`;
  try {
    const data = await fetchJson(
      `${base}/accounts:signUp?key=emulator`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      `signUp ${email}`,
    );
    return data.localId;
  } catch (err) {
    // EMAIL_EXISTS -> fetch the existing localId via signInWithPassword.
    if (String(err.message).includes('EMAIL_EXISTS')) {
      const data = await fetchJson(
        `${base}/accounts:signInWithPassword?key=emulator`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        `signIn ${email}`,
      );
      return data.localId;
    }
    throw err;
  }
}

// --- Fixtures --------------------------------------------------------------

function pngBytes() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

/** ~0.5s of 8kHz 8-bit mono silence, valid WAV. */
function wavBytes() {
  const sampleRate = 8000;
  const seconds = 0.5;
  const dataSize = sampleRate * seconds;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // rest stays 0x00 (silence)
  return buf;
}

/** Minimal valid single-page PDF (built with a real xref table). */
function pdfBytes() {
  const objects = [];
  objects[1] = '<</Type/Catalog/Pages 2 0 R>>';
  objects[2] = '<</Type/Pages/Kids[3 0 R]/Count 1>>';
  objects[3] = '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>';
  const stream = 'BT /F1 24 Tf 72 720 Td (E2E fixture PDF) Tj ET';
  objects[4] = `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`;
  objects[5] = '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

// --- Main ------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const out = [];

  // 1. Reset RTDB.
  await fetchJson(DB, { method: 'DELETE' }, 'RTDB reset');
  out.push('RTDB reset');

  // 2. Auth users.
  const localIds = {};
  for (const u of USERS) {
    localIds[u.email] = await signUpOrIn(u.email);
  }
  out.push(`auth users: ${USERS.length}`);

  // 3. Seed tree.
  const now = Date.now();
  const today = new Date();
  const year = today.getFullYear();
  const month1 = today.getMonth() + 1; // 1-indexed (PersonDate convention)
  const day = today.getDate();
  const clampDay = (d) => Math.min(d, 28);

  const adminUid = localIds['admin@e2e.local'];
  const userUid = localIds['user@e2e.local'];
  const otherUid = localIds['other@e2e.local'];

  // Person D: 3 months before today (must NOT appear in the current month view).
  const dMonth = month1 - 3;
  const dYear = dMonth < 1 ? year - 1 : year;
  const dMonth1 = dMonth < 1 ? dMonth + 12 : dMonth;

  const person = (id, first, last, birthday, extra = {}) => ({
    id,
    name: { firstGiven: first, firstPreferred: first, maiden: null, last, suffix: null },
    clanId: extra.clanId ?? 'clan-1',
    birthday: birthday ?? { year, month: month1, day: clampDay(day) },
    spouseId: extra.spouseId ?? null,
    anniversaryDate: extra.anniversaryDate ?? null,
    emails: [{ address: `${first.toLowerCase()}@example.com`, label: null }],
    phones: [{ label: 'Home', number: '555-0101' }],
    addresses: [{
      id: null,
      full: `${first} ${last}`,
      street: '1 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      label: 'Home',
    }],
    directDescendent: false,
    generationNumber: extra.generationNumber ?? 1,
    parentIds: [],
    lineage: null,
    isLiving: true,
    createdAt: now - 60 * 24 * 60 * 60 * 1000,
    updatedAt: now,
  });

  const people = {
    'person-a': person('person-a', 'Alice', 'Anderson', { year: year - 30, month: month1, day: clampDay(day) }),
    'person-b': person('person-b', 'Ben', 'Brown', { year: year - 25, month: month1, day: clampDay(day + 2) }, { clanId: 'clan-2' }),
    'person-c': person('person-c', 'Carol', 'Clark', { year: year - 20, month: month1, day: clampDay(day + 1) }, { spouseId: 'person-d' }),
    'person-d': person('person-d', 'Dave', 'Davis', { year: dYear - 28, month: dMonth1, day: clampDay(day) }, { clanId: 'clan-2' }),
  };
  // Carol's anniversary (this month, +1 day).
  people['person-c'].anniversaryDate = { year: year - 10, month: month1, day: clampDay(day + 1) };

  const clans = {
    'clan-1': { id: 'clan-1', name: 'Mignonne', hexColor: '#F44336', sortOrder: 'A', createdAt: now, updatedAt: now },
    'clan-2': { id: 'clan-2', name: 'Denis', hexColor: '#2196F3', sortOrder: 'B', createdAt: now, updatedAt: now },
  };
  const families = {
    'family-1': { id: 'family-1', name: 'Mignonne', hexColor: '#F44336', sortOrder: 'A', createdAt: now, updatedAt: now },
    'family-2': { id: 'family-2', name: 'Denis', hexColor: '#2196F3', sortOrder: 'B', createdAt: now, updatedAt: now },
  };

  const photoBase = (albumId, n) =>
    `http://127.0.0.1:${STORAGE_PORT}/v0/b/${BUCKET}/o/photos%2F${albumId}%2Fphoto${n}.png?alt=media`;

  const albums = {
    'album-1': { id: 'album-1', title: 'E2E Album One', coverPhotoId: 'photo-1-1', createdAt: now - 86400000, updatedAt: now - 86400000 },
    'album-2': { id: 'album-2', title: 'E2E Album Two', coverPhotoId: 'photo-2-1', createdAt: now, updatedAt: now },
  };

  const photos = {};
  for (let i = 1; i <= 2; i++) {
    for (let j = 1; j <= 2; j++) {
      const id = `photo-${i}-${j}`;
      photos[id] = {
        id,
        dateAdded: new Date(now - (i * 10 + j) * 86400000),
        path: `photos/album-${i}/photo${j}.png`,
        extension: 'png',
        url: photoBase(`album-${i}`, j),
        info: `E2E photo ${i}-${j}`,
        location: 'E2E Studio',
        year: year,
        takenBy: 'E2E Tester',
        uploadedBy: adminUid,
        isYearCirca: false,
        isEditable: false,
        isMessageAttachment: false,
        albumId: `album-${i}`,
      };
    }
  }

  const messages = {
    'msg-1': {
      id: 'msg-1', title: 'Welcome to E2E', body: 'This is the first seeded message.',
      attachmentId: '', attachmentType: '', attachmentUrl: '',
      authorName: 'Admin User', authorId: adminUid,
      isReply: false, replyLevel: 0, likes: [], replies: [],
      dateSent: new Date(now - 86400000), isEditable: false, isSaved: false,
      isDeleted: false, isSticky: false, messageType: 'chat',
    },
    'msg-2': {
      id: 'msg-2', title: 'Second seed', body: 'Another chat message.',
      attachmentId: '', attachmentType: '', attachmentUrl: '',
      authorName: 'Admin User', authorId: adminUid,
      isReply: false, replyLevel: 0, likes: [], replies: [],
      dateSent: new Date(now - 2 * 86400000), isEditable: false, isSaved: false,
      isDeleted: false, isSticky: false, messageType: 'chat',
    },
    'msg-3': {
      id: 'msg-3', title: 'From the user', body: 'A message from the regular user.',
      attachmentId: '', attachmentType: '', attachmentUrl: '',
      authorName: 'Regular User', authorId: userUid,
      isReply: false, replyLevel: 0, likes: [], replies: [],
      dateSent: new Date(now - 3 * 86400000), isEditable: false, isSaved: false,
      isDeleted: false, isSticky: false, messageType: 'chat',
    },
    'expr-1': {
      id: 'expr-1', title: 'Live long and prosper', body: 'Seeded expression one.',
      attachmentId: '', attachmentType: '', attachmentUrl: '',
      authorName: 'Admin User', authorId: adminUid, attribution: 'E2E Family', yearWritten: '2000',
      isReply: false, replyLevel: 0, likes: [], replies: [],
      dateSent: new Date(now - 86400000), isEditable: false, isSaved: false,
      isDeleted: false, isSticky: false, messageType: 'expression',
    },
    'expr-2': {
      id: 'expr-2', title: 'Make it so', body: 'Seeded expression two.',
      attachmentId: '', attachmentType: '', attachmentUrl: '',
      authorName: 'Admin User', authorId: adminUid, attribution: 'E2E Family', yearWritten: '2010',
      isReply: false, replyLevel: 0, likes: [], replies: [],
      dateSent: new Date(now - 2 * 86400000), isEditable: false, isSaved: false,
      isDeleted: false, isSticky: false, messageType: 'expression',
    },
  };

  const media = {
    'media-audio': {
      id: 'media-audio', title: 'E2E Audio', artist: 'E2E Artist', date: '2026',
      folderName: 'E2E', fileName: '', isSticky: false, isHidden: false,
      listing: ['media-track-1'],
      // download must be non-empty: media-explorer only selects media with a
      // download URL (shouldSetCurrentMedia); the player itself uses tracks.
      urls: { download: `http://localhost:5000/assets/e2e-fixtures/fixture.wav`, icon: '' },
      type: 'audio-album', format: 'collection/audio', dateUpdated: now,
    },
    'media-track-1': {
      id: 'media-track-1', title: 'E2E Track', artist: 'E2E Artist', date: '2026',
      folderName: '', fileName: '', isSticky: false, isHidden: false, listing: [],
      urls: { download: `http://localhost:5000/assets/e2e-fixtures/fixture.wav`, icon: '' },
      type: 'audio-track', format: 'audio/mpeg', dateUpdated: now,
    },
    'media-doc': {
      id: 'media-doc', title: 'E2E Doc', artist: '', date: '2026',
      folderName: 'E2E', fileName: 'fixture.pdf', isSticky: false, isHidden: false, listing: [],
      urls: { download: `http://localhost:5000/assets/e2e-fixtures/fixture.pdf`, icon: '' },
      type: 'document', format: 'document/pdf', dateUpdated: now,
    },
    'media-video': {
      id: 'media-video', title: 'E2E Video', artist: '', date: '2026',
      folderName: 'E2E', fileName: 'fixture.mp4', isSticky: false, isHidden: false, listing: [],
      urls: { download: 'https://drive.google.com/file/d/e2efixture/preview', icon: '' },
      type: 'video', format: 'video/mp4', dateUpdated: now, duration: '00:30',
    },
  };

  const tree = {
    users: {
      [adminUid]: { id: adminUid, name: 'Admin User', email: 'admin@e2e.local', roles: { user: true, admin: true, super: true }, dateRegistered: new Date(now - 60 * 86400000), dateLastActive: new Date(now) },
      [userUid]: { id: userUid, name: 'Regular User', email: 'user@e2e.local', roles: { user: true }, dateRegistered: new Date(now - 60 * 86400000), dateLastActive: new Date(now) },
      [otherUid]: { id: otherUid, name: 'Other User', email: 'other@e2e.local', roles: { user: true }, dateRegistered: new Date(now - 60 * 86400000), dateLastActive: new Date(now) },
    },
    features: Object.fromEntries(FEATURE_IDS.map(id => [id, { enabled: id !== 'chat', updatedAt: now }])),
    promotedRoute: { route: '/calendar', updatedAt: now },
    contacts: {
      'contact-1': { id: 'contact-1', name: 'Legacy Contact One', addresses: [], family: '', emails: [], phones: [], isEditable: true },
      'contact-2': { id: 'contact-2', name: 'Legacy Contact Two', addresses: [], family: '', emails: [], phones: [], isEditable: true },
      'contact-3': { id: 'contact-3', name: 'Legacy Contact Three', addresses: [], family: '', emails: [], phones: [], isEditable: false },
    },
    people,
    families,
    clans,
    photoAlbums: albums,
    photos,
    messages,
    media,
    addresses: {
      'addr-1': { id: 'addr-1', full: '1 Main St', street: '1 Main St', city: 'Austin', state: 'TX', zip: '78701', label: 'Home' },
      'addr-2': { id: 'addr-2', full: '2 Oak Ave', street: '2 Oak Ave', city: 'Dallas', state: 'TX', zip: '75201', label: 'Cabin' },
    },
    calendars: {
      'cal-1': { id: 'cal-1', path: 'calendars/e2e.pdf', url: 'http://localhost:5000/assets/e2e-fixtures/fixture.pdf', year: String(year) },
    },
    userUploads: {
      'upload-1': {
        id: 'upload-1',
        url: 'http://localhost:5000/assets/e2e-fixtures/fixture.png',
        path: 'userUploads/e2e/fixture.png',
        dateAdded: new Date(now - 86400000),
        eventName: 'E2E Reunion',
        status: 'approved',
        uploader: { name: 'Regular User', email: 'user@e2e.local' },
        fileName: 'fixture.png',
        fileType: 'image/png',
        fileSize: 68,
      },
    },
  };

  await fetchJson(DB, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tree),
  }, 'seed tree PUT');
  out.push('seed tree PUT');

  // 4. Hosting fixtures (the hosting emulator serves dist/lecoursville/browser).
  const fixtureDir = 'dist/lecoursville/browser/assets/e2e-fixtures';
  const fs = await import('node:fs');
  const path = await import('node:path');
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, 'fixture.png'), pngBytes());
  fs.writeFileSync(path.join(fixtureDir, 'fixture.wav'), wavBytes());
  fs.writeFileSync(path.join(fixtureDir, 'fixture.pdf'), pdfBytes());
  out.push('hosting fixtures: fixture.png, fixture.wav, fixture.pdf');

  // 5. Storage uploads (photo fixtures, 2 per album).
  for (let i = 1; i <= 2; i++) {
    for (let j = 1; j <= 2; j++) {
      const name = `photos%2Falbum-${i}%2Fphoto${j}.png`;
      const url = `http://localhost:${STORAGE_PORT}/v0/b/${BUCKET}/o?uploadType=media&name=${name}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: pngBytes(),
      });
      if (!res.ok) {
        throw new Error(`storage upload ${name} -> HTTP ${res.status}`);
      }
    }
  }
  out.push('storage uploads: 4 photos');

  const elapsed = Date.now() - startedAt;
  console.log(`[seed] OK in ${elapsed}ms`);
  console.log(`[seed] users: ${USERS.map(u => u.email).join(', ')}`);
  console.log(`[seed] nodes: ${Object.keys(tree).join(', ')}`);
  out.forEach(l => console.log(`[seed] ${l}`));
}

main().catch((err) => {
  console.error('[seed] FAILED:', err.message);
  process.exit(1);
});
