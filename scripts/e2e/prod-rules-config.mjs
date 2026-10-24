#!/usr/bin/env node
/**
 * Writes a throwaway Firebase config whose Storage rules are storage.rules.prod,
 * so `firebase emulators:exec --config "$(...)"` can exercise the deployed
 * policy locally. Absolute paths keep it independent of the config's location.
 * Prints the config path on stdout.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lecoursville-prod-rules-'));
const functionsDir = path.join(root, 'functions');

const config = {
  ...base,
  hosting: { ...base.hosting, public: path.join(root, 'dist/lecoursville/browser') },
  // firebase-tools resolves functions.source against the config directory even
  // when it is absolute, so keep this one relative to the temp config.
  functions: { ...base.functions, source: path.relative(dir, functionsDir) },
  storage: { rules: path.join(root, 'storage.rules.prod') },
  database: { rules: path.join(root, 'database.rules.json') },
};

const file = path.join(dir, 'firebase.json');
fs.writeFileSync(file, JSON.stringify(config, null, 2));
console.log(file);
