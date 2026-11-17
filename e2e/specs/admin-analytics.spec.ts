import type { Locator } from '@playwright/test';
import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('admin analytics', () => {
  test.afterEach(async ({ collector }) => collector.assertClean());

  test('analytics: renders the emulator fixture totals, top pages, and top events', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/analytics');

    const totals = page.getByTestId('admin-analytics-totals');
    await expect(totals).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('admin-analytics-users')).toHaveText('1,204');
    await expect(page.getByTestId('admin-analytics-sessions')).toHaveText('3,567');
    await expect(page.getByTestId('admin-analytics-views')).toHaveText('12,040');
    await expect(page.getByTestId('admin-analytics-new-users')).toHaveText('812');
    await expect(page.getByTestId('admin-analytics-avg-session')).toHaveText('1:36');
    await expect(page.getByTestId('admin-analytics-bounce')).toHaveText('41.6%');

    const trend = page.getByTestId('admin-analytics-trend');
    await expect(trend).toBeVisible();
    await expect(trend).toHaveAttribute('role', 'img');
    expect((await trend.getAttribute('aria-label'))?.length ?? 0).toBeGreaterThan(0);

    const polylines = trend.locator('polyline');
    await expect(polylines).toHaveCount(2);
    for (let index = 0; index < 2; index++) {
      const points = (await polylines.nth(index).getAttribute('points')) ?? '';
      expect(points).not.toBe('');
      expect(points.split(' ').length).toBeGreaterThanOrEqual(30);
      expect(points).toMatch(/^\d/);
      expect(points).not.toContain('NaN');
      expect(points).not.toContain('undefined');
    }
    await expect(page.getByTestId('admin-analytics-dates').locator('span')).toHaveCount(3);
    await expect(page.getByTestId('admin-analytics-partial-note')).toHaveCount(0);

    const pages = page.getByTestId('admin-analytics-pages');
    await expect(pages.locator('tbody tr')).toHaveCount(9);
    await expect(pages).toContainText('/calendar');
    await expectBarsHaveWidth(pages, true);

    const events = page.getByTestId('admin-analytics-events');
    await expect(events.locator('tbody tr')).toHaveCount(10);
    await expect(events).toContainText('page_view');
    await expectBarsHaveWidth(events, true);

    const devices = page.getByTestId('admin-analytics-devices');
    await expect(devices.locator('.device-row')).toHaveCount(3);
    await expectBarsHaveWidth(devices, false);

    await expect(page.getByTestId('admin-analytics-insight')).toContainText('/ leads with');
  });

  test('analytics: a ga source marks the last date and adds the partial-day note', async ({ page }) => {
    await login(page, 'admin');
    await page.route('**/adminAnalyticsSummary', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.result.source = 'ga';
      await route.fulfill({ response, json: body });
    });

    await page.goto('/admin/analytics');
    await expect(page.getByTestId('admin-analytics-totals')).toBeVisible({ timeout: 20000 });

    const note = page.getByTestId('admin-analytics-partial-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('may be partial');
    await expect(page.getByTestId('admin-analytics-dates').locator('span').last()).toHaveText(/\*$/);
  });

  test('analytics: cards use the shared white surface token', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/analytics');
    await expect(page.getByTestId('admin-analytics-totals')).toBeVisible({ timeout: 20000 });

    const colors = await page.evaluate(() => {
      const probe = document.createElement('div');
      const token = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-surface')
        .trim();
      probe.style.backgroundColor = token;
      document.body.appendChild(probe);
      const tokenColor = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const surfaces = Array.from(document.querySelectorAll('.admin-surface, mat-card'));
      return {
        tokenColor,
        surfaceColors: surfaces.map(surface => getComputedStyle(surface).backgroundColor),
        matCardCount: document.querySelectorAll('mat-card').length,
      };
    });

    expect(colors.matCardCount).toBeGreaterThan(0);
    expect(colors.surfaceColors.length).toBeGreaterThanOrEqual(colors.matCardCount);
    for (const surfaceColor of colors.surfaceColors) {
      expect(surfaceColor).toBe(colors.tokenColor);
    }
    expect(colors.tokenColor).toBe('rgb(255, 255, 255)');
  });

  test('analytics: an empty daily series shows the no-results message in place of the chart', async ({ page }) => {
    await login(page, 'admin');
    const summary = {
      source: 'fixture',
      range: { days: 30, start: '2026-01-01', end: '2026-01-30' },
      totals: {
        users: 4,
        sessions: 6,
        pageViews: 8,
        bounceRate: 0.5,
        avgSessionSeconds: 30,
        newUsers: 2,
      },
      daily: [],
      topPages: [{ label: '/', value: 8 }],
      topEvents: [{ label: 'page_view', value: 8 }],
      devices: [{ label: 'desktop', value: 6 }],
    };
    await page.route('**/adminAnalyticsSummary', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: summary }),
      }));

    await page.goto('/admin/analytics');
    await expect(page.getByTestId('admin-analytics-totals')).toBeVisible({ timeout: 20000 });

    await expect(page.getByTestId('admin-analytics-trend')).toHaveCount(0);
    await expect(page.getByTestId('admin-analytics-dates')).toHaveCount(0);
    await expect(page.locator('app-no-results-message')).toBeVisible();
    await expect(page.locator('app-no-results-message')).toContainText('No trend data yet');
    await expect(page.getByTestId('admin-analytics-users')).toHaveText('4');
  });

  test('analytics: labels the sample source while the loading skeleton precedes totals', async ({ page }) => {
    await login(page, 'admin');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/adminAnalyticsSummary', async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto('/admin/analytics');
    await expect(page.getByTestId('admin-analytics-loading')).toBeVisible();
    await expect(page.getByTestId('admin-analytics-totals')).toHaveCount(0);

    release();
    await expect(page.getByTestId('admin-analytics-totals')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('admin-analytics-source')).toHaveText('Sample data');
  });

  test('analytics: the insight names the top page share and peak date', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/analytics');
    await expect(page.getByTestId('admin-analytics-totals')).toBeVisible({ timeout: 20000 });

    const insight = page.getByTestId('admin-analytics-insight');
    await expect(insight).toContainText('/');
    const text = await insight.innerText();
    const share = text.match(/\d+\.\d% of page views/)?.[0] ?? '';
    expect(share).toMatch(/^\d+\.\d% of page views/);

    // Fixture peak sits at index 20 of 30, nine UTC days before build time.
    const peakDate = new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10);
    await expect(insight).toContainText(`${peakDate} peaked at`);
  });

  test('analytics: callable failure shows retry and recovers', async ({ page }) => {
    await login(page, 'admin');
    await page.route('**/adminAnalyticsSummary', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: { status: 'INTERNAL', message: 'Analytics unavailable' } }),
      }));

    await page.goto('/admin/analytics');
    const alert = page.locator('.admin-error[role="alert"]');
    await expect(alert).toBeVisible();

    await page.unroute('**/adminAnalyticsSummary');
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('admin-analytics-totals')).toBeVisible({ timeout: 20000 });
  });

  test('analytics: no horizontal overflow at phone width', async ({ page }) => {
    await login(page, 'admin');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/analytics');
    await expect(page.getByTestId('admin-analytics-totals')).toBeVisible({ timeout: 20000 });

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('analytics: a non-admin cannot reach the page', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/admin/analytics');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByTestId('admin-analytics-totals')).toHaveCount(0);
  });
});

async function expectBarsHaveWidth(scope: Locator, firstIsFull: boolean) {
  const bars = scope.locator('.bar');
  const count = await bars.count();
  expect(count).toBeGreaterThanOrEqual(3);
  const styles: string[] = [];
  for (let index = 0; index < count; index++) {
    const style = (await bars.nth(index).getAttribute('style')) ?? '';
    expect(style).toMatch(/width:\s*[\d.]+%/);
    const box = await bars.nth(index).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    styles.push(style);
  }
  if (firstIsFull) {
    expect(styles[0]).toMatch(/width:\s*100%/);
  }
  expect(new Set(styles).size).toBeGreaterThan(1);
}
