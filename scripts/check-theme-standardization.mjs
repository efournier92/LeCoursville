#!/usr/bin/env node
/**
 * Theme + control standardization completeness check (spec
 * docs/specs/2026-10-31_ThemeInputStandardization.md, Test Plan).
 *
 * Exits non-zero with file:line output on any violation:
 *  1. zero raw hex colors in component SCSS + templates outside src/styles.scss
 *  2. zero non-ladder border-radius outside src/styles.scss (photos-legacy is
 *     the documented untouched exception)
 *  3. zero role-conditional control reads in user-facing templates
 *  4. no --radius-input token or usage anywhere
 *  5. database.rules.json write-rule re-audit
 *  6. dark-parity: light-block mat.*-overrides re-emitted in the dark block
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const failures = [];
const fail = (msg) => failures.push(msg);

const scss = execSync("find src -name '*.scss' -not -path 'src/styles.scss'")
  .toString().trim().split('\n').filter(Boolean);
const html = execSync("find src -name '*.html'").toString().trim().split('\n').filter(Boolean);
// C-20261031-23: TypeScript inline styles and fallbacks carried raw hex that
// the scss+html scan never saw; they must resolve to var(--*) like the rest.
// Data-color exemptions: DB-stored color DATA, not UI styling - the
// family-tree generated branch palette and the CSV import's stored default
// (plus its hex validator) legitimately hold hex literals.
const tsDataColor = /(family-tree\.model\.ts|admin-people-import\.component\.ts|admin-families\.component\.ts)$/;
const ts = execSync("find src -name '*.ts' -not -name '*.spec.ts'")
  .toString().trim().split('\n').filter(Boolean).filter((p) => !tsDataColor.test(p));

// 1. Raw hex outside styles.scss (color-mix over var() contains no hex).
for (const f of [...scss, ...html, ...ts]) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/#[0-9a-fA-F]{3,8}\b/.test(line)) fail(`raw hex: ${f}:${i + 1}: ${line.trim()}`);
  });
}

// 2. Ladder radii outside styles.scss; photos-legacy is out of scope this run.
for (const f of scss.filter(p => !p.includes('photos-legacy'))) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/border-radius:\s*([^;]+);/);
    if (!m) return;
    for (const part of m[1].trim().split(/\s+/)) {
      // A token may carry a CSS suffix (!important); it is still ladder-conformant.
      if (part === '0' || part === '!important' || part.startsWith('var(--radius-')) continue;
      fail(`non-ladder radius "${part}": ${f}:${i + 1}`);
    }
  });
}

// 3. Role-conditional controls banned in user-facing templates. Exceptions:
//    admin* components (the admin portal), photos-legacy (decision 3, out of
//    scope this run), user-view (informational role badges). user-edit and
//    contact-edit now compute their role flags in TypeScript, not templates.
const templateExceptions = /\/(admin[^/]*|photos-legacy|user-view)\//;
for (const f of html.filter(p => p.startsWith('src/app/components/') && !templateExceptions.test(p))) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/\b(?!formUser\b)\w+\??\.roles\b/.test(line)) {
      fail(`role-conditional read in user-facing template: ${f}:${i + 1}: ${line.trim()}`);
    }
  });
}

// 4. --radius-input is deleted.
for (const f of [...scss, ...html, 'src/styles.scss'].concat(
  execSync("find src e2e -name '*.ts'").toString().trim().split('\n').filter(Boolean),
)) {
  try {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('--radius-input')) fail(`--radius-input usage: ${f}:${i + 1}`);
    });
  } catch { /* file list overlap */ }
}

// 5. Rules re-audit: every .write is admin/super-gated, author-scoped
//    (messages), self-create (users/$uid), or False (admin-SDK-only).
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8')).rules;
(function audit(node, path) {
  for (const [key, value] of Object.entries(node)) {
    if (key === '.write') {
      const rule = String(value);
      const p = path || '/';
      const ok =
        rule.includes('roles/admin') || rule.includes('roles/super') ||
        (p.startsWith('/messages') && rule.includes('authorId')) ||
        (p.startsWith('/users') && rule.includes('auth.uid')) ||
        rule === 'false';
      if (!ok) fail(`rules audit: member-writable .write at ${p}: ${rule.slice(0, 80)}`);
    } else if (value && typeof value === 'object') {
      audit(value, `${path}/${key}`);
    }
  }
})(rules, '');

// 6. Dark parity: every mat.*-overrides include in the light html block has a
// counterpart in the dark block (D-20261030-15).
const styles = readFileSync('src/styles.scss', 'utf8');
// Brace-match the html block that carries all-component-themes (the light
// overrides block) and the dark block.
let lightOverrides = '';
{
  const m = /html \{[^{}]*@include mat\.all-component-themes/.exec(styles);
  if (m) {
    let depth = 0, i = m.index + 4; // after "html"
    for (; i < styles.length; i++) {
      if (styles[i] === '{') depth++;
      if (styles[i] === '}') { depth--; if (depth === 0) break; }
    }
    lightOverrides = styles.slice(m.index, i);
  }
}
let dark = '';
for (const m of styles.matchAll(/html\[data-theme="dark"\] \{/g)) {
  let depth = 0, i = m.index + 20;
  for (; i < styles.length; i++) {
    if (styles[i] === '{') depth++;
    if (styles[i] === '}') { depth--; if (depth === 0) break; }
  }
  dark += styles.slice(m.index, i);
}
if (!lightOverrides || !dark) fail('dark parity: could not locate html override blocks in styles.scss');
const lightNames = new Set([...lightOverrides.matchAll(/mat\.([a-z-]+)-overrides/g)].map(m => m[1]));
const darkNames = new Set([...dark.matchAll(/mat\.([a-z-]+)-overrides/g)].map(m => m[1]));
for (const name of lightNames) {
  if (!darkNames.has(name)) fail(`dark parity: mat.${name}-overrides missing in dark block`);
}

if (failures.length) {
  console.error(`theme:check FAILED (${failures.length} violation(s))`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('theme:check PASS — hex, radii, role gates, rules, dark parity all clean');
