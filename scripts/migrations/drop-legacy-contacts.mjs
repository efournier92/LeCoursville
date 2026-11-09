#!/usr/bin/env node
/**
 * Delete the retired legacy `contacts` RTDB node.
 *
 * Dry run by default. `--confirm` performs the deletion. Refuses while the
 * checked-in rules still grant client writes to `contacts`, because a write
 * could recreate the node after the migration.
 *
 * Usage:
 *   node scripts/migrations/drop-legacy-contacts.mjs --project <id> [--confirm] [--rules <path>]
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

export const TAG = '[drop-legacy-contacts]';
export const CONTACTS_NODE = 'contacts';
const DEFAULT_RULES_PATH = 'database.rules.json';

export function usage(message) {
  throw new Error(
    `${message}\n\nUsage: node scripts/migrations/drop-legacy-contacts.mjs --project <id> [--confirm] [--rules <path>]`,
  );
}

export function parseArgs(argv) {
  const opts = { project: null, confirm: false, rulesPath: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) usage('--project needs a project id');
      opts.project = value;
      i += 1;
    } else if (arg === '--rules') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) usage('--rules needs a file path');
      opts.rulesPath = value;
      i += 1;
    } else if (arg === '--confirm') {
      opts.confirm = true;
    } else {
      usage(`unknown argument: ${arg}`);
    }
  }

  if (!opts.project) usage('--project <id> is required');
  return opts;
}

/** The `.write` expression for the contacts node, or null when it is absent. */
export function contactsWriteRule(rules) {
  const node = rules?.rules?.[CONTACTS_NODE];
  if (!node || typeof node !== 'object') return null;
  return node['.write'] ?? null;
}

/** Top-level record count plus the serialized byte size of the node value. */
export function summarizeContacts(value) {
  const records = value && typeof value === 'object' ? Object.keys(value).length : 0;
  const bytes = Buffer.byteLength(JSON.stringify(value ?? null));
  return { records, bytes };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rulesPath = resolve(process.cwd(), opts.rulesPath ?? DEFAULT_RULES_PATH);
  const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));

  const writeRule = contactsWriteRule(rules);
  if (writeRule) {
    throw new Error(
      `refusing: ${rulesPath} still grants client writes to ${CONTACTS_NODE}; deploy the rules removal first`,
    );
  }

  const functionsRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
  const admin = functionsRequire('firebase-admin');
  const { getDatabase } = functionsRequire('firebase-admin/database');
  admin.initializeApp({
    projectId: opts.project,
    databaseURL: `https://${opts.project}-default-rtdb.firebaseio.com`,
  });

  console.log(`${TAG} timestamp: ${new Date().toISOString()}`);
  console.log(`${TAG} project: ${opts.project}`);
  console.log(`${TAG} mode: ${opts.confirm ? 'apply' : 'dry-run'}`);

  try {
    const db = getDatabase();
    const before = summarizeContacts((await db.ref(CONTACTS_NODE).get()).val());
    console.log(`${TAG} before: records=${before.records} bytes=${before.bytes}`);

    if (!opts.confirm) {
      console.log(`${TAG} dry run: no database writes; pass --confirm to delete ${CONTACTS_NODE}/`);
      return;
    }

    if (before.records === 0) {
      console.log(`${TAG} nothing to delete`);
      return;
    }

    await db.ref(CONTACTS_NODE).remove();
    const after = summarizeContacts((await db.ref(CONTACTS_NODE).get()).val());
    console.log(`${TAG} after: records=${after.records} bytes=${after.bytes}`);
    console.log(`${TAG} done`);
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
