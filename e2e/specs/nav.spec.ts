import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';

test.describe('navigation', () => {
  test('logged-out toolbar shows no feature links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#lecoursville-navbar-links')).toHaveCount(0);
  });

  test('root sign-in route hides the redundant toolbar Sign In link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' })).toHaveCount(0);
  });

  test('signed-out non-root route keeps the toolbar Sign In link', async ({ page }) => {
    await page.goto('/feature-disabled');
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  test('logged-in nav shows enabled features and never the Admin entry', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    await expect(nav.getByRole('link', { name: 'People' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Contacts' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Calendar' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Songs' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Audio' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Videos' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Photos' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Expressions' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Upload' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Account' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Chat' })).toHaveCount(0);
    // Family Explorer is a URL-shared public page, never app chrome.
    await expect(nav.getByRole('link', { name: 'Family Explorer' })).toHaveCount(0);
    await expect(nav.getByTestId('nav-admin-link')).toHaveCount(0);
  });

  test('Songs navigates to /songs and Audio still opens the audio library', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    await expect(nav.getByRole('link', { name: 'Songs' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Audio' })).toBeVisible();

    await nav.getByRole('link', { name: 'Songs' }).click();
    await expect(page).toHaveURL(/\/songs/);

    await nav.getByRole('link', { name: 'Audio' }).click();
    await expect(page).toHaveURL(/\/media\/audio/);
  });

  test('cached session renders nav links immediately, never Sign In', async ({ page }) => {
    await login(page, 'user');
    // Hold every RTDB websocket so the reload boots with a cached session
    // whose RTDB user record cannot load: the nav must still render the
    // links instantly from the localStorage cache.
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    await page.routeWebSocket(/ws:\/\/[^/]*:9000\/.*/, async ws => {
      await gate;
      ws.connectToServer();
    });

    await page.reload();
    // Cache-first: navbar-links renders instantly with its flags skeleton;
    // the auth skeleton and Sign In must never appear for a cached session.
    await expect(page.getByTestId('nav-flags-skeleton')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' })).toHaveCount(0);
    await expect(page.getByTestId('nav-links-skeleton')).toHaveCount(0);

    release();
    // Flags resolve and the real links render.
    await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();
    await expect(page.getByTestId('nav-flags-skeleton')).toHaveCount(0);
  });

  test('the mobile member hamburger has an accessible name and opens the menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'user');
    // The member twin of the admin toggle must not be an unnamed icon button.
    const hamburger = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    await expect(page.locator('.mat-mdc-menu-panel')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Songs' })).toBeVisible();
  });

  test('at 600px the inline links are hidden and the hamburger carries them', async ({ page }) => {
    await login(page, 'admin');
    await page.setViewportSize({ width: 600, height: 800 });
    // Below lg the inline nav collapses; only the hamburger shows.
    await expect(page.locator('#lecoursville-navbar-links')).toBeHidden();
    const hamburger = page.locator('.icons-menu .menu-icon-container');
    await expect(hamburger).toBeVisible();
    // The hamburger menu carries the same links.
    await hamburger.click();
    const menu = page.locator('.toolbar-routes-menu');
    // mat-menu items carry role=menuitem, not button.
    await expect(menu.getByRole('menuitem', { name: 'People' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Calendar' })).toBeVisible();
  });

  test('active nav button shows a 3px bar flush with the toolbar bottom', async ({ page }) => {
    await login(page, 'admin');
    await page.locator('#lecoursville-navbar-links').getByRole('link', { name: 'People' }).click();
    await expect(page).toHaveURL(/\/people/);

    const bar = page.locator('a.active .active-indicator');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveCSS('height', '3px');

    const barBox = (await bar.boundingBox())!;
    const toolbarBox = (await page.locator('mat-toolbar').first().boundingBox())!;
    // Flush: the bar's bottom edge sits on the toolbar's bottom edge.
    expect(Math.abs(barBox.y + barBox.height - (toolbarBox.y + toolbarBox.height))).toBeLessThanOrEqual(1);
    // Full-width: the bar spans the active button (icon + label + padding).
    const buttonBox = (await page.locator('a.active').boundingBox())!;
    expect(Math.abs(barBox.width - buttonBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(barBox.x - buttonBox.x)).toBeLessThanOrEqual(1);
  });

  test('nav link computed font-size is 15px', async ({ page }) => {
    await login(page, 'admin');
    const people = page.locator('#lecoursville-navbar-links').getByRole('link', { name: 'People' });
    await expect(people).toBeVisible();
    await expect(people).toHaveCSS('font-size', '15px');
  });

  test('toolbar renders the elevation-8 drop shadow', async ({ page }) => {
    await login(page, 'admin');
    const toolbar = page.locator('mat-toolbar').first();
    await expect(toolbar).toBeVisible();
    const boxShadow = await toolbar.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).toContain('rgba(0, 0, 0, 0.2)');
  });

  test('clicking each toolbar link navigates to its route', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    const links: [string, RegExp][] = [
      ['People', /\/people/],
      ['Contacts', /\/contacts/],
      ['Calendar', /\/calendar/],
      ['Songs', /\/songs/],
      ['Audio', /\/media\/audio/],
      ['Videos', /\/media\/video/],
      ['Photos', /\/photos/],
      ['Expressions', /\/expressions/],
      ['Upload', /\/upload/],
    ];
    for (const [label, url] of links) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(nav).toBeVisible();
    }
  });

  test('desktop nav anchors expose hrefs matching their routes', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    const links: [string, string][] = [
      ['People', '/people'],
      ['Contacts', '/contacts'],
      ['Calendar', '/calendar'],
      ['Songs', '/songs'],
      ['Audio', '/media/audio'],
      ['Videos', '/media/video'],
      ['Photos', '/photos'],
      ['Expressions', '/expressions'],
      ['Upload', '/upload'],
      ['Account', '/account'],
    ];
    for (const [label, href] of links) {
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  test('middle click opens the nav target in a new page', async ({ page, context, browserName }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    // Calendar is the admin promoted route, so a fresh tab's auth boot cannot
    // race the assertion by bouncing a deep link to the promoted route.
    const calendar = nav.getByRole('link', { name: 'Calendar' });
    // Pin the signed-in landing route before capturing it as the "unchanged"
    // baseline; login's own redirect can still be in flight on a cold start.
    await expect(page).toHaveURL(/\/calendar$/);
    const before = page.url();
    // A real href with no target override is what lets a browser open a page;
    // assert that contract on every engine before exercising the gesture.
    await expect(calendar).toHaveAttribute('href', '/calendar');
    await expect(calendar).not.toHaveAttribute('target', '_blank');

    const openedPromise = context.waitForEvent('page', { timeout: 2000 }).catch(() => null);
    await calendar.click({ button: 'middle' });
    const opened = await openedPromise;
    if (browserName === 'chromium') {
      expect(opened).not.toBeNull();
    }
    if (opened) {
      await opened.waitForLoadState('domcontentloaded');
      await expect(opened).toHaveURL(/\/calendar$/);
      await opened.close();
      // The original page never navigates when a page opens.
      await expect(page).toHaveURL(before);
    }
    // Playwright's WebKit and Firefox do not open a page for a synthesized
    // middle click; they follow the href in place. The href/target contract
    // asserted above is the new-tab guarantee for a real browser on those
    // engines.
  });

  test('modifier click opens a new tab and leaves the current page unchanged', async ({ page, context }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    const calendar = nav.getByRole('link', { name: 'Calendar' });
    await expect(page).toHaveURL(/\/calendar$/);
    const before = page.url();
    await expect(calendar).toHaveAttribute('href', '/calendar');
    await expect(calendar).not.toHaveAttribute('target', '_blank');
    // macOS Chromium/Firefox/WebKit use Cmd for a new tab; Firefox on other
    // platforms uses Ctrl.
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    const [opened] = await Promise.all([
      context.waitForEvent('page'),
      calendar.click({ modifiers: [modifier] }),
    ]);
    await opened.waitForLoadState('domcontentloaded');
    await expect(opened).toHaveURL(/\/calendar$/);
    await expect(page).toHaveURL(before);
    await opened.close();
  });

  test('plain click navigates in place and marks the anchor active', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    await nav.getByRole('link', { name: 'People' }).click();
    await expect(page).toHaveURL(/\/people/);
    await expect(nav.getByRole('link', { name: 'People' })).toHaveClass(/active/);
    await expect(nav.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
  });

  test('mobile menu items are anchors with real hrefs, navigate, and mark active', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'user');
    const openMenu = page.getByRole('button', { name: 'Open navigation menu' });
    await openMenu.click();
    const menu = page.locator('.mat-mdc-menu-panel');
    await expect(menu).toBeVisible();
    const links: [string, string][] = [
      ['People', '/people'],
      ['Contacts', '/contacts'],
      ['Calendar', '/calendar'],
      ['Songs', '/songs'],
      ['Audio', '/media/audio'],
      ['Videos', '/media/video'],
      ['Photos', '/photos'],
      ['Expressions', '/expressions'],
      ['Upload', '/upload'],
      ['Account', '/account'],
    ];
    for (const [label, href] of links) {
      await expect(menu.getByRole('menuitem', { name: label })).toHaveAttribute('href', href);
    }

    await menu.getByRole('menuitem', { name: 'People' }).click();
    await expect(page).toHaveURL(/\/people$/);
    await openMenu.click();
    await expect(page.locator('.mat-mdc-menu-panel')).toBeVisible();
    const active = page.locator('.mat-mdc-menu-panel').getByRole('menuitem', { name: 'People' });
    await expect(active).toHaveClass(/active/);
    await expect(active).toHaveAttribute('aria-current', 'page');
  });

  test('mobile menu items activate on Space', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'user');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const calendar = page.locator('.mat-mdc-menu-panel').getByRole('menuitem', { name: 'Calendar' });
    await calendar.focus();
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(/\/calendar$/);
  });
});

test.describe('mobile page toolbars', () => {
  const routes: { path: string; title?: string }[] = [
    { path: '/admin/people', title: 'People' },
    { path: '/people', title: 'People' },
    { path: '/calendar', title: 'Calendar' },
    { path: '/photos', title: 'Photos' },
  ];

  for (const route of routes) {
    test(`toolbar on ${route.path} stacks left at phone width`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, 'admin');
      await page.goto(route.path);
      expect(new URL(page.url()).pathname).toBe(route.path);
      const toolbar = page.locator('.page-toolbar');
      await expect(toolbar).toBeVisible();
      if (route.title) {
        const title = toolbar.locator('.page-toolbar-title');
        await expect(title).toHaveText(route.title);
        await expect(title).toHaveCSS('text-align', 'left');
      }
      await expect(toolbar).toHaveCSS('flex-direction', 'column');
      await expect(toolbar).toHaveCSS('align-items', 'stretch');
      await expect(toolbar).toHaveCSS('row-gap', '8px');

      const content = toolbar.locator('.page-toolbar-content');
      await expect(content).toBeVisible();
      await expect(content).toHaveCSS('justify-content', 'flex-start');
      await expect(content).toHaveCSS('margin-left', '0px');
      await expect(content).toHaveCSS('align-items', 'center');

      const box = (await toolbar.boundingBox())!;
      const inset = await toolbar.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft));
      const left = box.x + inset;
      for (const selector of ['.page-toolbar-left', '.page-toolbar-content']) {
        const child = toolbar.locator(selector);
        if (!(await child.count())) continue;
        const childBox = (await child.boundingBox())!;
        expect(Math.abs(childBox.x - left)).toBeLessThanOrEqual(1);
      }

      // The title cluster sits above the tools cluster, not beside it.
      const leftBox = (await toolbar.locator('.page-toolbar-left').boundingBox())!;
      const contentBox = (await content.boundingBox())!;
      expect(leftBox.y + leftBox.height).toBeLessThanOrEqual(contentBox.y + 1);

      // Every projected control stays within the cluster and the first starts
      // at its left edge; wrapped rows keep their left anchor.
      const children = content.locator(':scope > *');
      const childCount = await children.count();
      expect(childCount).toBeGreaterThan(0);
      const firstChildBox = (await children.first().boundingBox())!;
      expect(Math.abs(firstChildBox.x - contentBox.x)).toBeLessThanOrEqual(1);
      for (let i = 0; i < childCount; i++) {
        const childBox = (await children.nth(i).boundingBox())!;
        expect(childBox.x).toBeGreaterThanOrEqual(contentBox.x - 1);
        expect(childBox.width).toBeLessThanOrEqual(contentBox.width + 1);
      }

      if (route.title) {
        const titleBox = (await toolbar.locator('.page-toolbar-title').boundingBox())!;
        expect(Math.abs(titleBox.x - left)).toBeLessThanOrEqual(1);
      }
    });
  }

  test('admin filter bar stacks and left-aligns its actions at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');
    await page.goto('/admin/users');
    const bar = page.locator('.admin-filter-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveCSS('flex-direction', 'column');
    await expect(bar).toHaveCSS('align-items', 'stretch');

    const actions = bar.locator('.admin-filter-actions');
    await expect(actions).toHaveCSS('justify-content', 'flex-start');
    await expect(actions).toHaveCSS('margin-left', '0px');
    await expect(actions).toHaveCSS('flex-basis', '100%');

    // DOM and Tab order match the stacked reading order: search before actions.
    const slotOrder = await bar.evaluate(el => Array.from(el.children).map(child => child.className));
    expect(slotOrder[0]).toContain('admin-filter-search');
    expect(slotOrder[1]).toContain('admin-filter-actions');
    const searchFirst = await bar.evaluate(el => {
      const focusable = el.querySelectorAll<HTMLElement>('input, button, a[href]');
      return focusable[0]?.closest('.admin-filter-search') !== null;
    });
    expect(searchFirst).toBe(true);

    const box = (await bar.boundingBox())!;
    const inset = await bar.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft));
    const actionsBox = (await actions.boundingBox())!;
    expect(Math.abs(actionsBox.x - (box.x + inset))).toBeLessThanOrEqual(1);
    // The action buttons keep natural width: they are not stretched edge to edge.
    const firstButton = actions.locator('button').first();
    const firstBox = (await firstButton.boundingBox())!;
    expect(firstBox.width).toBeLessThan(actionsBox.width);
    // The first control sits one border-width in from the row's content edge.
    expect(Math.abs(firstBox.x - (box.x + inset))).toBeLessThanOrEqual(3);
  });

  test('photo album filter actions wrap without clipping at phone widths', async ({ page }) => {
    await login(page, 'admin');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/admin/photo-albums');
      await expect(page.getByText('E2E Album One')).toBeVisible();
      const bar = page.locator('.admin-filter-bar');
      const actions = bar.locator('.admin-filter-actions');
      await expect(actions).toHaveCSS('flex-wrap', 'wrap');

      const barBox = (await bar.boundingBox())!;
      const insetRight = await bar.evaluate(el => parseFloat(getComputedStyle(el).paddingRight));
      const contentRight = barBox.x + barBox.width - insetRight;
      const controls = actions.locator(':scope > *');
      const count = await controls.count();
      expect(count).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < count; i++) {
        const controlBox = (await controls.nth(i).boundingBox())!;
        expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(contentRight + 1);
      }
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });

  test('mobile menu anchors and photos toolbar controls meet the 44px hit area', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const menu = page.locator('.mat-mdc-menu-panel');
    await expect(menu).toBeVisible();
    const items = menu.getByRole('menuitem');
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThan(0);
    // The menu scales in; wait for the real height before measuring it.
    await expect.poll(async () => (await items.first().boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    for (let i = 0; i < itemCount; i++) {
      const box = (await items.nth(i).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const firstItem = items.first();
    await firstItem.focus();
    await expect(firstItem).toBeFocused();
    expect(await firstItem.evaluate(el => el.matches(':focus'))).toBe(true);
    await page.keyboard.press('Escape');

    await page.goto('/photos');
    await expect(page.locator('.page-toolbar')).toBeVisible();
    const controls = page.locator(
      '.page-toolbar .gallery-search-clear, .page-toolbar .gallery-segmented-btn, .page-toolbar .gallery-primary-btn',
    );
    const controlCount = await controls.count();
    expect(controlCount).toBeGreaterThan(0);
    for (let i = 0; i < controlCount; i++) {
      const box = (await controls.nth(i).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const segment = page.locator('.page-toolbar .gallery-segmented-btn').first();
    await segment.focus();
    await expect(segment).toBeFocused();
    expect(await segment.evaluate(el => el.matches(':focus'))).toBe(true);
  });
});

test.describe('admin sidebar navigation', () => {
  test('super admin sidebar orders System, People, Content and their items', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin');
    const nav = page.getByTestId('admin-nav');
    await expect(nav).toHaveAttribute('aria-busy', 'false');

    const labels = await nav.locator('.sidebar-group-label').allTextContents();
    expect(labels).toEqual(['System', 'People', 'Content']);

    const ids = (group: string) =>
      nav.locator(`[data-testid="admin-nav-group-${group}"] [data-testid^="admin-nav-link-"]`)
        .evaluateAll(elements => elements.map(element => element.getAttribute('data-testid')));
    expect(await ids('system')).toEqual([
      'admin-nav-link-features',
      'admin-nav-link-analytics',
      'admin-nav-link-users',
      'admin-nav-link-recovery',
    ]);
    expect(await ids('people')).toEqual([
      'admin-nav-link-families',
      'admin-nav-link-people',
    ]);
    expect(await ids('content')).toEqual([
      'admin-nav-link-uploads',
      'admin-nav-link-media',
      'admin-nav-link-expressions',
      'admin-nav-link-songs',
      'admin-nav-link-familyExplorer',
    ]);
  });

  test('a content admin sees People first; the empty System group is skipped', async ({ page }) => {
    await login(page, 'staff');
    await page.goto('/admin/families');
    const nav = page.getByTestId('admin-nav');
    await expect(nav).toHaveAttribute('aria-busy', 'false');
    expect(await nav.locator('.sidebar-group-label').allTextContents()).toEqual(['People', 'Content']);
  });

  test('super admin sidebar drops retired Contacts and keeps Expressions (Content)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    const nav = page.getByTestId('admin-nav');
    await expect(nav.getByTestId('admin-nav-link-contacts')).toHaveCount(0);
    await expect(
      page.getByTestId('admin-nav-group-people').locator('[data-testid="admin-nav-link-contacts"]'),
    ).toHaveCount(0);
    const expressions = nav.getByTestId('admin-nav-link-expressions');
    await expect(expressions).toBeVisible();
    await expect(expressions).toHaveText(/Expressions/);
    await expect(
      page.getByTestId('admin-nav-group-content').locator('[data-testid="admin-nav-link-expressions"]'),
    ).toHaveCount(1);
    await expressions.click();
    await expect(page).toHaveURL(/\/admin\/expressions/);
  });

  test('member navbar is unchanged by the admin route additions', async ({ page }) => {
    await login(page, 'user');
    const nav = page.locator('#lecoursville-navbar-links');
    await expect(nav.getByTestId('nav-admin-link')).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Expressions' })).toBeVisible();
  });
});
