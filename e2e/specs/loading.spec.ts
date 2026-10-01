import { test, expect, Page } from '../helpers/fixture';
import { login } from '../helpers/auth';
import type { Locator } from '@playwright/test';

// Per-route content selectors come straight from each component template.
// Chat is seeded OFF: /chat redirects to /feature-disabled (flag untouched).
const ROUTES: { route: string; url?: RegExp; content: (page: Page) => Locator }[] = [
  { route: '/contacts', content: (p) => p.locator('.contacts-grid') },
  { route: '/calendar', content: (p) => p.locator('app-calendar-view.calendar-view-component') },
  { route: '/expressions', content: (p) => p.locator('.expression-card-wrapper').first() },
  { route: '/photos', content: (p) => p.locator('.album-tile-title', { hasText: 'E2E Album One' }) },
  { route: '/people', content: (p) => p.locator('.family-group').first() },
  { route: '/media/explorer', content: (p) => p.locator('.media-list-item', { hasText: 'E2E Doc' }) },
  { route: '/media/audio', content: (p) => p.locator('.media-list-item', { hasText: 'E2E Audio' }) },
  { route: '/media/video', content: (p) => p.locator('.media-list-item', { hasText: 'E2E Video' }) },
  { route: '/upload', content: (p) => p.getByRole('heading', { name: 'Upload Files' }) },
  {
    route: '/chat',
    url: /\/feature-disabled/,
    content: (p) => p.locator('.disabled-card').getByText('Feature Disabled'),
  },
];

const RTDB_BASE = 'http://localhost:9000';
const RTDB_NS = 'lecoursville-dev-default-rtdb';
const rtdbUrl = (path: string) => `${RTDB_BASE}/${path}.json?ns=${RTDB_NS}`;

async function rtdbGet(path: string): Promise<unknown> {
  const res = await fetch(rtdbUrl(path));
  if (!res.ok) throw new Error(`rtdb GET ${path} -> ${res.status}`);
  return res.json();
}

async function rtdbPut(path: string, value: unknown): Promise<void> {
  const res = await fetch(rtdbUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value ?? null),
  });
  if (!res.ok) throw new Error(`rtdb PUT ${path} -> ${res.status}`);
}

test.describe('loading contract', () => {
  test.afterEach(async ({ collector }) => {
    collector.assertClean();
  });

  test('every non-admin route renders content, never a blank body', async ({ page }) => {
    await login(page, 'admin');
    for (const { route, url, content } of ROUTES) {
      await page.goto(route);
      // Toolbar is app chrome: it must paint within 1s of the load event.
      await expect(page.locator('mat-toolbar')).toBeVisible({ timeout: 1000 });
      if (url) {
        await expect(page).toHaveURL(url);
      }
      await expect(content(page)).toBeVisible();
    }
  });

  test('skeleton resolves under reload stress', async ({ page }) => {
    await login(page, 'admin');
    for (const { route, url, content } of ROUTES) {
      await page.goto(route);
      await page.reload();
      await page.reload();
      await page.reload();
      if (url) {
        await expect(page).toHaveURL(url);
      }
      await expect(content(page)).toBeVisible();
    }
  });

  test('empty dataset shows empty-state, not skeleton', async ({ page }) => {
    // Contacts (people-derived) and albums are global RTDB nodes, not per-user,
    // so a sparse login alone cannot see an empty page: the empty dataset is
    // induced by nulling the global nodes and restored in finally (workers=1,
    // so no concurrent spec can observe the gap).
    const people = await rtdbGet('people');
    const albums = await rtdbGet('photoAlbums');
    try {
      await login(page, 'sparse');
      // Warm both routes with data first: contacts skips the service's empty
      // seed replay, so a cold route into an empty dataset stays on skeleton
      // by design. A warm stream re-emits [] and flips to the empty-state.
      await page.goto('/contacts');
      await expect(page.locator('.contacts-grid')).toBeVisible();
      await rtdbPut('people', null);
      await expect(page.getByText('No contacts yet')).toBeVisible();
      await expect(page.locator('.contacts-skeleton-grid')).toHaveCount(0);

      await page.goto('/photos');
      await expect(page.locator('.album-tile-title', { hasText: 'E2E Album One' })).toBeVisible();
      await rtdbPut('photoAlbums', null);
      await expect(page.getByText('No albums yet')).toBeVisible();
      await expect(page.getByTestId('albums-skeleton')).toHaveCount(0);
    } finally {
      await rtdbPut('people', people);
      await rtdbPut('photoAlbums', albums);
    }
  });

  test('top-nav never blank', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('mat-toolbar')).toBeVisible({ timeout: 1000 });
    await expect(page.locator('mat-toolbar').getByText('Sign In')).toBeVisible();
    await login(page, 'admin');
    await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();
  });
});
