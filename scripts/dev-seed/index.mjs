#!/usr/bin/env node
/**
 * Dev seed module (UI-008). Fills the dev project with fictional content under
 * a stable `devseed-` namespace so a rerun or --clean replaces exactly its own
 * records and nothing else.
 *
 * Safety: refuses any project but lecoursville-dev, and every write needs an
 * explicit --confirm. Downloads go to a gitignored cache that is removed after
 * the run, or on exit.
 *
 * Usage:
 *   npm run seed:dev                    # resolve assets, read records, print the per-asset ledger
 *   npm run seed:dev -- --confirm       # download, upload, and write records
 *   npm run seed:dev -- --clean --confirm
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { downloadAll } from './downloader.mjs';
import { buildPerAssetLedger } from './ledger.mjs';
import {
  assertSeedNamespace,
  buildManifest,
  ID_PREFIX,
  OWNER_ID,
  OWNER_NAME,
  STORAGE_PREFIX,
} from './manifest.mjs';
import {
  assertDevCredential,
  assertDevProject,
  assertManifestProject,
  assertProjectConfig,
  credentialProjectFromFile,
  expectedProjectConfig,
  hasFlag,
  resolveProjectId,
} from './project-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, '.cache');
const MANAGED_NODES = [
  'families', 'people', 'messages', 'media',
  'photoAlbums', 'photos', 'songs', 'familyExplorer',
];
// A 1x1 transparent PNG stands in for thumbnails and audio covers.
const ICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function cleanupCache() {
  rmSync(CACHE_DIR, { recursive: true, force: true });
}

function printPlan(project, assets, existing) {
  const resolved = Object.fromEntries(
    Object.entries(assets).map(([className, entries]) => [className, entries.length]),
  );
  console.log(`[seed:dev] project gated: ${project}`);
  console.log(`[seed:dev] plan: resolved ${JSON.stringify(resolved)}`);
  console.log(`[seed:dev] plan: existing ${JSON.stringify(existing)}`);
  console.log('[seed:dev] ids match devseed-*; storage matches dev-seed/*');
  console.log(buildPerAssetLedger(assets));
}

function functionsRequire() {
  return createRequire(new URL('../../functions/package.json', import.meta.url));
}

function initAdmin(project) {
  assertDevProject(project);
  const expected = expectedProjectConfig(project);
  const require = functionsRequire();
  const admin = require('firebase-admin');
  const { getDatabase } = require('firebase-admin/database');
  const { getStorage } = require('firebase-admin/storage');
  if (!admin.getApps().length) {
    admin.initializeApp(expected);
  }
  assertProjectConfig(admin.app().options, expected);
  return { admin, db: getDatabase(), bucket: getStorage().bucket() };
}

async function resolveCredentialProject() {
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (file) {
    return credentialProjectFromFile(file);
  }
  const { GoogleAuth } = functionsRequire()('google-auth-library');
  try {
    return await new GoogleAuth().getProjectId();
  } catch {
    return null;
  }
}

/** Counts only this module's records so the dry run is a real idempotency check. */
export async function readExisting(db) {
  const existing = {};
  for (const node of MANAGED_NODES) {
    const snapshot = await db.ref(node).get();
    const value = snapshot.val() ?? {};
    existing[node] = Object.keys(value).filter((key) => key.startsWith(ID_PREFIX)).length;
  }
  return existing;
}

export async function cleanDevRecords(db, bucket) {
  assertSeedNamespace();
  const removed = {};
  for (const node of MANAGED_NODES) {
    const snapshot = await db.ref(node).get();
    const value = snapshot.val() ?? {};
    const keys = Object.keys(value).filter((key) => key.startsWith(ID_PREFIX));
    if (keys.length) {
      const updates = {};
      for (const key of keys) {
        updates[key] = null;
      }
      await db.ref(node).update(updates);
    }
    removed[node] = keys.length;
  }
  const [files] = await bucket.getFiles({ prefix: STORAGE_PREFIX });
  const failures = [];
  let objects = 0;
  for (const file of files) {
    try {
      await file.delete();
      objects += 1;
    } catch (error) {
      failures.push({ name: file.name, message: error?.message ?? String(error) });
    }
  }
  if (failures.length) {
    throw new Error(
      `failed to delete ${failures.length} storage object(s): ${JSON.stringify(failures)}`,
    );
  }
  return { removed, objects };
}

export async function upload(bucket, buffer, destination, contentType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(`refusing to upload empty or non-buffer content to ${destination}`);
  }
  // The Firebase download-token URL never expires, unlike a v4 signed URL
  // capped at seven days, so seeded media stays playable in the dev app.
  const token = randomUUID();
  const file = bucket.file(destination);
  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: 'private, max-age=0',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/`
    + `${encodeURIComponent(destination)}?alt=media&token=${token}`;
}

function chunk(list, size) {
  const groups = [];
  for (let index = 0; index < list.length; index += size) {
    groups.push(list.slice(index, index + size));
  }
  return groups;
}

async function buildTree(manifest, assets, bucket, now, runId) {
  const tree = {
    families: {},
    people: {},
    messages: {},
    media: {},
    photoAlbums: {},
    photos: {},
    songs: {},
    familyExplorer: {},
  };
  const summary = {};

  for (const family of manifest.families) {
    tree.families[family.id] = { ...family, createdAt: now, updatedAt: now };
  }

  for (const [id, person] of Object.entries(manifest.people)) {
    tree.people[id] = { ...person, createdAt: now, updatedAt: now };
  }

  manifest.expressions.forEach((expression) => {
    tree.messages[expression.id] = {
      id: expression.id,
      title: expression.title,
      body: expression.body,
      attachmentId: '',
      attachmentType: '',
      attachmentUrl: '',
      authorName: expression.attribution,
      authorId: OWNER_ID,
      attribution: expression.attribution,
      yearWritten: expression.yearWritten,
      isReply: false,
      replyLevel: 0,
      likes: [],
      replies: [],
      dateSent: now,
      isEditable: false,
      isSaved: false,
      isDeleted: false,
      isSticky: false,
      messageType: 'expression',
    };
  });
  summary.expressions = manifest.expressions.length;

  const personIds = Object.keys(manifest.people);
  manifest.songs.forEach((song, index) => {
    tree.songs[song.id] = {
      ...song,
      leaderIds: personIds.slice(index * 2, index * 2 + 2),
      createdAt: now,
      updatedAt: now,
    };
  });
  summary.songs = manifest.songs.length;

  const videoUrls = {};
  for (const [index, asset] of assets.videos.entries()) {
    const id = `${ID_PREFIX}video-${index + 1}`;
    const extension = extname(asset.path) || '.mp4';
    const destination = `${STORAGE_PREFIX}runs/${runId}/videos/${id}${extension}`;
    const download = await upload(bucket, asset.buffer, destination, asset.contentType || 'video/mp4');
    const icon = await upload(bucket, ICON_PNG, `${STORAGE_PREFIX}runs/${runId}/icons/${id}.png`, 'image/png');
    videoUrls[id] = { download, icon };
    tree.media[id] = {
      id,
      title: asset.title,
      artist: '',
      date: String(new Date(now).getUTCFullYear()),
      folderName: 'devseed',
      fileName: `${id}${extension}`,
      isSticky: false,
      isHidden: false,
      listing: [],
      urls: { download, icon },
      type: 'video',
      format: asset.contentType || 'video/mp4',
      dateUpdated: now,
    };
  }
  summary.videos = Object.keys(videoUrls).length;

  const photoGroups = chunk(assets.photoAlbums, manifest.assetSources.photoAlbums.perAlbum);
  for (const [albumIndex, group] of photoGroups.entries()) {
    const albumId = `${ID_PREFIX}photo-album-${albumIndex + 1}`;
    const photoIds = [];
    for (const [photoIndex, asset] of group.entries()) {
      const id = `${ID_PREFIX}photo-${albumIndex + 1}-${photoIndex + 1}`;
      const extension = extname(asset.path) || '.jpg';
      const destination = `${STORAGE_PREFIX}runs/${runId}/photos/${albumId}/${id}${extension}`;
      const url = await upload(bucket, asset.buffer, destination, asset.contentType || 'image/jpeg');
      photoIds.push(id);
      tree.photos[id] = {
        id,
        dateAdded: now - photoIndex * 86400000,
        path: destination,
        extension: extension.replace('.', ''),
        url,
        info: asset.title,
        location: 'Dev Seed Archive',
        year: new Date(now).getUTCFullYear(),
        takenBy: OWNER_NAME,
        uploadedBy: OWNER_ID,
        isYearCirca: false,
        isEditable: false,
        isMessageAttachment: false,
        albumId,
      };
    }
    tree.photoAlbums[albumId] = {
      id: albumId,
      title: `Dev Seed Photo Album ${albumIndex + 1}`,
      coverPhotoId: photoIds[0],
      createdAt: now,
      updatedAt: now,
    };
  }
  summary.photoAlbums = photoGroups.length;

  const audioGroups = chunk(assets.audioAlbums, manifest.assetSources.audioAlbums.perAlbum);
  for (const [albumIndex, group] of audioGroups.entries()) {
    const albumId = `${ID_PREFIX}audio-album-${albumIndex + 1}`;
    const trackIds = [];
    let firstDownload = '';
    for (const [trackIndex, asset] of group.entries()) {
      const id = `${ID_PREFIX}audio-track-${albumIndex + 1}-${trackIndex + 1}`;
      const extension = extname(asset.path) || '.mp3';
      const destination = `${STORAGE_PREFIX}runs/${runId}/audio/${albumId}/${id}${extension}`;
      const download = await upload(bucket, asset.buffer, destination, asset.contentType || 'audio/mpeg');
      if (!firstDownload) {
        firstDownload = download;
      }
      trackIds.push(id);
      tree.media[id] = {
        id,
        title: asset.title,
        artist: OWNER_NAME,
        date: String(new Date(now).getUTCFullYear()),
        folderName: '',
        fileName: `${id}${extension}`,
        isSticky: false,
        isHidden: false,
        listing: [],
        urls: { download, icon: '' },
        type: 'audio-track',
        format: asset.contentType || 'audio/mpeg',
        dateUpdated: now,
      };
    }
    tree.media[albumId] = {
      id: albumId,
      title: `Dev Seed Audio Album ${albumIndex + 1}`,
      artist: OWNER_NAME,
      date: String(new Date(now).getUTCFullYear()),
      folderName: `Dev+Seed+Audio+Album+${albumIndex + 1}`,
      fileName: '',
      isSticky: false,
      isHidden: false,
      listing: trackIds,
      urls: { download: firstDownload, icon: '' },
      type: 'audio-album',
      format: 'collection/audio',
      dateUpdated: now,
    };
  }
  summary.audioAlbums = audioGroups.length;

  manifest.families.forEach((family, familyIndex) => {
    const members = Object.values(manifest.people)
      .filter((person) => person.familyId === family.id)
      .map((person, index) => ({
        id: person.id,
        given: person.name.firstGiven,
        surname: person.name.last,
        name: `${person.name.firstGiven} ${person.name.last}`,
        suffix: null,
        sex: index % 2 === 0 ? 'M' : 'F',
        birthDate: `${person.birthday.year}-${String(person.birthday.month).padStart(2, '0')}-${String(person.birthday.day).padStart(2, '0')}`,
        birthPlace: 'Fairview',
        deathDate: person.deathDate
          ? `${person.deathDate.year}-${String(person.deathDate.month).padStart(2, '0')}-${String(person.deathDate.day).padStart(2, '0')}`
          : null,
        deathPlace: null,
        burialDate: null,
        burialPlace: null,
        occupation: null,
        fatherId: null,
        motherId: null,
        spouseIds: person.spouseId ? [person.spouseId] : [],
        childIds: [],
        marriageYears: person.spouseId ? { [person.spouseId]: person.anniversaryDate?.year ?? 0 } : {},
        note: null,
      }));
    const archiveId = `${ID_PREFIX}archive-${familyIndex + 1}`;
    tree.familyExplorer[archiveId] = {
      title: `${family.name} Family`,
      published: true,
      updatedAt: now,
      updatedBy: OWNER_ID,
      people: Object.fromEntries(members.map((member) => [member.id, member])),
    };
  });
  summary.familyArchives = Object.keys(tree.familyExplorer).length;

  return { tree, summary };
}

/** A write needs --confirm, and only --confirm chooses clean or seed. */
export function resolveMode(argv = []) {
  if (!hasFlag(argv, '--confirm')) {
    return 'plan';
  }
  return hasFlag(argv, '--clean') ? 'clean' : 'seed';
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const project = resolveProjectId(argv);
  assertDevProject(project);
  assertSeedNamespace();

  const manifest = buildManifest();
  assertManifestProject(manifest.project, project);
  const mode = resolveMode(argv);
  const init = deps.initAdmin ?? initAdmin;
  const download = deps.downloadAll ?? downloadAll;
  const cleanup = deps.cleanupCache ?? cleanupCache;
  const credential = deps.resolveCredentialProject ?? resolveCredentialProject;

  cleanup();
  let adminModule = null;
  try {
    const { admin, db, bucket } = init(project);
    adminModule = admin;

    if (mode === 'plan') {
      const assets = await download(manifest.assetSources, CACHE_DIR);
      const existing = await readExisting(db);
      printPlan(project, assets, existing);
      console.log('[seed:dev] nothing written: pass --confirm');
      return { mode, existing };
    }

    await assertDevCredential(await credential());

    if (mode === 'clean') {
      assertSeedNamespace();
      const result = await cleanDevRecords(db, bucket);
      console.log(`[seed:dev] cleaned ${JSON.stringify(result)}`);
      return { mode, result };
    }

    const assets = await download(manifest.assetSources, CACHE_DIR);
    const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const { tree, summary } = await buildTree(manifest, assets, bucket, Date.now(), runId);
    for (const [node, value] of Object.entries(tree)) {
      if (Object.keys(value).length) {
        await db.ref(node).update(value);
      }
    }
    console.log(`[seed:dev] wrote ${JSON.stringify(summary)}`);
    console.log('[seed:dev] rerun replaces devseed-* records; --clean removes them');
    return { mode, summary, runId };
  } finally {
    cleanup();
    if (adminModule) {
      await adminModule.getApp().delete().catch(() => undefined);
    }
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  process.on('SIGINT', () => {
    cleanupCache();
    process.exit(130);
  });

  main().catch((error) => {
    cleanupCache();
    console.error(`[seed:dev] FAILED: ${error.message}`);
    process.exit(1);
  });
}
