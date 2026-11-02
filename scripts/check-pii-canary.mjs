// Token-free PII canary: stores only SHA-256 hashes of forbidden phrases.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// The retained Expressions header attribution is absent by owner decision.
const HASHES = new Set([
  'd105f28c8c8ed1508bbbfdf3294200904c3e5644173235e300c2263c78fe4f2d',
  '79aef731091472c4395b63b32b2c00c919b9d9538dc1c990381cc8c4609fe9f8',
  '962314b7ef2f70007380c5b6700daedc6343ac6938e8241a44713e721993c0ac',
  '0d098b1c0162939e05719f059f0f844ed989472e9e6a53283a00fe92127ac27f',
  '4387134784cf3aa4245b7fcf4ac045d0a449524e98ba5dab4955ff4631e89df9',
  '8535e86c8118bbbb0a18ac72d15d3a2b37b18d1bce1611fc60165f322cf57386',
  '8a81e9a2dbdc9ccf4ac5091a8a3458b529de766c3320138cf1f9708e537afb01',
  'e8c63899796e0136852433d3242aa017261fffe29023283a582b2a15c94772a1',
  'ab3a903f4bc80a359f6b12c910b75f94eb134b4cad6c805ef7fac014ccd1a2bf',
  'f8e30ee2fd1c25a8ee44e43b170933e876b971958ced3ebb38bb47d4397a28ca',
  '34550715062af006ac4fab288de67ecb44793c3a05c475227241535f6ef7a81b',
  'a8220a5e779a76263db44012a02b19d763fea8ca1cb8de81b920d5df97698a96',
  'd55bcf8025bdb22b72cf95c0306748d814c0effe3859bddc00d2b1aa1882a39d',
  'c995ccc70371a90824ec28806260dba4e4783f992d641856206c871d1f7f6673',
  'ab0290a625348415db0e30bc9886d7502c4ee59add69ffe749d84bd76114f045',
  '6f48cc72f32177b24683ce624883e48c9ffc856eaf8a2140f093330f2dd9b57b',
  '22d43c214ffd1496b30b709d945c65b1faa713bfd717592208c42d9e11fc3550',
  'dcb026dadf208cf88e397cbfeae06295297cbc47b088fe42c97c23f60e73694b',
  '4007d46292298e83da10d0763d95d5139fe0c157148d0587aa912170414ccba6',
  'ec4f2dbb3b140095550c9afbbb69b5d6fd9e814b9da82fad0b34e9fcbe56f1cb',
  '776ec35521e8b77320806cad648487f9e76e6a786087b25503eaa99a0c037853',
  '7838791b0735456d29b811b60b69ba135020df20f0ded1a2144c197c02f73997',
  '345fa85559ee6fbaf1da30e56f1f00dfdd55b04533519cca3dcf515295fc9ace',
]);

const ROOTS = ['src', 'scripts', 'e2e', 'functions', 'docs', 'design_specs'];
const FILES = [
  'README.md', 'AGENTS.md', 'CLAUDE.md',
  'angular.json', 'firebase.json', 'database.rules.json', 'storage.rules',
  'storage.rules.prod', 'package.json', 'tsconfig.json', 'playwright.config.ts',
];
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.angular',
  'test-results', 'playwright-report', '.gate-results', '.gate-logs',
]);
const SELF = resolve(process.argv[1] ?? '');
const sha = (s) => createHash('sha256').update(s).digest('hex');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(path);
    } else if (stat.isFile()) {
      yield path;
    }
  }
}

function* candidates() {
  for (const root of ROOTS) {
    if (existsSync(root)) yield* walk(root);
  }
  for (const file of FILES) {
    if (existsSync(file)) yield file;
  }
}

let hit = false;
for (const path of candidates()) {
  if (resolve(path) === SELF) continue;
  const buf = readFileSync(path);
  if (buf.includes(0)) continue;
  const lines = buf.toString('utf8').toLowerCase().split('\n');
  const words = [];
  lines.forEach((line, index) => {
    const normalized = line.replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normalized) return;
    for (const word of normalized.split(' ')) {
      words.push({ word, line: index + 1 });
    }
  });
  for (let i = 0; i < words.length; i += 1) {
    const one = words[i].word;
    if (HASHES.has(sha(one))) {
      console.log(`${path}:${words[i].line} forbidden PII token`);
      hit = true;
      continue;
    }
    if (i + 1 < words.length && HASHES.has(sha(`${one} ${words[i + 1].word}`))) {
      console.log(`${path}:${words[i].line} forbidden PII token`);
      hit = true;
    }
    if (i + 2 < words.length && HASHES.has(sha(`${one} ${words[i + 1].word} ${words[i + 2].word}`))) {
      console.log(`${path}:${words[i].line} forbidden PII token`);
      hit = true;
    }
  }
}

if (hit) process.exit(1);
console.log('PII canary: clean');
