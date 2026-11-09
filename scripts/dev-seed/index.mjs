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
 *   npm run seed:dev                    # print the plan, write nothing
 *   npm run seed:dev -- --confirm       # download, upload, and write records
 *   npm run seed:dev -- --clean --confirm
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadAll } from './downloader.mjs';
import {
  buildManifest,
  ID_PREFIX,
  OWNER_ID,
  OWNER_NAME,
  PROJECT,
  STORAGE_PREFIX,
} from './manifest.mjs';
import { assertDevProject, hasFlag, resolveProjectId } from './project-guard.mjs';

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

const argv = process.argv.slice(2);

function cleanupCache() {
  rmSync(CACHE_DIR, { recursive: true, force: true });
}

function printPlan(manifest, clean) {
  const counts = {
    families: manifest.families.length,
    people: Object.keys(manifest.people).length,
    contacts: manifest.contacts.length,
    calendarEvents: manifest.calendarEvents.length,
    expressions: manifest.expressions.length,
    songs: manifest.songs.length,
    videos: manifest.assetSources.videos.want,
    photoAlbums: manifest.assetSources.photoAlbums.want / manifest.assetSources.photoAlbums.perAlbum,
    photoCount: manifest.assetSources.photoAlbums.want,
    audioAlbums: manifest.assetSources.audioAlbums.want / manifest.assetSources.audioAlbums.perAlbum,
    audioTracks: manifest.assetSources.audioAlbums.want,
  };
  console.log(`[seed:dev] project gated: ${PROJECT}`);
  console.log(`[seed:dev] ${clean ? 'clean' : 'plan'}: ${JSON.stringify(counts)}`);
  console.log('[seed:dev] ids match devseed-*; storage matches dev-seed/*');
}

function initAdmin() {
  const require = createRequire(new URL('../../functions/package.json', import.meta.url));
  const admin = require('firebase-admin');
  const { getDatabase } = require('firebase-admin/database');
  const { getStorage } = require('firebase-admin/storage');
  if (!admin.getApps().length) {
    admin.initializeApp({
      projectId: PROJECT,
      databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com`,
      storageBucket: `${PROJECT}.appspot.com`,
    });
  }
  return { admin, db: getDatabase(), bucket: getStorage().bucket() };
}

async function cleanDevRecords(db, bucket) {
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
  await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
  return { removed, objects: files.length };
}

async function upload(bucket, buffer, destination, contentType) {
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

async function buildTree(manifest, assets, bucket, now) {
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
      authorName: OWNER_NAME,
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
    const destination = `${STORAGE_PREFIX}videos/${id}${extension}`;
    const download = await upload(bucket, asset, destination, asset.contentType || 'video/mp4');
    const icon = await upload(bucket, ICON_PNG, `${STORAGE_PREFIX}icons/${id}.png`, 'image/png');
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
      const destination = `${STORAGE_PREFIX}photos/${albumId}/${id}${extension}`;
      const url = await upload(bucket, asset, destination, asset.contentType || 'image/jpeg');
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
      const destination = `${STORAGE_PREFIX}audio/${albumId}/${id}${extension}`;
      const download = await upload(bucket, asset, destination, asset.contentType || 'audio/mpeg');
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

async function main() {
  const project = resolveProjectId(argv);
  assertDevProject(project);

  const manifest = buildManifest();
  const clean = hasFlag(argv, '--clean');
  const confirm = hasFlag(argv, '--confirm');

  if (!confirm) {
    printPlan(manifest, clean);
    console.log('[seed:dev] nothing written: pass --confirm');
    return;
  }

  cleanupCache();
  let adminModule = null;
  try {
    const { admin, db, bucket } = initAdmin();
    adminModule = admin;

    if (clean) {
      const result = await cleanDevRecords(db, bucket);
      console.log(`[seed:dev] cleaned ${JSON.stringify(result)}`);
      return;
    }

    const assets = await downloadAll(manifest.assetSources, CACHE_DIR);
    const { tree, summary } = await buildTree(manifest, assets, bucket, Date.now());
    for (const [node, value] of Object.entries(tree)) {
      if (Object.keys(value).length) {
        await db.ref(node).update(value);
      }
    }
    console.log(`[seed:dev] wrote ${JSON.stringify(summary)}`);
    console.log('[seed:dev] rerun replaces devseed-* records; --clean removes them');
  } finally {
    cleanupCache();
    if (adminModule) {
      await adminModule.getApp().delete().catch(() => undefined);
    }
  }
}

process.on('SIGINT', () => {
  cleanupCache();
  process.exit(130);
});

main().catch((error) => {
  cleanupCache();
  console.error(`[seed:dev] FAILED: ${error.message}`);
  process.exit(1);
});
