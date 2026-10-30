#!/usr/bin/env node
/**
 * Uploads a people JSON into a family-explorer archive on the LOCAL Firebase
 * emulator (never a real project). Re-run after rebuilding the JSON or after
 * any `npm run e2e:gate` / `node scripts/e2e/seed.mjs` run — both reset RTDB.
 *
 * Usage:
 *   node scripts/family/upload-people.mjs --family ferland \
 *     --file /path/to/people.json [--title "The Ferland Family"]
 *
 * --file accepts either {"people":[...]} or a bare array (same as the admin
 * ingest). Records are stored keyed by id, matching parseFamilyPeople().
 * Only `people` (and optionally `title`, `updatedAt`) are written; published,
 * updatedBy, and any other archive fields are preserved.
 */

import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
// Admin SDK resolved from the functions package, like scripts/e2e/seed.mjs.
const admin = require('../../functions/node_modules/firebase-admin');

const EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const PROJECT = 'lecoursville-dev';
const DB_URL = 'https://lecoursville-dev-default-rtdb.firebaseio.com';

function fail(message) {
  console.error(`[family:upload] FAILED: ${message}`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      family: { type: 'string' },
      file: { type: 'string' },
      title: { type: 'string' },
    },
  });
  if (!values.family) fail('--family <id> is required (e.g. --family ferland)');
  if (!/^[a-z0-9-]+$/.test(values.family)) fail('--family must be lowercase letters, numbers, and dashes only');
  if (!values.file) fail('--file <people.json> is required');

  // Guard: only ever talk to a local emulator.
  const [host, port] = EMULATOR_HOST.split(':');
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    fail(`refusing non-local database host "${EMULATOR_HOST}" — this script is emulator-only`);
  }
  const probe = await fetch(`http://${host}:${port || 9000}/`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
  if (!probe) fail(`no database emulator at ${EMULATOR_HOST} — start the suite first (see README/AGENTS.md)`);

  let payload;
  try {
    payload = JSON.parse(readFileSync(values.file, 'utf8'));
  } catch (err) {
    fail(`cannot read/parse ${values.file}: ${err.message}`);
  }
  const people = Array.isArray(payload) ? payload : payload.people;
  if (!Array.isArray(people) || people.length === 0) fail('JSON must be {"people":[...]} or a bare array of records');
  const byId = {};
  // keep in sync with PERSON_FIELDS in src/app/services/family-explorer.service.ts
  const PERSON_FIELDS = [
    'id', 'given', 'surname', 'name', 'suffix', 'sex',
    'birthDate', 'birthPlace', 'deathDate', 'deathPlace',
    'burialDate', 'burialPlace', 'occupation', 'fatherId', 'motherId',
    'spouseIds', 'childIds', 'marriageYears', 'note',
  ];
  for (const person of people) {
    if (!person.id) fail('every record needs an id');
    if (byId[person.id]) fail(`duplicate id: ${person.id}`);
    const record = {};
    for (const field of PERSON_FIELDS) {
      if (person[field] !== undefined) record[field] = person[field];
    }
    byId[person.id] = record;
  }

  process.env.FIREBASE_DATABASE_EMULATOR_HOST = EMULATOR_HOST;
  admin.initializeApp({ projectId: PROJECT, databaseURL: DB_URL });
  const ref = admin.database().ref(`familyExplorer/${values.family}`);
  const update = { people: byId, updatedAt: Date.now() };
  if (values.title) update.title = values.title;
  await ref.update(update);

  const after = (await ref.once('value')).val() || {};
  console.log(`[family:upload] OK ${values.family}: ${people.length} people, title "${after.title ?? '(unchanged)'}", published=${after.published}`);
  await admin.app().delete();
}

main().catch((err) => fail(err.message));
