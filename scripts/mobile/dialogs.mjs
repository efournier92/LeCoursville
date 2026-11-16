// Standalone dialog fit/operability probe (not an e2e spec). Run it from inside
// the Firebase emulator wrapper so http://localhost:5000 is serving the app:
//   node scripts/mobile/dialogs.mjs --engine=chromium
// A finding is data: the process exits 0 unless the harness itself crashes.
import { chromium, webkit, firefox } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { login } from '../../e2e/helpers/auth.ts';
import {
  ARTIFACT_ROOT, BASE_URL, applyTheme, engineContextOptions, parseArgs,
  resolveViewports, themeInitScript,
} from './routes.mjs';

const USAGE = `Usage: node scripts/mobile/dialogs.mjs --engine=<chromium|webkit|firefox> [options]

  --engine=...            required browser engine
  --viewports=iphone      comma list (default iphone)
  --only=<substring>      filter scenario ids by substring
  --theme=light|dark      set data-theme + theme storage key (default light)
  --chat-on               assume the chat flag is already enabled (no toggling)
  --help                  show this usage`;

const ENGINES = { chromium, webkit, firefox };
const DIALOG_SELECTORS = ['[role=dialog]', 'mat-dialog-container', 'app-person-detail-modal .modal-content', 'app-day-agenda section.day-agenda'];
const ACTION_SELECTORS = '[mat-dialog-actions], .mat-mdc-dialog-actions, .dialog-actions';
const CLOSE_SELECTORS = '[data-testid="draft-close"], .close-button, [aria-label="Close" i], .pswp__button--close';

// Runs in the page; Playwright serialises it, so it must stay self-contained.
const DIALOG_METRICS = ({ selectors, actionSelectors, closeSelectors }) => {
  const cs = (el) => getComputedStyle(el);
  const box = (el) => el.getBoundingClientRect();
  const visible = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const style = cs(el), r = box(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && r.width > 0 && r.height > 0;
  };
  const cssPath = (el) => {
    let out = el.tagName.toLowerCase();
    if (el.id) out += '#' + el.id;
    for (const cls of (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3)) out += '.' + cls;
    return out.slice(0, 120);
  };
  const rounded = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
  // DOM order is the closest proxy for paint order among stacked surfaces.
  const matches = document.querySelectorAll(selectors.join(','));
  const dialog = [...matches].filter(visible).pop() || null;
  if (!dialog) return null;
  const r = box(dialog);
  const close = [...dialog.querySelectorAll(closeSelectors)].filter(visible)[0] || null;
  const actionRow = [...dialog.querySelectorAll(actionSelectors)].filter(visible)[0] || null;
  const container = document.querySelector('.app-container');
  let containerOverflow = { status: 'pass', detail: 'no .app-container' };
  if (container) {
    const style = getComputedStyle(container);
    const chromeW = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const gutter = Math.max(0, container.offsetWidth - chromeW - container.clientWidth);
    containerOverflow = container.scrollWidth <= container.clientWidth + gutter
      ? { status: 'pass', detail: `scrollWidth ${container.scrollWidth} <= clientWidth ${container.clientWidth} + gutter ${gutter}` }
      : { status: 'fail', detail: `scrollWidth ${container.scrollWidth} > clientWidth ${container.clientWidth} + gutter ${gutter}` };
  }
  const actions = actionRow
    ? (() => {
        const ar = box(actionRow);
        const inside = ar.top >= -1 && ar.left >= -1 && ar.bottom <= window.innerHeight + 1 && ar.right <= window.innerWidth + 1;
        return { selector: cssPath(actionRow), rect: rounded(ar), inside };
      })()
    : 'n/a';
  const closeInfo = close
    ? { selector: cssPath(close), width: Math.round(box(close).width), height: Math.round(box(close).height), ok: box(close).width >= 24 && box(close).height >= 24 }
    : 'n/a';
  return {
    selector: cssPath(dialog),
    rect: rounded(r),
    widthFits: r.width <= window.innerWidth,
    heightFits: r.height <= window.innerHeight + 1,
    actions,
    close: closeInfo,
    containerOverflow,
    internalScroll: { scrollHeight: dialog.scrollHeight, clientHeight: dialog.clientHeight, overflows: dialog.scrollHeight > dialog.clientHeight + 1 },
  };
};

async function waitForDialog(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}
const SCENARIOS = [
  {
    id: 'contact-person-modal',
    role: 'user',
    path: '/contacts',
    async open(page) {
      const name = page.locator('app-contact-card .clickable-name').first();
      await name.waitFor({ state: 'visible', timeout: 15000 });
      await name.click();
      await waitForDialog(page, 'app-person-detail-modal .modal-content', 8000);
    },
    async close(page) {
      await page.locator('app-person-detail-modal .close-button').first().click();
      await page.locator('app-person-detail-modal').waitFor({ state: 'hidden' });
    },
  },
  {
    id: 'signout-confirm',
    role: 'user',
    path: '/account',
    async open(page) {
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await waitForDialog(page, 'mat-dialog-container, [role=dialog]');
    },
    async close(page) {
      await page.getByRole('button', { name: 'No' }).click();
      await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
    },
  },
  {
    id: 'calendar-day-agenda',
    role: 'user',
    path: '/calendar?year=2026&month=11',
    async open(page) {
      await page.locator('.cal-day-control[aria-label*="November 14"]').first().click();
      await page.locator('app-day-agenda section.day-agenda').waitFor({ state: 'visible' });
    },
  },
  {
    id: 'chat-new-message',
    role: 'user',
    path: '/chat',
    async open(page) {
      await page.getByRole('button', { name: 'New Message' }).first().click();
      try {
        await waitForDialog(page, 'mat-dialog-container');
      } catch {
        if (await page.locator('app-chat-edit').count()) {
          throw new Error('New Message opens an inline editor (app-chat-edit), no dialog');
        }
        throw new Error('New Message did not open a dialog');
      }
    },
    async close(page) {
      await page.keyboard.press('Escape');
      await page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 2000 });
    },
  },
  {
    id: 'photo-lightbox',
    role: 'user',
    path: '/photos/album-1',
    async open(page) {
      const tiles = page.locator('.photo-tile');
      await tiles.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
        throw new Error('no rendered .photo-tile in the album');
      });
      await tiles.first().click();
      await waitForDialog(page, '.pswp[role=dialog]', 8000);
    },
    async close(page) {
      await page.keyboard.press('Escape');
      await page.locator('.pswp').waitFor({ state: 'hidden' });
    },
  },
  {
    id: 'admin-song-draft',
    role: 'admin',
    path: '/admin/songs',
    async open(page) {
      await page.getByTestId('admin-add-song').click();
      await page.getByTestId('admin-paste-input').fill('Title: Dialog Probe Song\n\nAmazing grace how sweet the sound');
      await page.getByTestId('admin-parse-button').click();
      await waitForDialog(page, '[data-testid="song-draft-dialog"]', 8000);
    },
    async close(page) {
      await page.getByTestId('draft-cancel').click();
      await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
    },
  },
];

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
  const lines = ['| id | role | status | dialog | actions | close | container | internal scroll |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const record of records) {
    const m = record.dialog;
    const dims = m ? `${m.rect.width}x${m.rect.height}` : '—';
    const actions = m ? (m.actions === 'n/a' ? 'n/a' : m.actions.inside ? 'inside' : 'clipped') : '—';
    const close = m ? (m.close === 'n/a' ? 'n/a' : `${m.close.width}x${m.close.height}${m.close.ok ? '' : ' (small)'}`) : '—';
    const container = m ? m.containerOverflow.status : '—';
    const scroll = m ? (m.internalScroll.overflows ? 'yes' : 'no') : '—';
    lines.push(`| ${record.id} | ${record.role} | ${record.status} | ${dims} | ${actions} | ${close} | ${container} | ${scroll} |`);
  }
  return lines.join('\n') + '\n';
}
async function runScenario(page, scenario, meta) {
  const base = { id: scenario.id, role: scenario.role, path: scenario.path, engine: meta.engine, viewport: meta.viewport };
  try {
    await page.goto(BASE_URL + scenario.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await scenario.open(page);
    const dialog = await page.evaluate(DIALOG_METRICS, { selectors: DIALOG_SELECTORS, actionSelectors: ACTION_SELECTORS, closeSelectors: CLOSE_SELECTORS });
    if (!dialog) {
      return { ...base, status: 'skipped', reason: 'no matching visible dialog element', dialog: null };
    }
    const failed = [];
    if (!dialog.widthFits) failed.push('width');
    if (!dialog.heightFits) failed.push('height');
    if (dialog.actions !== 'n/a' && !dialog.actions.inside) failed.push('actions');
    if (dialog.close !== 'n/a' && !dialog.close.ok) failed.push('close-target');
    if (dialog.containerOverflow.status === 'fail') failed.push('app-container-overflow');
    return { ...base, status: failed.length ? 'fail' : 'pass', failed, dialog };
  } catch (error) {
    const reason = String(error?.message ?? error).split('\n')[0].slice(0, 300);
    return { ...base, status: 'skipped', reason, dialog: null };
  } finally {
    if (scenario.close) {
      try { await scenario.close(page); } catch { /* the next goto resets the page */ }
    }
  }
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
  const theme = args.theme === 'dark' ? 'dark' : 'light';
  const only = args.only ? String(args.only) : null;
  const viewportNames = args.viewports ? resolveViewports(args.viewports) : ['iphone'];
  const scenarios = only ? SCENARIOS.filter((s) => s.id.includes(only)) : SCENARIOS;
  if (args['chat-on']) console.error('--chat-on: assuming the chat feature flag is already enabled');
  if (scenarios.some((s) => s.id === 'chat-new-message')) console.error('chat-new-message: assuming the chat feature flag is already ON');

  const roles = new Map();
  for (const scenario of scenarios) roles.set(scenario.role, [...(roles.get(scenario.role) || []), scenario]);

  const jsonFile = path.join(ARTIFACT_ROOT, 'dialogs.json');
  const mdFile = path.join(ARTIFACT_ROOT, 'dialogs.md');
  const merged = new Map((await loadJson(jsonFile, [])).map((r) => [r.id, r]));

  const browser = await ENGINES[engineName].launch({
    headless: true,
    args: engineName === 'chromium' ? ['--hide-scrollbars'] : [],
  });
  const storageStates = new Map();
  try {
    for (const [role, roleScenarios] of roles) {
      const loginContext = await browser.newContext({ ...engineContextOptions(engineName, 'iphone'), baseURL: BASE_URL });
      const loginPage = await loginContext.newPage();
      await themeInitScript(loginPage, theme);
      await login(loginPage, role);
      storageStates.set(role, await loginContext.storageState({ indexedDB: true }));
      await loginContext.close();

      for (const viewport of viewportNames) {
        const context = await browser.newContext({ ...engineContextOptions(engineName, viewport), baseURL: BASE_URL, storageState: storageStates.get(role) });
        const page = await context.newPage();
        await themeInitScript(page, theme);
        page.setDefaultTimeout(15000);
        for (const scenario of roleScenarios) {
          const record = await runScenario(page, scenario, { engine: engineName, viewport });
          await applyTheme(page, theme);
          merged.set(record.id, record);
          await writeAtomic(jsonFile, [...merged.values()]);
          const detail = record.dialog
            ? `${record.dialog.rect.width}x${record.dialog.rect.height} actions=${record.dialog.actions === 'n/a' ? 'n/a' : record.dialog.actions.inside ? 'inside' : 'clipped'}`
            : (record.reason || '');
          console.log(`[${engineName}/${viewport}] ${record.id} ${record.status.toUpperCase()} ${detail}`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const allRecords = [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeAtomic(jsonFile, allRecords);
  await fs.writeFile(mdFile, renderMarkdown(allRecords));
  const totals = allRecords.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  console.log(`\n${engineName} dialogs: pass ${totals.pass || 0}, fail ${totals.fail || 0}, skipped ${totals.skipped || 0}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
