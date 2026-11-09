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
