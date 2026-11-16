#!/usr/bin/env node
/**
 * Operator hard delete for a granted data-removal request.
 *
 * Dry run by default. `--confirm` requires every argument plus a granted,
 * verified request, writes a pre-delete export to a file, then removes the
 * allowlisted target and leaves a minimal non-PII audit entry.
 *
 * Usage:
 *   node scripts/migrations/delete-data-request-subject.mjs --project <id>
 *     --request-id <id> --path <people|photos|media|calendar|messages>/<id>
 *     --export <file> --actor <uid> [--confirm]
 */

import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { basename } from 'path';
import { pathToFileURL } from 'url';

export const TAG = '[delete-data-request-subject]';
export const ALLOWED_TARGETS = ['people', 'photos', 'media', 'calendar', 'messages'];
export const PROJECT_ENVIRONMENTS = {
  'lecoursville-dev': 'development',
  lecoursville: 'production',
};

export function usage(message) {
  throw new Error(
    `${message}\n\nUsage: node scripts/migrations/delete-data-request-subject.mjs --project <id>`
    + ' --request-id <id> --path <node>/<id> --export <file> --actor <uid> [--confirm]',
  );
}

/** Rejects traversal and anything outside the named data classes. */
export function validateTargetPath(path) {
  if (typeof path !== 'string' || !path) usage('--path is required');
  const parts = path.split('/');
  if (parts.length < 2 || parts.some(part => !part || part === '.' || part === '..')) {
    usage(`--path must be <class>/<record> with no empty, "." or ".." segments: ${path}`);
  }
  if (!ALLOWED_TARGETS.includes(parts[0])) {
    usage(`--path class must be one of ${ALLOWED_TARGETS.join(', ')}: ${parts[0]}`);
  }
  return parts;
}

export function parseArgs(argv) {
  const opts = {
    project: null,
    requestId: null,
    path: null,
    exportFile: null,
    actor: null,
    confirm: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) usage(`${arg} needs a value`);
      i += 1;
      return next;
    };
    if (arg === '--project') opts.project = value();
    else if (arg === '--request-id') opts.requestId = value();
    else if (arg === '--path') opts.path = value();
    else if (arg === '--export') opts.exportFile = value();
    else if (arg === '--actor') opts.actor = value();
    else if (arg === '--confirm') opts.confirm = true;
    else usage(`unknown argument: ${arg}`);
  }

  if (!opts.project) usage('--project <id> is required');
  if (!PROJECT_ENVIRONMENTS[opts.project]) {
    usage(
      `--project ${opts.project} is not allowed; expected one of ${Object.keys(PROJECT_ENVIRONMENTS).join(', ')}`,
    );
  }
  if (!opts.requestId) usage('--request-id <id> is required');
  if (!opts.exportFile) usage('--export <file> is required');
  if (!opts.actor) usage('--actor <uid> is required');
  opts.targetParts = validateTargetPath(opts.path);
  return opts;
}

/** The request must be the granted, verified, resolved removal that names this class. */
export function assertGrantedRemoval(request, dataClass, requestId) {
  if (!request) {
    throw new Error(`refusing: no data request ${requestId}`);
  }
  if (request.kind !== 'removal') {
    throw new Error(`refusing: request ${requestId} kind is ${request.kind}, not removal`);
  }
  if (request.status !== 'resolved') {
    throw new Error(`refusing: request ${requestId} status is ${request.status}, not resolved`);
  }
  if (!request.verifiedAt || !request.verifiedBy) {
    throw new Error(`refusing: request ${requestId} has no recorded identity verification`);
  }
  if (!request.grantedAt || !request.grantedBy) {
    throw new Error(`refusing: request ${requestId} has no granted removal decision`);
  }
  if (request.dataClass !== dataClass) {
    throw new Error(
      `refusing: request ${requestId} names ${request.dataClass}, target is ${dataClass}`,
    );
  }
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const opts = parseArgs(argv);
  const dataClass = opts.targetParts[0];
  const environment = PROJECT_ENVIRONMENTS[opts.project];

  let admin = deps.admin;
  let getDatabase = deps.getDatabase;
  if (!admin || !getDatabase) {
    const functionsRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
    admin = admin ?? functionsRequire('firebase-admin');
    getDatabase = getDatabase ?? functionsRequire('firebase-admin/database').getDatabase;
  }
  const writeFile = deps.writeFile ?? ((file, content) => writeFileSync(file, content));
  const now = deps.now ?? Date.now;

  admin.initializeApp({
    projectId: opts.project,
    databaseURL: `https://${opts.project}-default-rtdb.firebaseio.com`,
  });

  console.log(`${TAG} timestamp: ${new Date(now()).toISOString()}`);
  console.log(`${TAG} project: ${opts.project}`);
  console.log(`${TAG} environment: ${environment}`);
  console.log(`${TAG} mode: ${opts.confirm ? 'apply' : 'dry-run'}`);
  console.log(`${TAG} request: ${opts.requestId}`);
  console.log(`${TAG} target: ${opts.path}`);

  try {
    const db = getDatabase();
    const request = (await db.ref(`dataRequests/${opts.requestId}`).get()).val();
    assertGrantedRemoval(request, dataClass, opts.requestId);

    const target = (await db.ref(opts.path).get()).val();
    if (target === null || target === undefined) {
      console.log(`${TAG} nothing to delete at ${opts.path}`);
      return { deleted: false, exported: false };
    }

    if (!opts.confirm) {
      console.log(`${TAG} dry run: no export and no delete; pass --confirm to delete ${opts.path}`);
      return { deleted: false, exported: false, found: true };
    }

    const exportedAt = now();
    writeFile(
      opts.exportFile,
      JSON.stringify({ requestId: opts.requestId, targetPath: opts.path, exportedAt, data: target }, null, 2),
    );
    console.log(`${TAG} export written: ${opts.exportFile}`);

    await db.ref(opts.path).remove();
    const auditKey = db.ref('dataRequestAudit').push({
      requestId: opts.requestId,
      action: 'removal_deleted',
      dataClass,
      targetPath: opts.path,
      exportFile: basename(opts.exportFile),
      actorUid: opts.actor,
      createdAt: exportedAt,
    }).key;
    console.log(`${TAG} deleted ${opts.path} after export ${opts.exportFile}`);
    console.log(`${TAG} audit entry: ${auditKey}`);
    return { deleted: true, exported: true, auditKey };
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
