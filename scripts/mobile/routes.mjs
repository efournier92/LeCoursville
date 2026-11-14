// Shared matrix and route manifest for the mobile screenshot/audit harness.
// Landmark selectors mirror assertions in e2e/specs; each route names the spec
// surface it waits on so a renamed component fails loudly instead of silently
// capturing an empty shell.

export const BASE_URL = 'http://localhost:5000';
export const ARTIFACT_ROOT = '/tmp/mobile-overnight-2026-11-13';
export const THEME_KEY = 'lecoursville.theme.session';

export const VIEWPORTS = {
  fold: { width: 280, height: 653 },
  se1: { width: 320, height: 568 },
  android: { width: 360, height: 800 },
  mini: { width: 375, height: 812 },
  iphone: { width: 390, height: 844 },
  max: { width: 430, height: 932 },
  'phone-land': { width: 844, height: 390 },
  'ipad-mini': { width: 768, height: 1024 },
  'ipad-land': { width: 1024, height: 768 },
  'ipad-pro': { width: 1024, height: 1366 },
};

export const ENGINES = ['chromium', 'webkit', 'firefox'];

// `/` is captured signed out, so the auth form is the landmark; a signed-in
// landing is covered by the promoted /calendar route.
const HOME_READY = '[data-testid="auth-email"], #lecoursville-navbar-links';
const AUTH_ACTION_READY = '[data-testid="auth-action-error"], [data-testid="auth-action-form"]';
// Sparse accounts have no guaranteed seeded record, so only the app frame is
// asserted; the page toolbar/content still prove the shell mounted.
const FRAME_READY = 'main, .app-container';

const userSet = [
  // public (captured signed out)
  { role: 'public', path: '/', slug: 'home', ready: HOME_READY },
  {
    role: 'public',
    path: '/auth/action?mode=resetPassword&oobCode=not-a-real-code',
    slug: 'auth-action',
    ready: AUTH_ACTION_READY,
  },
  { role: 'public', path: '/upload', slug: 'upload', ready: '.upload-container.surface-card' },
  // Signed-out explorer redirects to `/` (media.spec), so the auth form lands.
  { role: 'public', path: '/media/explorer', slug: 'media-explorer-public', ready: '[data-testid="auth-email"]' },
  { role: 'public', path: '/family-explorer/archive-1', slug: 'family-explorer', ready: '[data-testid="family-chart"]' },
  // signed-in role user
  { role: 'user', path: '/account', slug: 'account', ready: '.account-name' },
  { role: 'user', path: '/contacts', slug: 'user-contacts', ready: '.contact-card' },
  { role: 'user', path: '/contacts/person-a', slug: 'contact-detail', ready: 'app-person-detail-modal h2' },
  { role: 'user', path: '/people', slug: 'user-people', ready: '.people-container' },
  { role: 'user', path: '/calendar?year=2026&month=11', slug: 'calendar', ready: '.cal-days' },
  { role: 'user', path: '/songs', slug: 'songs', ready: '[data-testid="song-card"]' },
  { role: 'user', path: '/songs/song-a', slug: 'song-detail', ready: '[data-testid="song-body"]' },
  { role: 'user', path: '/chat', slug: 'chat', ready: '.chat-component' },
  { role: 'user', path: '/expressions', slug: 'expressions', ready: '.expressions-component' },
  { role: 'user', path: '/photos', slug: 'user-photos', ready: '.album-grid' },
  { role: 'user', path: '/photos/album-1', slug: 'photo-album', ready: '.gallery-search' },
  { role: 'user', path: '/photos/album-1/slideshow', slug: 'slideshow', ready: '.slideshow-image' },
  {
    role: 'user',
    path: '/media/explorer?id=media-video',
    slug: 'media-video',
    ready: 'app-video-player-drive-iframe iframe.video-iframe',
  },
  { role: 'user', path: '/feature-disabled', slug: 'feature-disabled', ready: '.disabled-card' },
  // sparse account
  { role: 'sparse', path: '/contacts', slug: 'sparse-contacts', ready: FRAME_READY },
  { role: 'sparse', path: '/people', slug: 'sparse-people', ready: FRAME_READY },
  { role: 'sparse', path: '/photos', slug: 'sparse-photos', ready: FRAME_READY },
  // print surface
  {
    role: 'admin',
    path: '/calendar/print?year=2026&month=11',
    slug: 'calendar-print',
    ready: '[data-testid="calendar-print-customize"]',
  },
];

const adminSet = [
  { role: 'admin', path: '/admin', slug: 'admin', ready: '[data-testid="admin-nav"]' },
  { role: 'admin', path: '/admin/families', slug: 'admin-families', ready: '.families-card .upload-area' },
  { role: 'admin', path: '/admin/people', slug: 'admin-people', ready: '[data-testid="admin-people-table"]' },
  {
    role: 'admin',
    path: '/admin/calendars',
    slug: 'admin-calendars',
    ready: '.calendars-card .admin-table tbody tr',
  },
  { role: 'admin', path: '/admin/uploads', slug: 'admin-uploads', ready: '.uploads-table' },
  { role: 'admin', path: '/admin/media', slug: 'admin-media', ready: '[data-testid="media-section-video"]' },
  {
    role: 'admin',
    path: '/admin/expressions',
    slug: 'admin-expressions',
    ready: '.create-expression-button',
  },
  { role: 'admin', path: '/admin/songs', slug: 'admin-songs', ready: '[data-testid="admin-songs-table"]' },
  {
    role: 'admin',
    path: '/admin/family-explorer',
    slug: 'admin-family-explorer',
    ready: '[data-testid="archive-json-input"]',
  },
  { role: 'admin', path: '/admin/users', slug: 'admin-users', ready: '[data-testid="admin-users-table"]' },
  { role: 'admin', path: '/admin/features', slug: 'admin-features', ready: '[data-testid="feature-toggle-calendar"]' },
  {
    role: 'admin',
    path: '/admin/analytics',
    slug: 'admin-analytics',
    ready: '[data-testid="admin-analytics-totals"]',
  },
  {
    role: 'admin',
    path: '/admin/recovery',
    slug: 'admin-recovery',
    ready: '[data-testid="admin-account-creations"]',
  },
  {
    role: 'admin',
    path: '/admin/data-requests',
    slug: 'admin-data-requests',
    ready: '[data-testid="admin-data-requests-list"]',
  },
  { role: 'admin', path: '/admin/photo-albums', slug: 'admin-photo-albums', ready: '.admin-album-grid' },
  // role staff, same surfaces minus the super-admin only pages
  { role: 'staff', path: '/admin', slug: 'staff-admin', ready: '[data-testid="admin-nav"]' },
  { role: 'staff', path: '/admin/families', slug: 'staff-families', ready: '.families-card .upload-area' },
  { role: 'staff', path: '/admin/people', slug: 'staff-people', ready: '[data-testid="admin-people-table"]' },
  { role: 'staff', path: '/admin/media', slug: 'staff-media', ready: '[data-testid="media-section-video"]' },
  {
    role: 'staff',
    path: '/admin/expressions',
    slug: 'staff-expressions',
    ready: '.create-expression-button',
  },
  {
    role: 'staff',
    path: '/admin/songs',
    slug: 'staff-songs',
    ready: '[data-testid="admin-songs-table"], [data-testid="admin-songs-empty"]',
  },
  { role: 'staff', path: '/admin/photo-albums', slug: 'staff-photo-albums', ready: '.admin-album-grid' },
];

const smokeSet = [{ role: 'public', path: '/', slug: 'smoke-home', ready: HOME_READY }];

export const ROUTE_SETS = { user: userSet, admin: adminSet, smoke: smokeSet };

export const ROUTES = [...userSet, ...adminSet, ...smokeSet];

export const DISABLE_ANIMATIONS = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important}`;

export function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eq = body.indexOf('=');
      if (eq === -1) out[body] = true;
      else out[body.slice(0, eq)] = body.slice(eq + 1);
    }
  }
  return out;
}

export function resolveEntries(routeSet, only) {
  const set = routeSet === 'all' ? ROUTES : ROUTE_SETS[routeSet];
  if (!set) throw new Error(`unknown --routes value: ${routeSet}`);
  return only ? set.filter((r) => r.slug.includes(only)) : set;
}

export function resolveViewports(value) {
  if (!value) return Object.keys(VIEWPORTS);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((name) => {
      if (!VIEWPORTS[name]) throw new Error(`unknown viewport: ${name}`);
      return name;
    });
}

export function engineContextOptions(engine, viewportName) {
  const viewport = VIEWPORTS[viewportName];
  const options = {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'en-US',
    reducedMotion: 'reduce',
  };
  if (engine === 'chromium' || engine === 'webkit') {
    options.isMobile = true;
    options.hasTouch = true;
  } else {
    // Firefox rejects isMobile, so its contexts are viewport-only.
    options.hasTouch = false;
  }
  return options;
}

export async function themeInitScript(page, theme) {
  await page.addInitScript(
    ({ theme, key }) => {
      try {
        localStorage.setItem(key, theme);
        sessionStorage.setItem(key, theme);
      } catch {
        // Storage can be unavailable on about:blank; the attribute still wins.
      }
    },
    { theme, key: THEME_KEY },
  );
}

export async function applyTheme(page, theme) {
  await page.evaluate(
    ({ theme, key }) => {
      try {
        localStorage.setItem(key, theme);
        sessionStorage.setItem(key, theme);
      } catch {
        // Ignore storage failures; the attribute below drives the visuals.
      }
      if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    },
    { theme, key: THEME_KEY },
  );
}

export async function waitForMutationQuiet(page, capMs = 5000, quietMs = 250) {
  await page.evaluate(
    ({ capMs, quietMs }) =>
      new Promise((resolve) => {
        let quietTimer;
        let capTimer;
        const done = () => {
          observer.disconnect();
          clearTimeout(quietTimer);
          clearTimeout(capTimer);
          resolve();
        };
        const observer = new MutationObserver(() => {
          clearTimeout(quietTimer);
          quietTimer = setTimeout(done, quietMs);
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
        quietTimer = setTimeout(done, quietMs);
        capTimer = setTimeout(done, capMs);
      }),
    { capMs, quietMs },
  );
}

export async function prepareRoutePage(page, route, { readyTimeout = 15000, idleTimeout = 15000 } = {}) {
  await page.goto(BASE_URL + route.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(route.ready, { state: 'visible', timeout: readyTimeout });
  try {
    await page.waitForLoadState('networkidle', { timeout: idleTimeout });
  } catch {
    console.error(`networkidle timeout: ${route.slug}`);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await waitForMutationQuiet(page);
}

export async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.scrollTo(0, 0);
    await frame();
    const step = Math.max(1, window.innerHeight);
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let y = step; y <= max + step; y += step) {
      window.scrollTo(0, Math.min(y, max));
      await frame();
    }
    window.scrollTo(0, max);
    await frame();
    window.scrollTo(0, 0);
    await frame();
  });
}
