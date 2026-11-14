// Standalone mobile layout audit (not an e2e spec). Run it from inside the
// Firebase emulator wrapper so http://localhost:5000 is serving the app:
//   node scripts/mobile/audit.mjs --engine=chromium --routes=user
// A finding is data: the process exits 0 unless the harness itself crashes.
import { chromium, webkit, firefox } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { login } from '../../e2e/helpers/auth.ts';
import {
  ARTIFACT_ROOT, BASE_URL, applyTheme, engineContextOptions, parseArgs,
  prepareRoutePage, resolveEntries, resolveViewports, themeInitScript,
} from './routes.mjs';

const USAGE = `Usage: node scripts/mobile/audit.mjs --engine=<chromium|webkit|firefox> [options]

  --engine=...            required browser engine
  --routes=user|chat|admin|smoke|all   route set (default user)
  --viewports=iphone,se1  comma list (default all)
  --only=<substring>      filter routes by slug substring
  --theme=light|dark      set data-theme + theme storage key (default light)
  --text-zoom=200         re-run overflow checks after doubling text size
  --chat-on               assume the chat flag is already enabled (no toggling)
  --help                  show this usage`;

const ENGINES = { chromium, webkit, firefox };
// Runs inside the page: Playwright serialises it, so it must stay self-contained.
const PAGE_AUDIT = (zoom) => {
  const MAX = 8;
  const CONTROL = 'a, button, [role=button], [role=switch], [role=tab], input, select, textarea';
  const PRIMARY = 'mat-flat-button, mat-raised-button, mat-fab, mat-icon-button, button.primary, [data-primary], .btn-primary, .cta, .mdc-button, .mdc-icon-button, input[type="submit"]';
  const cs = (el) => getComputedStyle(el);
  const box = (el) => el.getBoundingClientRect();

  const visible = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const style = cs(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    const r = box(el);
    return r.width > 0 && r.height > 0;
  };
  const cssPath = (el) => {
    let out = el.tagName.toLowerCase();
    if (el.id) out += '#' + el.id;
    for (const cls of (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3)) out += '.' + cls;
    return out.slice(0, 120);
  };
  const depthOf = (el) => {
    let depth = 0;
    for (let node = el.parentElement; node; node = node.parentElement) depth += 1;
    return depth;
  };
  const offend = (el, reason, kind, target = box(el)) => {
    const r = target;
    const out = {
      selector: cssPath(el),
      rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      reason,
      depth: depthOf(el),
    };
    if (kind) out.kind = kind;
    return out;
  };
  // Visually hidden even though it occupies layout (sr-only, clipped, transparent).
  const visuallyHidden = (el) => {
    const r = box(el);
    if (r.width <= 1 || r.height <= 1) return true;
    const style = cs(el);
    if (style.clipPath && style.clipPath !== 'none') {
      const m = /inset\(([^)]*)\)/.exec(style.clipPath);
      if (m && /(?:^|\s)(?:50|100)%/.test(m[1])) return true;
    }
    if (style.clip && /rect\(\s*0(?:px)?[\s,]+0(?:px)?[\s,]+0(?:px)?[\s,]+0(?:px)?\s*\)/.test(style.clip)) return true;
    if (/(?:^|\s)(?:visually-hidden|sr-only|cdk-visually-hidden)(?:\s|$)/.test(el.getAttribute('class') || '')) return true;
    let node = el;
    for (let i = 0; node && i < 4; i += 1, node = node.parentElement) {
      if (parseFloat(cs(node).opacity) < 0.05) return true;
    }
    return false;
  };
  const ancestorHasLabel = (el) => {
    let node = el;
    for (let i = 0; node && i <= 3; i += 1, node = node.parentElement) {
      if (node.hasAttribute('aria-label') || node.hasAttribute('title')) return true;
    }
    return false;
  };
  // Overflow is already contained if a scroll/hidden/clip ancestor clips it.
  const overflowContained = (el) => {
    for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      // body/.app-container are the page scroll boundary, not a design containment
      // box: content clipped there is unreachable, which is the finding.
      if (node === document.body || node.classList.contains('app-container')) continue;
      const x = cs(node).overflowX;
      if (x === 'auto' || x === 'scroll') return true;
      if (x === 'hidden' || x === 'clip') {
        const r = box(node);
        if (r.left >= -1 && r.right <= window.innerWidth + 1) return true;
      }
    }
    return false;
  };
  // Deepest offenders first, capped; the internal depth key is stripped.
  const finish = (list) => list.sort((a, b) => b.depth - a.depth).slice(0, MAX).map(({ depth, ...rest }) => rest);
  const overflowFrom = (start) => {
    for (let node = start; node; node = node.parentElement) {
      const x = cs(node).overflowX;
      if (x === 'auto' || x === 'scroll') return true;
    }
    return false;
  };
  const make = (id, name, severity, result) => ({ id, name, severity, status: result.status, detail: result.detail, offenders: result.offenders || [] });
  const containerCheck = () => {
    const c = document.querySelector('.app-container');
    if (!c) return { status: 'pass', detail: 'no .app-container' };
    // A classic vertical scrollbar shrinks clientWidth without shrinking the
    // layout viewport, so content that reaches the viewport edge is not
    // horizontal overflow. Only the surplus past the scrollbar gutter counts.
    const style = getComputedStyle(c);
    const chromeW =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
      parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const gutter = Math.max(0, c.offsetWidth - chromeW - c.clientWidth);
    if (c.scrollWidth <= c.clientWidth + gutter) {
      return {
        status: 'pass',
        detail: `scrollWidth ${c.scrollWidth} <= clientWidth ${c.clientWidth} + gutter ${gutter}`,
      };
    }
    return { status: 'fail', detail: `scrollWidth ${c.scrollWidth} > clientWidth ${c.clientWidth}`, offenders: finish([offend(c, 'app-container wider than its client box')]) };
  };
  const documentCheck = () => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= window.innerWidth + 1) return { status: 'pass', detail: `scrollWidth ${doc.scrollWidth} <= innerWidth ${window.innerWidth}` };
    return { status: 'fail', detail: `scrollWidth ${doc.scrollWidth} > innerWidth ${window.innerWidth}`, offenders: finish([offend(doc, 'document wider than the viewport')]) };
  };

  const checks = [];
  const add = (id, name, severity, result) => checks.push(make(id, name, severity, result));
  add('app-container-overflow', 'app container overflow', 'high', containerCheck());
  add('document-overflow', 'document overflow', 'high', documentCheck());
  // 3. element overflow
  const elementOffenders = [];
  for (const el of document.querySelectorAll('*')) {
    if (el === document.documentElement || el === document.body || el.closest('defs') || !visible(el)) continue;
    if (visuallyHidden(el) || overflowContained(el)) continue;
    const r = box(el);
    if (r.right <= window.innerWidth + 1) continue;
    elementOffenders.push(offend(el, `right ${Math.round(r.right)} > viewport ${window.innerWidth}`));
  }
  add('element-overflow', 'element overflow', 'high', {
    status: elementOffenders.length ? 'fail' : 'pass',
    detail: elementOffenders.length ? `${elementOffenders.length} elements past the viewport` : 'no clipped elements',
    offenders: finish(elementOffenders),
  });
  // 4. hit targets
  const small = [];
  const cramped = [];
  // Primary means a button-class action. Inline text controls (row links,
  // chips, clickable names) fall under the 24px inline floor instead.
  const isPrimary = (el) => el.matches(PRIMARY);
  const controlVisible = (el) => {
    if (!visible(el)) return false;
    if (el.getAttribute('aria-hidden') === 'true' || el.disabled) return false;
    if (el.tagName === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'hidden') return false;
    return true;
  };
  // Material renders a bare inner input inside the form-field label click target,
  // and a slide toggle's switch button inside a much larger host.
  const touchBox = (el) => {
    if (el.matches('[role="switch"]')) {
      const host = el.closest('mat-slide-toggle, .mat-mdc-slide-toggle');
      if (host) return box(host);
    }
    if (!el.matches('input, select, textarea')) return box(el);
    const wrapper = el.closest('mat-form-field, .mat-mdc-form-field, label, .field');
    return wrapper ? box(wrapper) : box(el);
  };
  for (const el of document.querySelectorAll(CONTROL)) {
    if (!controlVisible(el)) continue;
    const target = touchBox(el);
    const w = Math.round(target.width);
    const h = Math.round(target.height);
    if (target.width < 24 || target.height < 24) small.push(offend(el, `${w}x${h} under 24px`, 'under-24', target));
    else if ((target.width < 44 || target.height < 44) && isPrimary(el)) cramped.push(offend(el, `${w}x${h} under 44px`, 'primary-under-44', target));
  }
  // A 40px Material icon button clears the 24px inline floor and is the
  // platform default; the 44px guideline is tracked as a low note, not a fail.
  add('hit-targets', 'hit targets', small.length ? 'high' : 'low', {
    status: small.length ? 'fail' : cramped.length ? 'warn' : 'pass',
    detail: small.length
      ? `${small.length} controls under 24x24`
      : cramped.length ? `${cramped.length} primary controls under 44px` : 'all visible controls meet the 24px floor',
    offenders: finish([...small, ...cramped]),
  });
  // 5. text clip
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || visuallyHidden(el) || ancestorHasLabel(el)) continue;
    // Inline boxes report clientWidth 0 and scrollWidth as the text run, which
    // reads as clipped on every engine. Text clipping only applies to boxes.
    if (cs(el).display === 'inline') continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!text || el.scrollWidth <= el.clientWidth + 2) continue;
    if (cs(el).textOverflow === 'ellipsis' || el.hasAttribute('title') || el.hasAttribute('aria-label')) continue;
    if ([...el.querySelectorAll('*')].some((c) => c.textContent.trim() === text && c.scrollWidth <= c.clientWidth + 2)) continue;
    clipped.push(offend(el, 'text clipped without ellipsis or accessible label'));
  }
  add('text-clip', 'text clipping', 'medium', {
    status: clipped.length ? 'warn' : 'pass',
    detail: clipped.length ? `${clipped.length} elements clip text` : 'no clipped text',
    offenders: finish(clipped),
  });
  // 6. chrome coverage
  const chrome = [...document.querySelectorAll('nav, header, footer, .site-footer, .mat-toolbar, [class*=sticky]')].filter((el) => {
    const position = cs(el).position;
    return (position === 'fixed' || position === 'sticky') && visible(el);
  });
  const covered = [];
  if (chrome.length) {
    const root = document.querySelector('main, .app-container') || document.body;
    const textEls = [...root.querySelectorAll('*')].filter((el) => visible(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    textEls.sort((a, b) => box(a).bottom - box(b).bottom);
    const last = textEls[textEls.length - 1];
    if (last) {
      last.scrollIntoView({ block: 'end' });
      const lr = box(last);
      for (const bar of chrome) {
        if (bar.contains(last)) continue;
        const br = box(bar);
        const overlapY = Math.min(lr.bottom, br.bottom) - Math.max(lr.top, br.top);
        const overlapX = Math.min(lr.right, br.right) - Math.max(lr.left, br.left);
        if (overlapY > 4 && overlapX > 0) {
          covered.push(offend(last, `covered by ${cssPath(bar)}`));
          break;
        }
      }
    }
  }
  add('chrome-coverage', 'fixed chrome coverage', 'high', {
    status: covered.length ? 'fail' : 'pass',
    detail: chrome.length ? (covered.length ? 'bottom content runs under fixed chrome' : 'no overlap') : 'no fixed or sticky chrome',
    offenders: finish(covered),
  });
  // 7. input font size (iOS zooms on focus when text-entry font is under 16px)
  const TEXT_TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number']);
  const tinyInputs = [];
  for (const el of document.querySelectorAll('input, textarea')) {
    if (el.tagName === 'INPUT' && !TEXT_TYPES.has((el.getAttribute('type') || 'text').toLowerCase())) continue;
    if (!visible(el) || el.disabled || el.readOnly) continue;
    const size = parseFloat(cs(el).fontSize) || 0;
    if (size < 16) tinyInputs.push(offend(el, `font-size ${size}px under 16px`));
  }
  add('input-font-size', 'input font size', 'high', {
    status: tinyInputs.length ? 'fail' : 'pass',
    detail: tinyInputs.length ? `${tinyInputs.length} inputs under 16px` : 'inputs at or above 16px',
    offenders: finish(tinyInputs),
  });
  // 8. dialog fit
  const dialogs = [...document.querySelectorAll('[role=dialog], .mat-mdc-dialog-container')].filter(visible);
  const dialogProblems = [];
  for (const dialog of dialogs) {
    const r = box(dialog);
    if (r.width > window.innerWidth || r.height > window.innerHeight || r.left < -1 || r.top < -1) {
      dialogProblems.push(offend(dialog, `dialog ${Math.round(r.width)}x${Math.round(r.height)} exceeds viewport`));
    }
    for (const row of [...dialog.querySelectorAll('[mat-dialog-actions], .mat-mdc-dialog-actions')].filter(visible)) {
      const ar = box(row);
      if (ar.bottom > window.innerHeight + 1 || ar.top < -1 || ar.right > window.innerWidth + 1) dialogProblems.push(offend(row, 'dialog actions not fully visible'));
    }
  }
  add('dialog-fit', 'dialog fit', 'high', {
    status: dialogProblems.length ? 'fail' : 'pass',
    detail: dialogs.length ? (dialogProblems.length ? `${dialogProblems.length} dialog fit problems` : 'dialog fits') : 'no dialog open',
    offenders: finish(dialogProblems),
  });
  // 9. table scroll
  const trappedTables = [];
  for (const table of document.querySelectorAll('table')) {
    if (!visible(table) || table.scrollWidth <= table.clientWidth || overflowFrom(table.parentElement)) continue;
    trappedTables.push(offend(table, 'table overflows without a scroll container'));
  }
  add('table-scroll', 'table scroll container', 'high', {
    status: trappedTables.length ? 'fail' : 'pass',
    detail: trappedTables.length ? `${trappedTables.length} tables overflow` : 'tables fit or scroll',
    offenders: finish(trappedTables),
  });
  // 10. image fit: contain/cover letterbox intentionally, so only flag fill distortion
  const badImages = [];
  for (const img of document.querySelectorAll('img')) {
    if (!visible(img)) continue;
    const fit = cs(img).objectFit;
    if (fit === 'contain' || fit === 'cover') continue;
    const r = box(img);
    if (!img.naturalWidth || !img.naturalHeight || !r.height) continue;
    const natural = img.naturalWidth / img.naturalHeight;
    if (Math.abs(r.width / r.height - natural) / natural > 0.03) badImages.push(offend(img, 'rendered ratio differs from natural ratio by over 3%'));
  }
  add('image-fit', 'image fit', 'medium', {
    status: badImages.length ? 'warn' : 'pass',
    detail: badImages.length ? `${badImages.length} images distort` : 'images fit their box',
    offenders: finish(badImages),
  });
  // 11. text zoom, only when requested; pre-existing overflow is not a regression
  if (zoom) {
    const beforeContainer = containerCheck();
    const beforeDoc = documentCheck();
    const beforeWide = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (visible(el) && box(el).right > window.innerWidth + 1) beforeWide.add(cssPath(el));
    }
    let zoomed = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (zoomed >= 3000) break;
      if (!visible(el) || el.matches('input, textarea, select, script, style, option')) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const size = parseFloat(cs(el).fontSize) || 16;
      el.style.fontSize = `${size * (zoom / 100)}px`;
      zoomed += 1;
    }
    const afterContainer = containerCheck();
    const afterDoc = documentCheck();
    const newWide = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || visuallyHidden(el)) continue;
      if (box(el).right <= window.innerWidth + 1) continue;
      if (beforeWide.has(cssPath(el))) continue;
      newWide.push(offend(el, 'overflows the viewport only after text zoom'));
    }
    const containerNew = beforeContainer.status !== 'fail' && afterContainer.status === 'fail';
    const docNew = beforeDoc.status !== 'fail' && afterDoc.status === 'fail';
    const failed = containerNew || docNew || newWide.length > 0;
    add('text-zoom', `text zoom ${zoom}%`, 'high', {
      status: failed ? 'fail' : 'pass',
      detail: `zoomed ${zoomed} elements; ${newWide.length} new overflowing elements`,
      offenders: finish([
        ...(containerNew ? afterContainer.offenders || [] : []),
        ...(docNew ? afterDoc.offenders || [] : []),
        ...newWide,
      ]),
    });
  }

  return checks;
};

function parseZoom(value) {
  if (value === undefined || value === true) return null;
  const zoom = Number(value);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : null;
}

async function auditRoute(page, route, meta) {
  const base = { engine: meta.engine, viewport: meta.viewport, role: meta.role, slug: route.slug, path: route.path };
  if (route.auditExempt === 'print') {
    return { ...base, status: 'print-exempt', failed: [], warned: [], checks: [], textZoom: meta.zoom || null };
  }
  try {
    await prepareRoutePage(page, route);
    await applyTheme(page, meta.theme);
    const checks = await page.evaluate(PAGE_AUDIT, meta.zoom);
    const failed = checks.filter((c) => c.status === 'fail').map((c) => c.id);
    const warned = checks.filter((c) => c.status === 'warn').map((c) => c.id);
    return { ...base, status: failed.length ? 'fail' : warned.length ? 'warn' : 'pass', failed, warned, checks, textZoom: meta.zoom || null };
  } catch (error) {
    const detail = String(error?.message ?? error).split('\n')[0].slice(0, 300);
    if (error?.code === 'READY_TIMEOUT') {
      console.error(`BLOCKED ${meta.engine}/${meta.viewport} ${route.slug}: ${detail}`);
      return {
        ...base,
        status: 'blocked',
        failed: [],
        warned: [],
        checks: [{ id: 'route-load', name: 'route load', severity: 'high', status: 'blocked', detail, offenders: [] }],
        textZoom: meta.zoom || null,
      };
    }
    console.error(`FAILED ${meta.engine}/${meta.viewport} ${route.slug}: ${detail}`);
    return {
      ...base,
      status: 'fail',
      failed: ['route-load'],
      warned: [],
      checks: [{ id: 'route-load', name: 'route load', severity: 'high', status: 'fail', detail, offenders: [] }],
      textZoom: meta.zoom || null,
    };
  }
}

async function loadJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

function renderMarkdown(records) {
  const lines = ['| route | viewport | status | failed checks | warned checks |', '| --- | --- | --- | --- | --- |'];
  const totals = { pass: 0, fail: 0, warn: 0, blocked: 0, 'print-exempt': 0 };
  for (const record of records) {
    totals[record.status] += 1;
    lines.push(`| ${record.slug} | ${record.viewport} | ${record.status} | ${record.failed.join(', ')} | ${record.warned.join(', ')} |`);
  }
  lines.push('', `Totals: pass ${totals.pass}, fail ${totals.fail}, warn ${totals.warn}, blocked ${totals.blocked}, print-exempt ${totals['print-exempt']}`);
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const engineName = args.engine;
  if (!engineName || !ENGINES[engineName]) {
    console.error(USAGE);
    return 2;
  }
  const routeSet = args.routes || 'user';
  const theme = args.theme === 'dark' ? 'dark' : 'light';
  const zoom = parseZoom(args['text-zoom']);
  const only = args.only ? String(args.only) : null;
  const viewportNames = resolveViewports(args.viewports);
  const entries = resolveEntries(routeSet, only);
  if (args['chat-on']) console.error('--chat-on: assuming the chat feature flag is already enabled');

  const roles = new Map();
  for (const entry of entries) {
    if (!roles.has(entry.role)) roles.set(entry.role, []);
    roles.get(entry.role).push(entry);
  }

  const zoomSuffix = zoom ? `-zoom${zoom}` : '';
  const jsonFile = path.join(ARTIFACT_ROOT, engineName, `audit-${routeSet}${zoomSuffix}.json`);
  const mdFile = path.join(ARTIFACT_ROOT, engineName, `audit-${routeSet}${zoomSuffix}.md`);
  const resultsFile = path.join(ARTIFACT_ROOT, 'results.json');
  const existing = await loadJson(jsonFile, []);
  const merged = new Map(existing.map((record) => [`${record.viewport}|${record.slug}`, record]));
  const totals = { pass: 0, fail: 0, warn: 0, blocked: 0, 'print-exempt': 0 };

  const browser = await ENGINES[engineName].launch({ headless: true });
  const storageStates = new Map();
  try {
    for (const [role, roleEntries] of roles) {
      if (role !== 'public') {
        const loginContext = await browser.newContext({ ...engineContextOptions(engineName, 'iphone'), baseURL: BASE_URL });
        await themeInitScript(await loginContext.newPage(), theme);
        const loginPage = loginContext.pages()[0] ?? (await loginContext.newPage());
        await login(loginPage, role);
        storageStates.set(role, await loginContext.storageState({ indexedDB: true }));
        await loginContext.close();
      }
      for (const viewport of viewportNames) {
        const context = await browser.newContext({
          ...engineContextOptions(engineName, viewport),
          baseURL: BASE_URL,
          ...(storageStates.get(role) ? { storageState: storageStates.get(role) } : {}),
        });
        const page = await context.newPage();
        await themeInitScript(page, theme);
        for (const route of roleEntries) {
          const record = await auditRoute(page, route, { engine: engineName, viewport, role, theme, zoom });
          merged.set(`${viewport}|${route.slug}`, record);
          totals[record.status] += 1;
          console.log(`[${engineName}/${viewport}] ${route.slug} ${record.status.toUpperCase()}`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const allRecords = [...merged.values()];
  await writeAtomic(jsonFile, allRecords);
  await fs.writeFile(mdFile, renderMarkdown(allRecords));

  const results = await loadJson(resultsFile, { startedAt: new Date().toISOString(), engines: {} });
  results.startedAt = results.startedAt || new Date().toISOString();
  results.engines = results.engines || {};
  results.engines[engineName] = results.engines[engineName] || {};
  results.engines[engineName][routeSet] = results.engines[engineName][routeSet] || {};
  for (const record of allRecords) results.engines[engineName][routeSet][`${record.viewport}|${record.slug}`] = record;
  await writeAtomic(resultsFile, results);

  console.log(`\n${engineName} ${routeSet}${zoomSuffix} totals: pass ${totals.pass}, fail ${totals.fail}, warn ${totals.warn}, blocked ${totals.blocked}, print-exempt ${totals['print-exempt']}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
