import { test, expect, Page } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';
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

// Admin routes use the same ready-state rule under the admin shell. Each
// locator exists only after that page's data state resolves.
const ADMIN_ROUTES: { route: string; content: (page: Page) => Locator }[] = [
  { route: '/admin/users', content: (p) => p.locator('[data-testid="admin-users-table"]') },
  { route: '/admin/families', content: (p) => p.locator('.admin-table').first() },
  { route: '/admin/people', content: (p) => p.locator('.import-card') },
  { route: '/admin/calendars', content: (p) => p.locator('.admin-table').first() },
  { route: '/admin/media', content: (p) => p.getByTestId('media-section-video') },
  { route: '/admin/photo-albums', content: (p) => p.locator('.admin-album-card').first() },
  { route: '/admin/uploads', content: (p) => p.getByText("You're all caught up") },
  { route: '/admin/recovery', content: (p) => p.getByTestId('admin-account-creations') },
  { route: '/admin/features', content: (p) => p.locator('mat-slide-toggle').first() },
];

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
      if (url) {
        await expect(page).toHaveURL(url);
      }
      // 30s timeout: full-suite browser load can exceed the 15s default (ledger C-20261023-01).
      await expect(content(page)).toBeVisible({ timeout: 30_000 });
    }
  });

  test('empty dataset shows empty-state, not skeleton', async ({ page }) => {
    // Contacts (people-derived) and albums are global RTDB nodes, not per-user,
    // so a sparse login alone cannot see an empty page: the empty dataset is
    // induced by nulling the global nodes and restored in finally (workers=1,
    // so no concurrent spec can observe the gap).
    const people = await readDb('people');
    const albums = await readDb('photoAlbums');
    try {
      await login(page, 'sparse');
      // Warm both routes with data first: contacts skips the service's empty
      // seed replay, so a cold route into an empty dataset stays on skeleton
      // by design. A warm stream re-emits [] and flips to the empty-state.
      await page.goto('/contacts');
      await expect(page.locator('.contacts-grid')).toBeVisible();
      await deleteDb('people');
      await expect(page.getByText('No contacts yet')).toBeVisible();
      await expect(page.locator('.contacts-skeleton-grid')).toHaveCount(0);

      await page.goto('/photos');
      await expect(page.locator('.album-tile-title', { hasText: 'E2E Album One' })).toBeVisible();
      await deleteDb('photoAlbums');
      await expect(page.getByText('No albums yet')).toBeVisible();
      await expect(page.getByTestId('albums-skeleton')).toHaveCount(0);
    } finally {
      await writeDb('people', people);
      await writeDb('photoAlbums', albums);
    }
  });

  test('top-nav never blank', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('mat-toolbar')).toBeVisible({ timeout: 1000 });
    await expect(page.locator('mat-toolbar').getByText('Sign In')).toBeVisible();
    await login(page, 'admin');
    await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();
  });

  test('every admin route renders content, never a blank body', async ({ page }) => {
    await login(page, 'admin');
    for (const { route, content } of ADMIN_ROUTES) {
      await page.goto(route);
      // The admin shell must paint within 1s of the load event: no unbounded spinner.
      await expect(page.locator('.admin-content')).toBeVisible({ timeout: 1000 });
      await expect(page.locator('app-page-toolbar').first()).toBeVisible();
      await expect(content(page)).toBeVisible();
      await expect(page.locator('app-load-error:visible')).toHaveCount(0);
    }
  });

  test('admin skeleton resolves under reload stress', async ({ page }) => {
    await login(page, 'admin');
    for (const { route, content } of ADMIN_ROUTES) {
      await page.goto(route);
      await page.reload();
      // 30s timeout: full-suite browser load can exceed the 15s default (ledger C-20261023-01).
      await expect(content(page)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.admin-skeleton-rows:visible')).toHaveCount(0);
    }
  });
});
