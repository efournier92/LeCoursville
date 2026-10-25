#!/usr/bin/env node
/**
 * E2E seed: resets and populates the Firebase Emulator Suite with
 * deterministic data. Runs INSIDE `firebase emulators:exec` (all emulators up).
 *
 * RTDB and Auth writes go through the Admin SDK, which bypasses security
 * rules (the emulator now enforces database.rules.json). The Admin SDK reads
 * the emulator hosts from the environment `firebase emulators:exec` sets.
 *
 * Usage: node scripts/e2e/seed.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Resolve the Admin SDK from the functions package so no root dependency is added.
const admin = require('../../functions/node_modules/firebase-admin');

const STORAGE_PORT = 9199;
const BUCKET = 'lecoursville-dev.appspot.com';

admin.initializeApp({
  projectId: 'lecoursville-dev',
  databaseURL: 'https://lecoursville-dev-default-rtdb.firebaseio.com',
});

const PASSWORD = 'E2e-pass-2026';
const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const E2E_API_KEY = 'AIzaSyDBhEg8J_knZVdhEWCIbtcKJak3glu_TKA';

const USERS = [
  { email: 'admin@e2e.local', name: 'Admin User', roles: { user: true, admin: true } },
  { email: 'user@e2e.local', name: 'Regular User', roles: { user: true } },
  { email: 'other@e2e.local', name: 'Other User', roles: { user: true } },
  { email: 'staff@e2e.local', name: 'Staff Admin', roles: { user: true, admin: true } },
  // Sparse user for the loading-contract empty-state spec. Contacts and albums
  // are global nodes, so "zero data" is induced and restored by that spec.
  { email: 'sparse@e2e.local', name: 'Sparse User', roles: { user: true } },
];

const FEATURE_IDS = [
  'people', 'contacts', 'calendar', 'music', 'videos',
  'photos', 'enablePhotoAlbums', 'expressions', 'chat',
];

async function ensureUser(email, name) {
  try {
    const user = await admin.auth().createUser({ email, password: PASSWORD, displayName: name });
    return user.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const user = await admin.auth().getUserByEmail(email);
      // A long-lived emulator keeps users across runs; reset the password so a
      // recovery test that changed it cannot leak into the next browser project.
      await admin.auth().updateUser(user.uid, { password: PASSWORD });
      return user.uid;
    }
    throw err;
  }
}

/** Signs in over the auth emulator REST API; used to authenticate Storage writes. */
async function idTokenFor(email) {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E2E_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    throw new Error(`auth sign-in ${email} -> HTTP ${res.status}`);
  }
  return (await res.json()).idToken;
}

// --- Fixtures --------------------------------------------------------------

function pngBytes() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

// Tiny valid H.264 MP4s, embedded so the seed stays offline and deterministic.
const FIXTURE_MP4_B64 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAANKbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAnV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAHtbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABmG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAVhzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFExhdmM2My4xLjEwMiBsaWJ4MjY0AAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAe/+EAFmdCwB7ZHsBEAAADAAQAAAMAUDxYuSABAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAABaoAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAKAAAEAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAKAAAAAQAAADxzdHN6AAAAAAAAAAAAAAAKAAACgwAAAAkAAAAKAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAABRzdGNvAAAAAAAAAAEAAAN6AAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2My4xLjEwMgAAAAhmcmVlAAAC3W1kYXQAAAJxBgX//23cRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIyIGIzNTYwNWEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj0xMCBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAApliIQP8mKAAMPuAAAABUGaOB/qAAAABkGaVAf6gAAAAAVBmmA/1AAAAAVBmoA/1AAAAAVBmqA/1AAAAAVBmsA/1AAAAAVBmuA/1AAAAAVBmwA71AAAAAVBmyA31A==';
const FIXTURE_2_MP4_B64 = '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';

function fixtureMp4Bytes() {
  return Buffer.from(FIXTURE_MP4_B64, 'base64');
}

/** MPEG1 Layer III 128kbps 44.1kHz stereo frames; header only, silent body. */
function silentMp3Frames(count = 3) {
  const frameLength = Math.floor((144 * 128000) / 44100);
  const frame = Buffer.alloc(frameLength);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0x00;
  return Buffer.concat(Array.from({ length: count }, () => frame));
}

/** ID3v2.3 tag with one APIC frame holding the PNG fixture, then silent frames. */
function id3CoverMp3Bytes() {
  const content = Buffer.concat([
    Buffer.from([0x00]), // ISO-8859-1 text encoding
    Buffer.from('image/png\0', 'latin1'),
    Buffer.from([0x03]), // front cover
    Buffer.from([0x00]), // empty description terminator
    pngBytes(),
  ]);
  const frameHeader = Buffer.alloc(10);
  frameHeader.write('APIC', 0, 'latin1');
  frameHeader.writeUInt32BE(content.length, 4);
  const frames = Buffer.concat([frameHeader, content]);
  const tagHeader = Buffer.alloc(10);
  tagHeader.write('ID3', 0, 'latin1');
  tagHeader[3] = 3;
  tagHeader[4] = 0;
  tagHeader[5] = 0;
  const size = frames.length;
  tagHeader[6] = (size >> 21) & 0x7f;
  tagHeader[7] = (size >> 14) & 0x7f;
  tagHeader[8] = (size >> 7) & 0x7f;
  tagHeader[9] = size & 0x7f;
  return Buffer.concat([tagHeader, frames, silentMp3Frames()]);
}

/** A valid empty zip: just the end-of-central-directory record. */
function zipBytes() {
  const buf = Buffer.alloc(22);
  buf.writeUInt32LE(0x06054b50, 0);
  return buf;
}

/** ~3.5s of 8kHz 8-bit mono silence, valid WAV. */
function wavBytes() {
  const sampleRate = 8000;
  // Long enough for the custom transport spec to observe elapsed seconds
  // advance before the track ends.
  const seconds = 3.5;
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

  // 1. Reset RTDB (Admin SDK bypasses rules; clears server-only nodes too).
  await admin.database().ref().set(null);
  out.push('RTDB reset');

  // 2. Auth users.
  const localIds = {};
  for (const u of USERS) {
    localIds[u.email] = await ensureUser(u.email, u.name);
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
  const staffUid = localIds['staff@e2e.local'];
  const sparseUid = localIds['sparse@e2e.local'];

  // Person D: 3 months before today (must NOT appear in the current month view).
  const dMonth = month1 - 3;
  const dYear = dMonth < 1 ? year - 1 : year;
  const dMonth1 = dMonth < 1 ? dMonth + 12 : dMonth;

  const person = (id, first, last, birthday, extra = {}) => ({
    id,
    name: { firstGiven: first, firstPreferred: first, maiden: null, last, suffix: null },
    familyId: extra.familyId ?? 'family-1',
    birthday: birthday ?? { year, month: month1, day: clampDay(day) },
    spouseId: extra.spouseId ?? null,
    anniversaryDate: extra.anniversaryDate ?? null,
    deathDate: extra.deathDate ?? null,
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
    parentIds: extra.parentIds ?? [],
    lineage: null,
    isLiving: extra.isLiving ?? true,
    createdAt: now - 60 * 24 * 60 * 60 * 1000,
    updatedAt: now,
  });

  const people = {
    'person-a': person('person-a', 'Alice', 'Anderson', { year: year - 30, month: month1, day: clampDay(day) }),
    'person-b': person('person-b', 'Ben', 'Brown', { year: year - 25, month: month1, day: clampDay(day + 2) }, { familyId: 'family-2' }),
    'person-c': person('person-c', 'Carol', 'Clark', { year: year - 20, month: month1, day: clampDay(day + 1) }, { spouseId: 'person-d' }),
    'person-d': person('person-d', 'Dave', 'Davis', { year: dYear - 28, month: dMonth1, day: clampDay(day) }, { familyId: 'family-2' }),
    'person-e': person('person-e', 'Edith', 'Evans', { year: 1935, month: 1, day: 10 }, {
      generationNumber: 2,
      parentIds: ['person-a'],
      isLiving: false,
      deathDate: { year: 2015, month: 6, day: 15 },
    }),
    'person-f': person('person-f', 'Frank', 'Foster', { year: 1940, month: 2, day: 20 }, {
      generationNumber: 2,
      parentIds: ['person-a'],
      isLiving: false,
    }),
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
    'album-3': { id: 'album-3', title: 'E2E Delete Album', coverPhotoId: 'photo-3-1', createdAt: now, updatedAt: now },
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
  photos['photo-3-1'] = {
    id: 'photo-3-1',
    dateAdded: new Date(now - 31 * 86400000),
    path: 'photos/album-3/photo1.png',
    extension: 'png',
    url: photoBase('album-3', 1),
    info: 'E2E photo 3-1',
    location: 'E2E Studio',
    year: year,
    takenBy: 'E2E Tester',
    uploadedBy: adminUid,
    isYearCirca: false,
    isEditable: false,
    isMessageAttachment: false,
    albumId: 'album-3',
  };

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
    'msg-4': {
      id: 'msg-4', title: 'Author Editable', body: 'E2E author editable',
      attachmentId: '', attachmentType: '', attachmentUrl: '',
      authorName: 'Regular User', authorId: userUid,
      isReply: false, replyLevel: 0, likes: [], replies: [],
      dateSent: new Date(now - 4 * 86400000), isEditable: false, isSaved: true,
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
    // Legacy non-Drive record with no storage block: exercises the native player
    // and the database-only delete path.
    'media-video-s3': {
      id: 'media-video-s3', title: 'E2E S3 Video', artist: '', date: '2026',
      folderName: 'E2E', fileName: 'fixture.mp4', isSticky: false, isHidden: false, listing: [],
      urls: {
        download: 'http://localhost:5000/assets/e2e-fixtures/fixture.mp4',
        icon: 'http://localhost:5000/assets/e2e-fixtures/fixture.png',
      },
      type: 'video', format: 'video/mp4', dateUpdated: now, duration: '00:05',
    },
  };

  const tree = {
    users: {
      [adminUid]: { id: adminUid, name: 'Admin User', email: 'admin@e2e.local', roles: { user: true, admin: true, super: true }, dateRegistered: new Date(now - 60 * 86400000), dateLastActive: new Date(now) },
      [userUid]: { id: userUid, name: 'Regular User', email: 'user@e2e.local', roles: { user: true }, dateRegistered: new Date(now - 60 * 86400000), dateLastActive: new Date(now) },
      [otherUid]: { id: otherUid, name: 'Other User', email: 'other@e2e.local', roles: { user: true }, dateRegistered: new Date(now - 60 * 86400000), dateLastActive: new Date(now) },
      [staffUid]: { id: staffUid, name: 'Staff Admin', email: 'staff@e2e.local', roles: { user: true, admin: true, super: false }, dateRegistered: new Date(now - 60 * 86400000), dateLastActive: new Date(now) },
      [sparseUid]: { id: sparseUid, name: 'Sparse User', email: 'sparse@e2e.local', roles: { user: true }, dateRegistered: new Date(now - 60 * 86400000), dateLastActive: new Date(now) },
    },
    features: Object.fromEntries(FEATURE_IDS.map(id => [id, { enabled: id !== 'chat', updatedAt: now }])),
    promotedRoute: { route: '/calendar', updatedAt: now },
    config: {
      // RTDB keys cannot contain ".", so recipients are array values, not keys.
      adminAlertRecipients: ['admin@e2e.local'],
    },
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
      [`cal-${year}`]: { id: `cal-${year}`, path: 'calendars/e2e.pdf', url: 'http://localhost:5000/assets/e2e-fixtures/fixture.pdf', year: String(year) },
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

  // JSON round-trip keeps Date values as the ISO strings the old REST PUT wrote.
  await admin.database().ref().set(JSON.parse(JSON.stringify(tree)));
  out.push('seed tree PUT');

  // 4. Hosting fixtures (the hosting emulator serves dist/lecoursville/browser).
  const fixtureDir = 'dist/lecoursville/browser/assets/e2e-fixtures';
  const fs = await import('node:fs');
  const path = await import('node:path');
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, 'fixture.png'), pngBytes());
  fs.writeFileSync(path.join(fixtureDir, 'fixture.wav'), wavBytes());
  fs.writeFileSync(path.join(fixtureDir, 'fixture.pdf'), pdfBytes());
  fs.writeFileSync(path.join(fixtureDir, 'fixture.mp4'), fixtureMp4Bytes());
  fs.writeFileSync(path.join(fixtureDir, 'fixture-2.mp4'), Buffer.from(FIXTURE_2_MP4_B64, 'base64'));
  fs.writeFileSync(path.join(fixtureDir, '01-fixture.mp3'), id3CoverMp3Bytes());
  fs.writeFileSync(path.join(fixtureDir, '02-fixture.mp3'), id3CoverMp3Bytes());
  fs.writeFileSync(path.join(fixtureDir, 'fixture-noart.mp3'), silentMp3Frames());
  fs.writeFileSync(path.join(fixtureDir, 'fixture.zip'), zipBytes());
  out.push(
    'hosting fixtures: fixture.png, fixture.wav, fixture.pdf, fixture.mp4, fixture-2.mp4, '
      + '01-fixture.mp3, 02-fixture.mp3, fixture-noart.mp3, fixture.zip',
  );

  // 5. Storage uploads (photo fixtures). The storage emulator is only present
  // when the caller's `--only` list includes it; skip otherwise so an
  // RTDB-only seed run does not fail on an unreachable port.
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    // storage.rules.prod requires a signed-in writer for photos, so authenticate
    // the seed writes; the same seed then works under the open emulator rules.
    const token = await idTokenFor('admin@e2e.local');
    const objects = [
      'photos/album-1/photo1.png',
      'photos/album-1/photo2.png',
      'photos/album-2/photo1.png',
      'photos/album-2/photo2.png',
      'photos/album-3/photo1.png',
    ];
    for (const name of objects) {
      const url = `http://localhost:${STORAGE_PORT}/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(name)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${token}` },
        body: pngBytes(),
      });
      if (!res.ok) {
        throw new Error(`storage upload ${name} -> HTTP ${res.status}`);
      }
    }
    out.push(`storage uploads: ${objects.length} photos`);
  } else {
    out.push('storage uploads: skipped (storage emulator not running)');
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[seed] OK in ${elapsed}ms`);
  console.log(`[seed] users: ${USERS.map(u => u.email).join(', ')}`);
  console.log(`[seed] nodes: ${Object.keys(tree).join(', ')}`);
  out.forEach(l => console.log(`[seed] ${l}`));

  // Close the Admin SDK's RTDB connection so this process can exit; otherwise
  // the open socket keeps the event loop alive and `emulators:exec` hangs.
  await admin.app().delete();
}

main().catch((err) => {
  console.error('[seed] FAILED:', err.message);
  process.exit(1);
});
