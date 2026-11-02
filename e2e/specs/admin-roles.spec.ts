import { test, expect, Page } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { readDb, writeDb } from '../helpers/admin-db';

interface AdminRoute {
  path: string;
  ready: (page: Page) => Promise<unknown>;
}

const CONTENT_ROUTES: AdminRoute[] = [
  {
    path: '/admin/families',
    ready: (page) => expect(page.locator('.families-card .upload-area')).toBeVisible(),
  },
  {
    path: '/admin/people',
    ready: (page) => expect(page.locator('.import-card .upload-area')).toBeVisible(),
  },
  {
    path: '/admin/calendars',
    ready: (page) => expect(page.locator('.calendars-card .admin-table tbody tr').first()).toBeVisible(),
  },
  {
    path: '/admin/media',
    ready: (page) => expect(page.getByTestId('media-section-video')).toBeVisible(),
  },
  {
    path: '/admin/photo-albums',
    ready: (page) => expect(page.getByText('E2E Album One')).toBeVisible(),
  },
  {
    path: '/admin/songs',
    ready: (page) => expect(page.locator('[data-testid="admin-songs-table"], [data-testid="admin-songs-empty"]')).toBeVisible(),
  },
];

const SYSTEM_ROUTES: AdminRoute[] = [
  {
    path: '/admin/users',
    ready: (page) => expect(page.getByTestId('admin-users-table')).toBeVisible(),
  },
  {
    path: '/admin/features',
    ready: (page) => expect(page.getByTestId('feature-toggle-chat')).toBeVisible(),
  },
  {
    path: '/admin/recovery',
    ready: (page) => expect(page.getByTestId('admin-account-creations')).toBeVisible(),
  },
  {
    path: '/admin/analytics',
    ready: (page) => expect(page.getByTestId('admin-analytics-totals')).toBeVisible(),
  },
  {
    path: '/admin/family-explorer',
    ready: (page) => expect(page.getByTestId('archive-json-input')).toBeVisible(),
  },
  {
    path: '/admin/uploads',
    ready: (page) => expect(page.locator('.uploads-table')).toBeVisible(),
  },
];

async function expectMemberModeration(page: Page, who: 'admin' | 'staff') {
  const chatBefore = await readDb('features/chat');
  const messageBefore = await readDb<Record<string, any>>('messages/msg-3');
  // minimalist: msg-3 seeds isSaved false and the delete tool only renders for a saved message; the finally restores it.
  await writeDb('features/chat', { enabled: true, updatedAt: Date.now() });
  await writeDb('messages/msg-3/isSaved', true);

  try {
    await login(page, who);
    await page.goto('/chat');
    const card = page.locator('.message-card-container', { hasText: 'From the user' }).first();
    const edit = card.locator('.message-button', { hasText: 'Edit' });
    await expect(edit).toBeVisible();
    await edit.locator('mat-icon').click();
    const editor = page.locator('.chat-edit-component');
    await expect(editor.locator('.message-button', { hasText: 'Delete' })).toBeVisible();
  } finally {
    await writeDb('messages/msg-3', messageBefore);
    await writeDb('features/chat', chatBefore);
  }
}

async function expectExpressionControls(page: Page, who: 'admin' | 'staff') {
  await login(page, who);
  await page.goto('/expressions');
  await expect(page.locator('.create-expression-button')).toBeVisible();
  const card = page.locator('.expression-card-wrapper', { hasText: 'Live long and prosper' }).first();
  await card.hover();
  await expect(card.locator('.expression-actions')).toBeVisible();
}

async function expectLegacyPhotoControls(page: Page, who: 'admin' | 'staff') {
  const before = await readDb('features/enablePhotoAlbums');
  await writeDb('features/enablePhotoAlbums', { enabled: false, updatedAt: Date.now() });
  try {
    await login(page, who);
    await page.goto('/photos');
    await expect(page.locator('.photos-upload-button')).toBeVisible();
    const edit = page.locator('.photo-card').first().locator('.photos-controls-container button', { hasText: 'edit' });
    await expect(edit).toBeVisible();
  } finally {
    await writeDb('features/enablePhotoAlbums', before);
  }
}

test.describe('admin roles', () => {
  test('content admin reaches every content admin page', async ({ page }) => {
    await login(page, 'staff');
    for (const route of CONTENT_ROUTES) {
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await route.ready(page);
    }
  });

  test('content admin is redirected from every system admin page', async ({ page }) => {
    await login(page, 'staff');
    for (const route of SYSTEM_ROUTES) {
      await page.goto(route.path);
      await expect(page).not.toHaveURL(/\/admin/);
      await expect(page.locator('app-admin')).toHaveCount(0);
      await expect(page.getByTestId('admin-nav')).toHaveCount(0);
    }
  });

  test('content admin is served the admin shell at /admin', async ({ page }) => {
    await login(page, 'staff');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/families$/);
    await expect(page.getByTestId('admin-nav')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('admin-nav')).toBeVisible();
    await expect(page.getByTestId('admin-nav-link-users')).toHaveCount(0);
  });

  test('content admin sees the Content Admin badge and not the Super badge', async ({ page }) => {
    await login(page, 'staff');
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page.locator('.account-role')).toHaveText(['User', 'Content Admin']);
  });

  test('member sees no role badges', async ({ page }) => {
    await login(page, 'user');
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page.locator('.account-roles')).toHaveCount(0);
    await expect(page.getByText('Content Admin')).toHaveCount(0);
    await expect(page.getByText('Super')).toHaveCount(0);
  });

  test('super sees the Content Admin and Super badges', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page.locator('.account-role')).toHaveText(['User', 'Content Admin', 'Super']);
  });

  test('super reaches every system admin page', async ({ page }) => {
    await login(page, 'admin');
    for (const route of SYSTEM_ROUTES) {
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await route.ready(page);
    }
  });

  test('content admin moderates a member chat message', async ({ page }) => {
    await expectMemberModeration(page, 'staff');
  });

  test('super moderates a member chat message', async ({ page }) => {
    await expectMemberModeration(page, 'admin');
  });

  test('content admin keeps the expression create and action controls', async ({ page }) => {
    await expectExpressionControls(page, 'staff');
  });

  test('super keeps the expression create and action controls', async ({ page }) => {
    await expectExpressionControls(page, 'admin');
  });

  test('content admin keeps the legacy photo upload and edit controls', async ({ page }) => {
    await expectLegacyPhotoControls(page, 'staff');
  });

  test('super keeps the legacy photo upload and edit controls', async ({ page }) => {
    await expectLegacyPhotoControls(page, 'admin');
  });
});
