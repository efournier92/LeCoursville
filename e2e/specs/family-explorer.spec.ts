import { test, expect } from '../helpers/fixture';

/**
 * The explorer is a public, chrome-free page. Every test here is signed out on
 * purpose: the rule under test is the published-family read grant.
 */
test.describe('family explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/family-explorer/ferland');
    await expect(page.getByTestId('family-chart')).toBeVisible();
  });

  test('renders the masthead, roots row, branch order, and numerals', async ({ page }) => {
    await expect(page.locator('.topbar-title')).toContainText('Ferland Family');
    await expect(page.getByTestId('family-counts')).toContainText('9 People');
    await expect(page.getByTestId('family-counts')).toContainText('4 Generations');

    const roots = page.getByTestId('family-roots');
    await expect(roots).toBeVisible();
    await expect(roots).toContainText('Roots');
    await expect(page.locator('[data-testid^="family-root-"]')).toHaveCount(2);
    await expect(page.getByTestId('family-root-fa-1')).toContainText('Ferdinand Fern');
    await expect(page.getByTestId('family-root-fa-1')).toContainText('1901');
    await expect(page.getByTestId('family-root-fa-2')).toContainText('Fabienne Fern');
    await expect(page.getByTestId('family-root-fb-1')).toHaveCount(0);

    // Cards run oldest branch member first: Barnaby (b. 1910), Felix (b. 1926), Fiona (b. 1929).
    await expect(page.locator('.family-head-name')).toHaveText([
      "Barnaby's Family",
      "Felix's Family",
      "Fiona's Family",
    ]);

    await expect(page.getByTestId('family-numeral')).toHaveText(['01', '02', '03']);
    await expect(page.getByTestId('family-tint-dot')).toHaveCount(3);
  });

  test('renders nested tree guides, ticks, generation dividers, and one marriage chip', async ({ page }) => {
    // Two nested guide levels prove child > grandchild nesting.
    await expect(page.locator('[data-testid="family-guide"] [data-testid="family-guide"]')).not.toHaveCount(0);
    await expect(page.getByTestId('family-tick').first()).toBeVisible();

    const divider = page.getByTestId('gen-divider').first();
    await expect(divider).toBeVisible();
    await expect(divider.locator('.gen-label')).toHaveText(/Children|Grandchildren/);
    await expect(divider.locator('.gen-count')).toHaveText(/^\d+$/);

    // fa-3 and fa-5 both list the same 1948 marriage; it must render once.
    const node = page.getByTestId('family-node-fa-3');
    const chip = node.getByTestId('family-marriage-fa-3-fa-5');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText('m. 1948');
    await expect(node.locator('.mchip')).toHaveCount(1);
  });

  test('renders chromeless with its own green topbar, no site branding or menus', async ({ page }) => {
    await expect(page.locator('mat-toolbar')).toHaveCount(0);
    await expect(page.getByText('Sign In')).toHaveCount(0);
    await expect(page.locator('#lecoursville-navbar-links')).toHaveCount(0);

    const topbar = page.locator('.explorer-topbar');
    await expect(topbar).toBeVisible();
    await expect(topbar).toContainText('Ferland Family');
    await expect(topbar.locator('img')).toHaveCount(0);
  });

  test('lays out as masonry columns with a sticky topbar', async ({ page }) => {
    const gap = await page.locator('.family-chart').evaluate(el => getComputedStyle(el).columnGap);
    expect(gap).toBe('20px');
    // `columns: 300px` must resolve to a real multi-column layout at desktop
    // width; a single-column flex gap would satisfy columnGap alone.
    const lefts = await page.locator('.family-chart').evaluate(el => {
      const values = Array.from(el.children).map(child => Math.round(child.getBoundingClientRect().left));
      return Array.from(new Set(values));
    });
    expect(lefts.length).toBeGreaterThanOrEqual(2);
    const position = await page.locator('.explorer-topbar').evaluate(el => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  test('selecting a person fills the panel with their name and labelled fields', async ({ page }) => {
    // fa-1 heads the founding couple in the roots row.
    await page.getByTestId('family-root-fa-1').click();
    await expect(page.getByTestId('family-root-fa-1')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('family-root-fa-2')).toHaveAttribute('aria-pressed', 'false');
    const panel = page.getByTestId('family-panel');
    await expect(panel).toContainText('Ferdinand Fern');
    await expect(page.getByTestId('family-panel-birth')).toContainText('January 5, 1901');
    await expect(page.getByTestId('family-panel-occupation')).toContainText('Farrier');
    await expect(page.getByTestId('family-panel-note')).toContainText('notebook');

    // The X in the top-right closes the panel and hides it again.
    await expect(page.getByTestId('family-panel-close')).toBeVisible();
    await page.getByTestId('family-panel-close').click();
    await expect(page.getByTestId('family-panel')).toHaveCount(0);
    await expect(page.getByTestId('family-root-fa-1')).toHaveAttribute('aria-pressed', 'false');
  });

  test('re-selects a relative from the panel and closes on Escape', async ({ page }) => {
    await page.getByTestId('family-root-fa-1').click();
    const panel = page.getByTestId('family-panel');
    await expect(panel).toContainText('Ferdinand Fern');

    const lineageNames = panel.getByTestId('family-panel-lineage').locator('.person-name');
    // Spouse-surname dedupe renders the root's span as just "Ferdinand".
    await expect(lineageNames.filter({ hasText: 'Ferdinand' })).toHaveAttribute('aria-pressed', 'true');

    const felix = panel.getByTestId('family-panel-lineage').getByRole('button', { name: 'Felix Fern' });
    await felix.focus();
    await felix.click();
    await expect(panel.locator('.family-panel-name')).toContainText('Felix Fern');
    await expect(lineageNames.filter({ hasText: 'Felix Fern' })).toHaveAttribute('aria-pressed', 'true');
    await expect(lineageNames.filter({ hasText: 'Ferdinand' })).toHaveAttribute('aria-pressed', 'false');

    // Focus stays inside the panel, so Escape reaches the panel's keydown handler.
    await page.getByTestId('family-panel-close').focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('family-panel')).toHaveCount(0);
  });

  test('search filters branches live and clearing restores them', async ({ page }) => {
    const search = page.getByLabel('Filter by name');
    await expect(search).toBeVisible();
    await search.fill('Faron');
    await expect(page.getByTestId('family-unit-fa-6')).toBeVisible();
    await expect(page.getByTestId('family-branch-fb-1')).toHaveCount(0);
    await expect(page.getByTestId('family-search-status')).toBeVisible();
    await expect(page.getByTestId('family-search-status')).toContainText('1 matching branch');

    await search.fill('');
    await expect(page.getByTestId('family-branch-fb-1')).toBeVisible();
    await expect(page.getByTestId('family-search-status')).toHaveCount(0);

    await search.fill('zzznope');
    await expect(page.locator('.no-results-message')).toBeVisible();
    await expect(page.getByTestId('family-search-status')).toContainText('0 matching branches');
  });

  test('ArrowRight and ArrowLeft move the selection and focus', async ({ page }) => {
    await page.getByTestId('family-unit-fa-3').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(':focus')).toHaveAttribute('data-person', 'fa-5');
    await expect(page.getByTestId('family-panel')).toHaveCount(0);

    await page.keyboard.press('ArrowUp');
    await expect(page.locator(':focus')).toHaveAttribute('data-person', 'fa-3');

    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('family-spouse-fa-5')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('family-panel')).toContainText('Florence Firth');

    await page.getByTestId('family-spouse-fa-5').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('family-unit-fa-3')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('family-panel')).toContainText('Felix Fern');
  });

  test('at 390x844 the panel opens as an overlay drawer with a backdrop and no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/family-explorer/ferland');
    await expect(page.getByTestId('family-chart')).toBeVisible();
    await page.getByTestId('family-root-fa-1').click();

    await expect(page.getByTestId('family-drawer')).toBeVisible();
    await expect(page.getByTestId('family-panel')).toBeVisible();
    await expect(page.locator('.mat-drawer-backdrop.mat-drawer-shown')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

    // Click the visible backdrop strip left of the drawer: its center point sits
    // under the drawer panel, so a default center click never hits the backdrop.
    await page.locator('.mat-drawer-backdrop.mat-drawer-shown').click({ position: { x: 12, y: 320 } });
    await expect(page.getByTestId('family-chart')).toBeVisible();
    await expect(page.getByTestId('family-panel')).toHaveCount(0);
  });

  test('offers a prefilled removal-request mailto on a published family', async ({ page }) => {
    const link = page.locator('.removal-link');
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).not.toBeNull();
    expect(href!.startsWith('mailto:eric@lecoursville.com')).toBe(true);
    expect(href).toContain('Ferland');
  });

  test('shows the unavailable state for an unpublished family', async ({ page }) => {
    await page.goto('/family-explorer/wolf');
    const empty = page.getByTestId('family-explorer-empty');
    await expect(empty).toBeVisible();
    await expect(page.locator('[role="status"]').filter({ hasText: 'This family archive is not available' })).toBeVisible();
    await expect(page.getByTestId('family-chart')).toHaveCount(0);
    await expect(page.getByTestId('family-skeleton')).toHaveCount(0);
    await expect(page.locator('mat-toolbar')).toHaveCount(0);
  });

  test('shows the unavailable state for a missing family', async ({ page }) => {
    await page.goto('/family-explorer/nosuch');
    const empty = page.getByTestId('family-explorer-empty');
    await expect(empty).toBeVisible();
    await expect(page.locator('[role="status"]').filter({ hasText: 'This family archive is not available' })).toBeVisible();
    await expect(page.getByTestId('family-chart')).toHaveCount(0);
    await expect(page.getByTestId('family-skeleton')).toHaveCount(0);
    await expect(page.locator('mat-toolbar')).toHaveCount(0);
  });
});
