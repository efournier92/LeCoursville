import { test, expect, Page } from '../helpers/fixture';
import { login } from '../helpers/auth';

interface AdminRoute {
  path: string;
  title: string;
  /** Content that proves the route rendered its own surface, not an empty shell. */
  ready: (page: Page) => Promise<unknown>;
  /** Row-action buttons that must meet the mobile tap-target floor. */
  rowActions?: string;
}

const ADMIN_ROUTES: AdminRoute[] = [
  {
    path: '/admin/users',
    title: 'Users',
    ready: (page) => expect(page.getByTestId('admin-users-table')).toBeVisible(),
    rowActions: '.user-actions button',
  },
  {
    path: '/admin/families',
    title: 'Families',
    ready: (page) => expect(page.locator('.families-card .upload-area')).toBeVisible(),
    rowActions: '.family-actions button',
  },
  {
    path: '/admin/people',
    title: 'People',
    ready: (page) => expect(page.locator('.import-card .upload-area')).toBeVisible(),
  },
  {
    path: '/admin/calendars',
    title: 'Calendars',
    ready: (page) => expect(page.locator('.calendars-card .admin-table tbody tr').first()).toBeVisible(),
    rowActions: '.calendar-actions button',
  },
  {
    path: '/admin/media',
    title: 'Media',
    ready: (page) => expect(page.getByRole('tab', { name: 'Video' })).toBeVisible(),
  },
  {
    path: '/admin/photo-albums',
    title: 'Photo Albums',
    ready: (page) => expect(page.getByText('E2E Album One')).toBeVisible(),
  },
  {
    path: '/admin/uploads',
    title: 'Uploads',
    ready: async (page) => {
      await expect(page.getByText("You're all caught up")).toBeVisible();
      await page.getByRole('button', { name: /All \(\d+\)/ }).click();
      await expect(page.locator('.admin-table tbody tr').first()).toBeVisible();
    },
    rowActions: '.upload-actions button',
  },
  {
    path: '/admin/recovery',
    title: 'Recovery',
    ready: (page) => expect(page.getByTestId('admin-account-creations')).toBeVisible(),
  },
  {
    path: '/admin/features',
    title: 'Features',
    ready: (page) => expect(page.getByTestId('feature-toggle-calendar')).toBeVisible(),
  },
];

const MOBILE_TAP_TARGET = 44;

test.afterEach(async ({ collector }) => collector.assertClean());

async function expectTitleBar(page: Page, title: string, expectedHeight: number) {
  const toolbar = page.locator('.page-toolbar');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator('.page-toolbar-title')).toHaveText(title);

  const box = await toolbar.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.height - expectedHeight)).toBeLessThanOrEqual(1);

  // The title bar is chrome only: filters live in the bar below it.
  await expect(
    toolbar.locator('mat-form-field, .mat-mdc-form-field, .gallery-segmented, app-admin-filter-bar'),
  ).toHaveCount(0);
}

async function expectNoHorizontalScroll(page: Page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
}

async function expectTapTargets(page: Page, selector: string) {
  const buttons = page.locator(selector);
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await buttons.nth(i).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(MOBILE_TAP_TARGET);
    expect(box!.height).toBeGreaterThanOrEqual(MOBILE_TAP_TARGET);
  }
}

test.describe('admin visual contract', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route.path} keeps the title bar, page content, and mobile viewport contract`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await login(page, 'admin');
      await page.goto(route.path);

      await route.ready(page);
      await expectTitleBar(page, route.title, 64);

      await page.setViewportSize({ width: 390, height: 844 });
      await expectTitleBar(page, route.title, 56);
      await expectNoHorizontalScroll(page);

      if (route.rowActions) {
        await expectTapTargets(page, route.rowActions);
      }

      await page.setViewportSize({ width: 360, height: 844 });
      await expectTitleBar(page, route.title, 56);
      await expectNoHorizontalScroll(page);
    });
  }
});
