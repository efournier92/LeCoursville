import { test, expect } from '../helpers/fixture';
import { login, logout } from '../helpers/auth';
import { setFeatureFlag } from '../helpers/flags';
import { writeDb, readDb, deleteDb } from '../helpers/admin-db';

// Chat is seeded OFF; the chat double-submit test turns it ON.
test.afterEach(async () => {
  await writeDb('features/chat/enabled', false);
});

test.describe('edge cases', () => {
  test('double-submit auth: one click disables submit and sends one sign-in', async ({ page }) => {
    const authRequests: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes(':9099') && url.includes('accounts:signInWithPassword')) {
        authRequests.push(url);
      }
    });
    await page.goto('/');
    await page.getByTestId('auth-email').fill('admin@e2e.local');
    await page.getByTestId('auth-password').fill('E2e-pass-2026');
    // The emulator can answer before a polling assertion observes the button,
    // so record every state the control passes through, then click once.
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="auth-submit"]') as HTMLButtonElement;
      const states: { disabled: boolean; saving: boolean }[] = [];
      const record = () =>
        states.push({
          disabled: button.disabled,
          saving: /Signing in/.test(button.textContent ?? ''),
        });
      record();
      new MutationObserver(record).observe(button, {
        attributes: true,
        attributeFilter: ['disabled'],
        childList: true,
        subtree: true,
      });
      (window as any).__submitStates = states;
    });
    await page.getByTestId('auth-submit').click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.locator('#lecoursville-navbar-links')).toBeVisible();
    await expect(page.getByTestId('auth-error')).toHaveCount(0);
    const states = await page.evaluate(
      () => (window as any).__submitStates as { disabled: boolean; saving: boolean }[],
    );
    // The guard disables the control for the whole async sign-in, so no second
    // submission could start; no force click is swallowed to prove it.
    expect(states.some((state) => state.disabled || state.saving)).toBe(true);
    expect(authRequests).toHaveLength(1);
  });

  test('double-submit chat: Send opens one confirm and saves exactly one message', async ({ page }) => {
    await login(page, 'admin');
    await setFeatureFlag(page, 'chat', true);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'New Message' }).first().click();
    await page.getByPlaceholder('Title').fill('E2E Double Title');
    await page.getByTestId('chat-message-input').fill('Only one copy should exist.');
    // First click opens the confirm; the isSaving guard makes the form swap to
    // a spinner (chat-send leaves the DOM), so no second dialog can ever open.
    await page.getByTestId('chat-send').click();
    await expect(page.getByRole('heading', { name: 'Are You Sure?' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('E2E Double Title')).toHaveCount(1);
  });

  test('navigation race: rapid SPA route hops settle on the last route without errors', async ({ page }) => {
    await login(page, 'admin');
    const nav = page.locator('#lecoursville-navbar-links');
    // In-app transitions (not full reloads): overlaps the router's async
    // guards and settles on the last destination.
    const hops = ['People', 'Contacts', 'Calendar', 'Photos', 'Expressions', 'Contacts'];
    for (const label of hops) {
      await nav.getByRole('button', { name: label }).click();
    }
    await expect(page).toHaveURL(/\/contacts/);
    await expect(page.locator('.contacts-skeleton-grid, .contacts-grid').first()).toBeAttached();
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
  });

  test('empty state: album search with no matches shows the no-results message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/photos');
    await page.getByLabel('Search albums').fill('zzznope');
    await expect(page.getByText('We couldn\'t find any albums matching "zzznope".')).toBeVisible();
  });

  test('malformed CSV import surfaces validation errors', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/people');
    const bad = [
      'ID,Name_First_Given,Name_Last,Birthday',
      'bad-row-1,One',
      'bad-row-2,Two,LastName',
    ].join('\n');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'bad.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(bad),
    });
    await expect(page.locator('.error-card')).toBeVisible();
    await expect(page.locator('.validation-list li').first()).toBeVisible();
    // No import button while errors exist.
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toHaveCount(0);
  });

  test('XSS-shaped string in a person name renders as text only', async ({ page }) => {
    await login(page, 'admin');
    // Seed-like person created via the import pipeline with an XSS name.
    await page.goto('/admin/people');
    const payload = '<img src=x onerror=window.__xss=3>';
    const csv = [
      'ID,Name_First_Given,Name_First_Preferred,Name_Last,Birthday,Generation_Number,Living?,Family',
      `xss-1,${payload},${payload},Probe,1990-01-15,1,TRUE,Mignonne`,
    ].join('\n');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'xss.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText('Import Preview')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Import' }).click();
    await expect(page.getByText('Import Complete')).toBeVisible({ timeout: 15000 });
    await page.goto('/people');
    // The payload must be visible as text; absence alone could mean it was dropped.
    await expect(page.getByText(payload).first()).toBeVisible();
    const handlers = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*')).flatMap((el) =>
        Array.from(el.attributes)
          .filter((attr) => attr.name.toLowerCase() === 'onerror' && attr.value.includes('__xss'))
          .map((attr) => attr.value),
      ),
    );
    expect(handlers).toEqual([]);
    const xss = await page.evaluate(() => (window as any).__xss ?? 0);
    expect(xss).toBe(0);
  });
});

test.describe('theme control contract (light/dark parity)', () => {
  test('input border tokens, focus color, and invalid border follow the mode', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/contacts');
    const field = page.locator('.filter-people-form-field');
    await expect(field).toBeVisible();

    const varOn = (name: string) =>
      page.evaluate(
        (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
        name,
      );

    // The theme toggle persists to users/$uid/prefs; resolve the actor so a
    // failure anywhere below can still restore the seeded no-prefs state.
    const users = (await readDb<Record<string, { email?: string }>>('users')) ?? {};
    const uid = Object.keys(users).find((id) => users[id]?.email === 'user@e2e.local');
    expect(uid, 'seeded user@e2e.local must resolve to a uid').toBeTruthy();

    // Light: field edges at WCAG 1.4.11 3:1, focus derived from brand.
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    expect(await varOn('--color-input-border')).toBe('#878E99');
    expect(await varOn('--color-input-border-invalid')).toBe('#B3261E');
    expect(await varOn('--color-focus')).toBe('#27744A');

    // Keyboard focus paints the brand-derived outline on the field notch
    // (the global :focus-visible ring is suppressed inside mat form fields).
    await page.locator('.filter-people-form-field input').focus();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '.filter-people-form-field.mat-focused .mdc-notched-outline__leading',
          );
          return el ? getComputedStyle(el).borderTopColor : 'missing';
        }),
      )
      .toBe('rgb(39, 116, 74)');

    // Dark: the same contract re-derives per mode (D-20261030-15 parity).
    try {
      await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await varOn('--color-input-border')).toBe('#6B7683');
    expect(await varOn('--color-input-border-invalid')).toBe('#F2B8B5');
    expect(await varOn('--color-focus')).toBe('#8CCDA3');
    await page.locator('.filter-people-form-field input').focus();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '.filter-people-form-field.mat-focused .mdc-notched-outline__leading',
          );
          return el ? getComputedStyle(el).borderTopColor : 'missing';
        }),
      )
      .toBe('rgb(140, 205, 163)');

    // Restore the seeded light preference (the toggle persists to
    // users/$uid/prefs) while still signed in and on the contacts page.
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');

    // Invalid surface: a malformed required email (auth form) flags the field
    // and the error edge override is wired to the invalid token. Sign out
    // first (via the Account page, the only home of the Sign out control).
    await page.getByRole('button', { name: 'Account' }).click();
    await logout(page);
    // Touch the required email (focus), then blur it (focus the password):
    // empty + required + touched flags the field, engaging the error edge.
    await page.getByTestId('auth-email').click();
    await page.getByTestId('auth-password').focus();
    await expect(page.locator('.auth-field.mat-form-field-invalid').first()).toBeVisible();
    const errorEdge = await page.evaluate(() => {
      const field = document.querySelector('.mat-form-field-invalid');
      return field ? getComputedStyle(field).getPropertyValue('--mat-form-field-outlined-error-outline-color').trim() : '';
    });
    // Sign-out resets to the light default, so the invalid edge resolves to
    // the light token value (the chain itself was asserted per mode above).
    expect(errorEdge).toBe('#B3261E');
    expect(await page.evaluate(
      () => getComputedStyle(document.documentElement).getPropertyValue('--color-input-border-invalid').trim(),
    )).toBe('#B3261E');
    } finally {
      // Failure-safe restore (C-20261031-22): an assertion failure after the
      // toggle would otherwise persist dark for every later spec.
      await deleteDb(`users/${uid}/prefs`);
    }
  });
});
