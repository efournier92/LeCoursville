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
    ready: (page) => expect(page.getByTestId('media-section-video')).toBeVisible(),
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

  const surface = await toolbar.evaluate((el) => {
    const styles = getComputedStyle(el);
    return {
      radius: parseFloat(styles.borderTopLeftRadius),
      borderTop: styles.borderTopWidth,
      borderLeft: styles.borderLeftWidth,
    };
  });
  expect(surface.radius).toBeGreaterThan(0);
  expect(surface.borderTop).toBe('1px');
  expect(surface.borderLeft).toBe('1px');

  // The title bar is chrome only: filters live in the bar below it.
  await expect(
    toolbar.locator('mat-form-field, .mat-mdc-form-field, .gallery-segmented, app-admin-filter-bar'),
  ).toHaveCount(0);
}

/**
 * Gap between the title bar and the next rendered content. A filter bar that
 * joins the title bar counts as part of the bar, so the gap is measured below
 * the joined unit.
 */
async function expectSharedPageGap(page: Page) {
  const gap = await page.evaluate(() => {
    const bar = document.querySelector('app-page-toolbar');
    if (!bar) return null;
    const following = bar.nextElementSibling;
    const unit = following?.tagName === 'APP-ADMIN-FILTER-BAR' ? following : bar;
    let next = unit.nextElementSibling;
    while (next) {
      const rect = next.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) break;
      next = next.nextElementSibling;
    }
    if (!next) return null;
    return Math.round(next.getBoundingClientRect().top - unit.getBoundingClientRect().bottom);
  });
  expect(gap).not.toBeNull();
  expect(gap).toBe(16);
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
      await expectSharedPageGap(page);

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

test.describe('admin consistency fixes', () => {
  test('feature page title bar keeps the shared 16px gap', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, 'admin');
    await page.goto('/people');
    await expect(page.locator('.family-group').first()).toBeVisible();
    await expectSharedPageGap(page);
  });

  async function handleMetrics(page: Page, id: string) {
    return page.getByTestId(`feature-toggle-${id}`).locator('.mdc-switch__handle-track').evaluate((el) => {
      const transform = getComputedStyle(el).transform;
      const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform);
      const knob = el.querySelector('.mdc-switch__handle')!.getBoundingClientRect();
      const track = el.closest('.mdc-switch')!.querySelector('.mdc-switch__track')!.getBoundingClientRect();
      return {
        x: Math.round(matrix?.m41 ?? 0),
        knobLeft: Math.round(knob.left),
        knobRight: Math.round(knob.right),
        trackLeft: Math.round(track.left),
        trackRight: Math.round(track.right),
      };
    });
  }

  test('feature switches travel right when on and keep the thumb inside the track', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/features');
    await expect(page.getByTestId('feature-toggle-contacts')).toBeVisible();

    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const on = await handleMetrics(page, 'contacts');
      const off = await handleMetrics(page, 'chat');
      expect(on.x).toBeGreaterThan(off.x);
      expect(on.knobRight).toBeLessThanOrEqual(on.trackRight);
      expect(on.knobLeft).toBeGreaterThanOrEqual(on.trackLeft);
      expect(off.knobLeft).toBeGreaterThanOrEqual(off.trackLeft);
      await expect(page.locator('.mdc-switch__icons')).toHaveCount(0);
    }

    const changed = await page.getByTestId('feature-changed-contacts').evaluate((el) => {
      const row = el.closest('.feature-row') as HTMLElement;
      return {
        right: Math.round(el.getBoundingClientRect().right),
        rowContentRight: Math.round(row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight)),
      };
    });
    expect(Math.abs(changed.right - changed.rowContentRight)).toBeLessThanOrEqual(1);
  });

  test('users and photo albums use one bordered 36px sort pill', async ({ page }) => {
    await login(page, 'admin');

    await page.goto('/admin/users');
    await expect(page.getByTestId('admin-users-table')).toBeVisible();
    const usersPill = page.locator('.admin-sort-control');
    await expect(usersPill).toHaveCount(1);
    await expect(usersPill).toHaveCSS('height', '36px');
    await expect(usersPill).toHaveCSS('border-top-width', '1px');
    await expect(usersPill).toHaveCSS('border-radius', '999px');
    await expect(usersPill.locator('.admin-sort-direction')).toHaveCount(1);

    await page.goto('/admin/photo-albums');
    await expect(page.getByText('E2E Album One')).toBeVisible();
    const albumsPill = page.locator('.admin-sort-control');
    await expect(albumsPill).toHaveCount(1);
    await expect(albumsPill).toHaveCSS('height', '36px');
    await expect(albumsPill).toHaveCSS('border-top-width', '1px');
  });

  test('calendar and family primary actions live in the title bar', async ({ page }) => {
    await login(page, 'admin');

    await page.goto('/admin/calendars');
    const calendarsBar = page.locator('.page-toolbar');
    await expect(calendarsBar.getByRole('button', { name: 'Add Calendar' })).toBeVisible();
    await calendarsBar.getByRole('button', { name: 'Add Calendar' }).click();
    await expect(calendarsBar.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
    await expect(calendarsBar.getByRole('button', { name: 'Cancel' })).toBeVisible();

    await page.goto('/admin/families');
    const familiesBar = page.locator('.page-toolbar');
    await expect(familiesBar.getByRole('button', { name: 'Add Family' })).toBeVisible();
    await familiesBar.getByRole('button', { name: 'Add Family' }).click();
    await expect(familiesBar.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
    await expect(familiesBar.getByRole('button', { name: 'Add Family' })).toHaveCount(0);
    await familiesBar.getByRole('button', { name: 'Cancel' }).click();
    await expect(familiesBar.getByRole('button', { name: 'Add Family' })).toBeVisible();
  });

  test('media rows have no accent strip and the album footer is balanced', async ({ page }) => {
    await login(page, 'admin');

    await page.goto('/admin/media');
    const row = page.locator('.media-list-item').first();
    await expect(row).toBeVisible();
    await expect(row).toHaveCSS('border-left-width', '1px');

    await page.goto('/admin/photo-albums');
    await expect(page.locator('.admin-album-card').first()).toBeVisible();
    const footer = page.locator('.admin-album-card').first().locator('mat-card-actions');
    await expect(footer).toHaveCSS('padding-top', '14px');
    await expect(footer).toHaveCSS('padding-bottom', '14px');
  });

  test('recovery account rows share a grid and the mobile calendar aligns its value column', async ({ page }) => {
    await login(page, 'admin');

    await page.goto('/admin/recovery');
    const rows = page.locator('.account-row');
    await expect(rows.first()).toBeVisible();
    const columns = await rows.evaluateAll((els) => els.slice(0, 3).map((el) => {
      const x = (selector: string) => Math.round(el.querySelector(selector)!.getBoundingClientRect().left);
      const age = el.querySelector('.account-age')!.getBoundingClientRect();
      const row = el.getBoundingClientRect();
      return {
        name: x('.account-name'),
        email: x('.account-email'),
        roles: x('.account-roles'),
        ageRight: Math.round(age.right),
        rowContentRight: Math.round(row.right - parseFloat(getComputedStyle(el).paddingRight)),
      };
    }));
    for (const column of columns) {
      expect(column.name).toBe(columns[0].name);
      expect(column.email).toBe(columns[0].email);
      expect(column.roles).toBe(columns[0].roles);
      expect(Math.abs(column.ageRight - column.rowContentRight)).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/calendars');
    const mobileRow = page.locator('.admin-table tbody tr').first();
    await expect(mobileRow).toBeVisible();
    const alignment = await mobileRow.evaluate((tr) => {
      const yearCell = tr.querySelector('.calendar-year')!;
      const range = document.createRange();
      range.selectNodeContents(yearCell);
      return {
        year: Math.round(range.getBoundingClientRect().left),
        url: Math.round(tr.querySelector('.calendar-url-link')!.getBoundingClientRect().left),
      };
    });
    expect(Math.abs(alignment.year - alignment.url)).toBeLessThanOrEqual(1);
  });
});
