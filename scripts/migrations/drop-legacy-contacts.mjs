#!/usr/bin/env node
/**
 * Delete the retired legacy `contacts` RTDB node.
 *
 * Dry run by default. `--confirm` performs the deletion and also requires
 * `--acknowledge-people-source`. Refuses while the checked-in or deployed
 * rules still grant client writes to `contacts`, because a write could
 * recreate the node after the migration.
 *
 * Usage:
 *   node scripts/migrations/drop-legacy-contacts.mjs --project <id> [--confirm]
 *     [--acknowledge-people-source]
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

export const TAG = '[drop-legacy-contacts]';
export const CONTACTS_NODE = 'contacts';
export const PROJECT_ENVIRONMENTS = {
  'lecoursville-dev': 'development',
  lecoursville: 'production',
};
const CHECKED_IN_RULES_PATH = resolve(process.cwd(), 'database.rules.json');

export function usage(message) {
  throw new Error(
    `${message}\n\nUsage: node scripts/migrations/drop-legacy-contacts.mjs --project <id> [--confirm] [--acknowledge-people-source]`,
  );
}

export function parseArgs(argv) {
  const opts = { project: null, confirm: false, acknowledged: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) usage('--project needs a project id');
      opts.project = value;
      i += 1;
    } else if (arg === '--confirm') {
      opts.confirm = true;
    } else if (arg === '--acknowledge-people-source') {
      opts.acknowledged = true;
    } else {
      usage(`unknown argument: ${arg}`);
    }
  }

  if (!opts.project) usage('--project <id> is required');
  if (!PROJECT_ENVIRONMENTS[opts.project]) {
    usage(
      `--project ${opts.project} is not allowed; expected one of ${Object.keys(PROJECT_ENVIRONMENTS).join(', ')}`,
    );
  }
  if (opts.confirm && !opts.acknowledged) {
    usage(
      '--confirm requires --acknowledge-people-source after you have verified People is the sole source or taken an export',
    );
  }
  return opts;
}

/** Any client write grant under the contacts node, at the top level or nested. */
export function contactsWriteRule(rules) {
  return findWriteGrant(rules?.rules?.[CONTACTS_NODE]);
}

function findWriteGrant(node) {
  if (!node || typeof node !== 'object') return null;
  if (node['.write']) return node['.write'];
  for (const value of Object.values(node)) {
    const grant = findWriteGrant(value);
    if (grant) return grant;
  }
  return null;
}

/** Top-level record count plus the serialized byte size of the node value. */
export function summarizeContacts(value) {
  const records = value && typeof value === 'object' ? Object.keys(value).length : 0;
  const bytes = Buffer.byteLength(JSON.stringify(value ?? null));
  return { records, bytes };
}

function assertNoContactsWrite(rules, source, project) {
  const grant = contactsWriteRule(rules);
  if (grant) {
    throw new Error(
      `refusing: ${source} for ${project} still grants client writes to ${CONTACTS_NODE} (${JSON.stringify(grant)}); remove that write rule, deploy the rules, then run this migration`,
    );
  }
}

function parseDeployedRules(raw, project) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error(
      `refusing: could not parse the deployed rules for ${project}; check the rules deployment in the Firebase console before deleting`,
    );
  }
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const opts = parseArgs(argv);
  const environment = PROJECT_ENVIRONMENTS[opts.project];

  const readCheckedInRules = deps.readCheckedInRules
    ?? (() => JSON.parse(readFileSync(CHECKED_IN_RULES_PATH, 'utf8')));
  assertNoContactsWrite(readCheckedInRules(), CHECKED_IN_RULES_PATH, opts.project);

  let admin = deps.admin;
  let getDatabase = deps.getDatabase;
  if (!admin || !getDatabase) {
    const functionsRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
    admin = admin ?? functionsRequire('firebase-admin');
    getDatabase = getDatabase ?? functionsRequire('firebase-admin/database').getDatabase;
  }
  admin.initializeApp({
    projectId: opts.project,
    databaseURL: `https://${opts.project}-default-rtdb.firebaseio.com`,
  });

  console.log(`${TAG} timestamp: ${new Date().toISOString()}`);
  console.log(`${TAG} project: ${opts.project}`);
  console.log(`${TAG} environment: ${environment}`);
  console.log(`${TAG} mode: ${opts.confirm ? 'apply' : 'dry-run'}`);

  try {
    const db = getDatabase();
    const deployedRules = parseDeployedRules(await db.getRules(), opts.project);
    assertNoContactsWrite(deployedRules, 'deployed rules', opts.project);

    const before = summarizeContacts((await db.ref(CONTACTS_NODE).get()).val());
    console.log(`${TAG} before: records=${before.records} bytes=${before.bytes}`);

    if (!opts.confirm) {
      console.log(
        `${TAG} warning: this dry run cannot verify People is the sole source of truth; take an export or verify it before --confirm`,
      );
      console.log(`${TAG} dry run: no database writes; pass --confirm to delete ${CONTACTS_NODE}/`);
      return { removed: false, before };
    }

    if (before.records === 0) {
      console.log(`${TAG} nothing to delete`);
      return { removed: false, before };
    }

    await db.ref(CONTACTS_NODE).remove();
    const after = summarizeContacts((await db.ref(CONTACTS_NODE).get()).val());
    console.log(`${TAG} after: records=${after.records} bytes=${after.bytes}`);
    if (after.records !== 0) {
      throw new Error(`${after.records} ${CONTACTS_NODE} records remain after delete`);
    }
    console.log(`${TAG} done`);
    return { removed: true, before, after };
  } finally {
    await admin.getApp().delete();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`${TAG} FAILED: ${err.message}`);
    process.exit(1);
  });
}
