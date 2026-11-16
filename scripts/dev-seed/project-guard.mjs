/**
 * Dev seed project guard (UI-008). Resolves the intended Firebase project
 * without reading any credential file, then refuses anything but the dev
 * project. A write additionally needs --confirm.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const DEV_PROJECT = 'lecoursville-dev';

export function hasFlag(argv, flag) {
  return argv.includes(flag);
}

export function resolveProjectId(argv = [], env = process.env, root = process.cwd()) {
  const index = argv.indexOf('--project');
  if (index !== -1 && argv[index + 1]) {
    return argv[index + 1];
  }
  if (env.GCLOUD_PROJECT) {
    return env.GCLOUD_PROJECT;
  }
  if (env.FIREBASE_PROJECT) {
    return env.FIREBASE_PROJECT;
  }
  try {
    const firebaserc = JSON.parse(readFileSync(resolve(root, '.firebaserc'), 'utf8'));
    return firebaserc?.projects?.default ?? null;
  } catch {
    return null;
  }
}

/** Throws unless the resolved project is exactly the dev project. */
export function assertDevProject(project) {
  if (project !== DEV_PROJECT) {
    throw new Error(
      `refusing to seed: project "${project ?? 'unknown'}" is not "${DEV_PROJECT}". `
        + 'The dev seed never reads or touches another project.',
    );
  }
}

/** The exact Admin SDK config derived from a validated project id. */
export function expectedProjectConfig(project) {
  return {
    projectId: project,
    databaseURL: `https://${project}-default-rtdb.firebaseio.com`,
    storageBucket: `${project}.appspot.com`,
  };
}

/** Every Admin SDK target must match the validated project, not a manifest constant. */
export function assertProjectConfig(actual, expected = expectedProjectConfig(DEV_PROJECT)) {
  for (const key of ['projectId', 'databaseURL', 'storageBucket']) {
    if (actual?.[key] !== expected[key]) {
      throw new Error(
        `refusing to seed: Admin SDK ${key} "${actual?.[key] ?? 'missing'}" is not "${expected[key]}".`,
      );
    }
  }
}

/** The manifest project must agree with the validated project before any write. */
export function assertManifestProject(manifestProject, project) {
  if (manifestProject !== project || manifestProject !== DEV_PROJECT) {
    throw new Error(
      `refusing to seed: manifest project "${manifestProject}" is not "${project}".`,
    );
  }
}

/** A resolved credential project is required and must be dev. */
export function assertDevCredential(projectId) {
  if (!projectId) {
    throw new Error(
      'refusing to seed: cannot verify the credential project. '
        + 'Set GOOGLE_APPLICATION_CREDENTIALS to a lecoursville-dev service account.',
    );
  }
  if (projectId !== DEV_PROJECT) {
    throw new Error(
      `refusing to seed: credential project "${projectId}" is not "${DEV_PROJECT}".`,
    );
  }
}

/** Reads project_id from a service-account JSON file without trusting its name. */
export function credentialProjectFromFile(file, read = readFileSync) {
  try {
    return JSON.parse(read(file, 'utf8')).project_id ?? null;
  } catch {
    return null;
  }
}
