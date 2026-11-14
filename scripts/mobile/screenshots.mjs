// Standalone Playwright capture harness (not an e2e spec). Run it from inside
// the Firebase emulator wrapper so http://localhost:5000 is serving the app:
//   node scripts/mobile/screenshots.mjs --engine=chromium --routes=user
import { chromium, webkit, firefox } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { login } from '../../e2e/helpers/auth.ts';
import {
  ARTIFACT_ROOT,
  BASE_URL,
  DISABLE_ANIMATIONS,
  ROUTE_SETS,
  applyTheme,
  engineContextOptions,
  parseArgs,
  prepareRoutePage,
  resolveEntries,
  resolveViewports,
  scrollThroughPage,
  themeInitScript,
} from './routes.mjs';

const USAGE = `Usage: node scripts/mobile/screenshots.mjs --engine=<chromium|webkit|firefox> [options]

  --engine=...            required browser engine
  --routes=user|chat|admin|smoke|all   route set (default user)
  --viewports=iphone,se1  comma list (default all)
  --only=<substring>      filter routes by slug substring
  --theme=light|dark      set data-theme + theme storage key (default light)
  --fullpage-timeout=15000  full-page screenshot timeout in ms
  --chat-on               assume the chat flag is already enabled (no toggling)
  --help                  show this usage`;

const ENGINES = { chromium, webkit, firefox };
const VIEWPORT_DIRS = new Set();
const CAPTURE_KEY = (viewport, slug) => `${viewport}|${slug}`;

function numberArg(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function captureSet(page, { engine, viewport, role, route, timeout, theme }) {
  const dir = path.join(ARTIFACT_ROOT, engine, viewport);
  if (!VIEWPORT_DIRS.has(dir)) {
    await fs.mkdir(dir, { recursive: true });
    VIEWPORT_DIRS.add(dir);
  }
  const full = path.join(dir, `${route.slug}-full.png`);
  const fold = path.join(dir, `${route.slug}-fold.png`);
  const base = { engine, viewport, role, path: route.path, slug: route.slug, full, fold };

  try {
    const readiness = await prepareRoutePage(page, route, { tolerateReadyTimeout: true });
    await applyTheme(page, theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addStyleTag({ content: DISABLE_ANIMATIONS });
    await applyTheme(page, theme);
    await scrollThroughPage(page);

    let captureLimited = false;
    let reason = '';
    try {
      await page.screenshot({ path: full, fullPage: true, timeout });
    } catch (error) {
      captureLimited = true;
      reason = String(error?.message ?? error).split('\n')[0].slice(0, 300);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: full, fullPage: false });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: fold, fullPage: false });

    return { ...base, readyTimedOut: readiness.readyTimedOut, readySelector: readiness.readySelector, captureLimited, reason, ok: true, error: null };
  } catch (error) {
    const message = String(error?.message ?? error).split('\n')[0].slice(0, 300);
    console.error(`FAILED ${engine}/${viewport} ${role} ${route.slug}: ${message}`);
    return { ...base, captureLimited: false, reason: message, ok: false, error: message };
  }
}

async function loadCaptures(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCaptures(file, records) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(records, null, 2));
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
  const only = args.only ? String(args.only) : null;
  const timeout = numberArg(args['fullpage-timeout'], 15000);
  const viewportNames = resolveViewports(args.viewports);
  const entries = resolveEntries(routeSet, only);

  if (args['chat-on']) {
    console.error('--chat-on: assuming the chat feature flag is already enabled');
  }

  const roles = new Map();
  for (const entry of entries) {
    if (!roles.has(entry.role)) roles.set(entry.role, []);
    roles.get(entry.role).push(entry);
  }

  const browser = await ENGINES[engineName].launch({ headless: true });
  const capturesFile = path.join(ARTIFACT_ROOT, engineName, `captures-${routeSet}.json`);
  const records = await loadCaptures(capturesFile);
  const index = new Map(records.map((r) => [CAPTURE_KEY(r.viewport, r.slug), r]));
  const storageStates = new Map();
  let captured = 0;
  let limited = 0;
  let failed = 0;

  try {
    for (const [role, roleEntries] of roles) {
      if (role !== 'public') {
        const loginContext = await browser.newContext({
          ...engineContextOptions(engineName, 'iphone'),
          baseURL: BASE_URL,
        });
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
          const record = await captureSet(page, {
            engine: engineName,
            viewport,
            role,
            route,
            timeout,
            theme,
          });
          index.set(CAPTURE_KEY(viewport, route.slug), record);
          await saveCaptures(capturesFile, [...index.values()]);
          if (!record.ok) {
            failed += 1;
            console.log(`[${engineName}/${viewport}] ${route.slug} FAILED`);
          } else if (record.captureLimited) {
            limited += 1;
            captured += 1;
            console.log(`[${engineName}/${viewport}] ${route.slug} limited: ${record.reason}`);
          } else {
            captured += 1;
            console.log(`[${engineName}/${viewport}] ${route.slug} full+fold`);
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${engineName} ${routeSet}: captured ${captured}, limited ${limited}, failed ${failed}`);
  return captured === 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
