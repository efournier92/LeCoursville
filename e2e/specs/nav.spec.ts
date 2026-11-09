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
      ['Account', '/'],
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
    const before = page.url();
    if (browserName === 'webkit') {
      // Playwright's WebKit does not open a tab for a synthesized middle click.
      // Assert the native anchor contract that makes the browser do it.
      await expect(calendar).toHaveAttribute('href', '/calendar');
      await expect(calendar).not.toHaveAttribute('target', '_blank');
      return;
    }
    const [opened] = await Promise.all([
      context.waitForEvent('page'),
      calendar.click({ button: 'middle' }),
    ]);
    await opened.waitForLoadState('domcontentloaded');
    await expect(opened).toHaveURL(/\/calendar$/);
    // The original page never navigates for a middle click.
    await expect(page).toHaveURL(before);
    await opened.close();
  });

  test('modifier click opens a new tab and leaves the current page unchanged', async ({ page, context, browserName }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    const before = page.url();
    // macOS Chromium/WebKit use Cmd for a new tab; Firefox and other platforms use Ctrl.
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    if (browserName === 'firefox') {
      // Playwright's Firefox does not open a tab for a synthesized modifier click.
      // Assert the native anchor contract that makes a real browser do it.
      const calendar = nav.getByRole('link', { name: 'Calendar' });
      await expect(calendar).toHaveAttribute('href', '/calendar');
      await expect(calendar).not.toHaveAttribute('target', '_blank');
      return;
    }
    const [opened] = await Promise.all([
      context.waitForEvent('page'),
      nav.getByRole('link', { name: 'Calendar' }).click({ modifiers: [modifier] }),
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
  });

  test('mobile menu items are anchors with real hrefs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'user');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const menu = page.locator('.mat-mdc-menu-panel');
    await expect(menu).toBeVisible();
    const people = menu.getByRole('menuitem', { name: 'People' });
    await expect(people).toHaveAttribute('href', '/people');
  });
});

test.describe('mobile page toolbars', () => {
  const routes: { path: string; title?: string }[] = [
    { path: '/admin/people', title: 'People' },
    { path: '/people', title: 'People' },
    { path: '/calendar', title: 'Calendar' },
    // The photo albums toolbar has no title, only projected filter controls.
    { path: '/photos' },
  ];

  for (const route of routes) {
    test(`toolbar on ${route.path} stacks left at phone width`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, 'admin');
      await page.goto(route.path);
      const toolbar = page.locator('.page-toolbar');
      await expect(toolbar).toBeVisible();
      if (route.title) {
        await expect(toolbar.locator('.page-toolbar-title')).toHaveText(route.title);
      }
      await expect(toolbar).toHaveCSS('flex-direction', 'column');
      await expect(toolbar).toHaveCSS('align-items', 'stretch');
      await expect(toolbar).toHaveCSS('row-gap', '8px');

      const content = toolbar.locator('.page-toolbar-content');
      if (await content.count()) {
        await expect(content).toHaveCSS('justify-content', 'flex-start');
        await expect(content).toHaveCSS('margin-left', '0px');
        await expect(content).toHaveCSS('align-items', 'center');
      }

      const box = (await toolbar.boundingBox())!;
      const inset = await toolbar.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft));
      const left = box.x + inset;
      for (const selector of ['.page-toolbar-left', '.page-toolbar-content']) {
        const child = toolbar.locator(selector);
        if (!(await child.count())) continue;
        const childBox = (await child.boundingBox())!;
        expect(Math.abs(childBox.x - left)).toBeLessThanOrEqual(1);
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
      'admin-nav-link-contacts',
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

  test('super admin sidebar shows Contacts (People) and Expressions (Content)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    const nav = page.getByTestId('admin-nav');
    const contacts = nav.getByTestId('admin-nav-link-contacts');
    await expect(contacts).toBeVisible();
    await expect(contacts).toHaveText(/Contacts/);
    await expect(
      page.getByTestId('admin-nav-group-people').locator('.admin-nav-link-contacts, [data-testid="admin-nav-link-contacts"]'),
    ).toHaveCount(1);
    const expressions = nav.getByTestId('admin-nav-link-expressions');
    await expect(expressions).toBeVisible();
    await expect(expressions).toHaveText(/Expressions/);
    await expect(
      page.getByTestId('admin-nav-group-content').locator('[data-testid="admin-nav-link-expressions"]'),
    ).toHaveCount(1);
    // The entries navigate to their admin routes.
    await contacts.click();
    await expect(page).toHaveURL(/\/admin\/contacts/);
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
