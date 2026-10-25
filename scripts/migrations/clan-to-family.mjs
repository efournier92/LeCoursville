#!/usr/bin/env node
/**
 * Migrate the legacy `clans` node and `Person.clanId` to `families` and
 * `Person.familyId`.
 *
 * Default mode is a dry run. `--apply` writes families plus people familyId.
 * `--delete-legacy` is the only destructive path and runs only after a
 * successful apply in the same invocation and passing post-checks.
 *
 * Requires `npm --prefix functions run build` for the transform at
 * functions/lib/maintenance/clan-to-family.js.
 */

import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
// Resolve the Admin SDK from the functions package, matching scripts/e2e/seed.mjs.
const admin = require('../../functions/node_modules/firebase-admin');
const { mergeFamilyNodes } = require('../../functions/lib/maintenance/clan-to-family.js');

const TAG = '[clan-to-family]';

function usage(message) {
  throw new Error(`${message}\n\nUsage: node scripts/migrations/clan-to-family.mjs --project <id> [--dry-run] [--apply] [--delete-legacy] [--export <path>]`);
}

function parseArgs(argv) {
  const opts = {
    project: null,
    dryRun: false,
    apply: false,
    deleteLegacy: false,
    exportPath: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) usage('--project needs a project id');
      opts.project = value;
      i += 1;
    } else if (arg === '--export') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) usage('--export needs a file path');
      opts.exportPath = value;
      i += 1;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--apply') {
      opts.apply = true;
    } else if (arg === '--delete-legacy') {
      opts.deleteLegacy = true;
    } else {
      usage(`unknown argument: ${arg}`);
    }
  }

  if (!opts.project) usage('--project <id> is required');
  if (opts.apply && opts.dryRun) usage('--apply and --dry-run are mutually exclusive');
  if (opts.deleteLegacy && !opts.apply) {
    usage('--delete-legacy requires --apply in the same invocation');
  }
  if (!opts.apply) opts.dryRun = true;
  return opts;
}

function nodeCount(node) {
  return node && typeof node === 'object' ? Object.keys(node).length : 0;
}

function printReport(project, mode, clans, families, people, result) {
  const { stats, conflicts } = result;
  console.log(`${TAG} project: ${project}`);
  console.log(`${TAG} mode: ${mode}`);
  console.log(
    `${TAG} nodes: clans=${nodeCount(clans)} families=${nodeCount(families)} people=${nodeCount(people)}`
  );
  console.log(`${TAG} merge table:`);
  for (const row of stats.mergeTable) {
    const action =
      row.action === 'merged'
        ? `merged, replaces families/${row.replacedFamilyId}`
        : 'copied';
    console.log(`  ${row.clanId} ${row.name} -> families/${row.familyId} (${action})`);
  }
  console.log(
    `${TAG} families after merge: ${stats.familiesOut} (merged by name: ${stats.mergedByName}, families-only: ${stats.familiesOnly})`
  );
  console.log(`${TAG} conflicts: ${conflicts.length}`);
  for (const conflict of conflicts) {
    if (conflict.kind === 'color') {
      console.log(
        `  colour ${conflict.name}: clans/${conflict.clanId} ${conflict.clanHexColor} vs families/${conflict.familyId} ${conflict.familyHexColor}`
      );
    } else {
      console.log(`  orphan ${conflict.personId}: clans/${conflict.clanId} not found`);
    }
  }
  console.log(`${TAG} people gaining familyId: ${stats.peopleGainingFamilyId}`);
  console.log(
    `${TAG} orphan clanIds: ${stats.orphanClanIds.length}${
      stats.orphanClanIds.length ? ` (${stats.orphanClanIds.join(', ')})` : ''
    }`
  );
}

function writeExport(path, clans, families, people) {
  const target = resolve(process.cwd(), path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    `${JSON.stringify({ clans, families, people }, null, 2)}\n`,
    'utf8'
  );
  console.log(`${TAG} export: ${target}`);
}

async function readNodes(db) {
  const [clansSnap, familiesSnap, peopleSnap] = await Promise.all([
    db.ref('clans').get(),
    db.ref('families').get(),
    db.ref('people').get(),
  ]);
  return {
    clans: clansSnap.val() || {},
    families: familiesSnap.val() || {},
    people: peopleSnap.val() || {},
  };
}

async function applyMerge(db, result, beforePeople) {
  const updates = { families: result.families };
  let peopleUpdated = 0;
  for (const [personId, person] of Object.entries(result.people)) {
    const before = beforePeople[personId] || {};
    if (person.familyId && person.familyId !== before.familyId) {
      updates[`people/${personId}/familyId`] = person.familyId;
      peopleUpdated += 1;
    }
  }
  await db.ref().update(updates);
  return peopleUpdated;
}

async function postChecks(db) {
  const snapshot = await readNodes(db);
  const familyIds = new Set(Object.keys(snapshot.families));
  const errors = [];
  const names = new Set();

  for (const [familyId, family] of Object.entries(snapshot.families)) {
    const name = family && typeof family.name === 'string' ? family.name : '';
    if (!name) errors.push(`families/${familyId} has no name`);
    if (names.has(name)) errors.push(`duplicate family name: ${name}`);
    names.add(name);
  }

  for (const [personId, person] of Object.entries(snapshot.people)) {
    if (!person) continue;
    if (person.clanId && !person.familyId) {
      errors.push(`people/${personId} has clanId ${person.clanId} but no familyId`);
    }
    if (person.familyId && !familyIds.has(person.familyId)) {
      errors.push(`people/${personId} familyId ${person.familyId} has no family`);
    }
  }

  return { ok: errors.length === 0, errors, people: snapshot.people };
}

async function deleteLegacy(db, people) {
  const updates = { clans: null };
  let peopleUpdated = 0;
  for (const [personId, person] of Object.entries(people)) {
    if (person && person.clanId) {
      updates[`people/${personId}/clanId`] = null;
      peopleUpdated += 1;
    }
  }
  await db.ref().update(updates);
  return peopleUpdated;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const mode = opts.apply ? (opts.deleteLegacy ? 'apply+delete-legacy' : 'apply') : 'dry-run';
  const databaseURL = `https://${opts.project}-default-rtdb.firebaseio.com`;

  admin.initializeApp({ projectId: opts.project, databaseURL });

  try {
    const db = admin.database();
    const { clans, families, people } = await readNodes(db);
    const result = mergeFamilyNodes(clans, families, people);
    printReport(opts.project, mode, clans, families, people, result);

    if (opts.exportPath) writeExport(opts.exportPath, clans, families, people);

    if (opts.dryRun) {
      console.log(`${TAG} dry run: no database writes`);
      return;
    }

    const peopleUpdated = await applyMerge(db, result, people);
    console.log(
      `${TAG} applied: families written=${result.stats.familiesOut}, people familyId updated=${peopleUpdated}`
    );

    if (!opts.deleteLegacy) return;

    if (result.stats.orphanClanIds.length > 0) {
      throw new Error(
        `refusing --delete-legacy: orphan clanIds exist (${result.stats.orphanClanIds.join(', ')})`
      );
    }

    const checks = await postChecks(db);
    if (!checks.ok) {
      throw new Error(`refusing --delete-legacy: post-checks failed:\n- ${checks.errors.join('\n- ')}`);
    }
    console.log(`${TAG} post-checks: OK`);

    const stripped = await deleteLegacy(db, checks.people);
    console.log(
      `${TAG} deleted: clans node removed, people clanId removed=${stripped}`
    );
    console.log(`${TAG} done`);
  } finally {
    // Close the Admin SDK connection so this process can exit, as seed.mjs does.
    await admin.app().delete();
  }
}

main().catch((err) => {
  console.error(`${TAG} FAILED: ${err.message}`);
  process.exit(1);
});
