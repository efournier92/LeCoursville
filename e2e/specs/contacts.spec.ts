import { test, expect } from '../helpers/fixture';
import { login } from '../helpers/auth';
import { expectNoHorizontalOverflow } from '../helpers/overflow';
import { expectMinTouchTarget } from '../helpers/touch';

// The contacts page is a people-derived directory (people + families in RTDB).
// The legacy `contacts` node and its admin fixup surface are retired.

test.describe('contacts', () => {
  test('top bars do not overflow horizontally at 900px and 768px', async ({ page }) => {
    await login(page, 'admin');
    const original = page.viewportSize()!;
    try {
      for (const width of [900, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/contacts');
        await expectNoHorizontalOverflow(page.locator('app-page-toolbar .page-toolbar'));
        await expectNoHorizontalOverflow(page.locator('mat-toolbar'));
      }
    } finally {
      await page.setViewportSize(original);
    }
  });

  test('list renders the seeded people as contact cards', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown').first()).toBeVisible();
    await expect(page.getByText('Carol Clark').first()).toBeVisible();
    await expect(page.getByText('Dave Davis').first()).toBeVisible();
  });

  test('search filters the list by name substring', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.getByLabel('Filter').fill('Alice');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('empty state: nonsense search shows no-results message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.getByLabel('Filter').fill('zzznope');
    await expect(
      page.getByText('We couldn\'t find any contacts matching "zzznope".'),
    ).toBeVisible();
  });

  test('family filter narrows the list', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    await page.locator('.family-filter-form-field mat-select').click({ force: true });
    await page.getByRole('option', { name: 'Alder' }).click();
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('?clan= alias applies the family filter', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts?clan=Alder');
    await expect(page.getByText('Alice Anderson').first()).toBeVisible();
    await expect(page.getByText('Ben Brown')).toHaveCount(0);
  });

  test('a spouse appears only in the merged household card', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    const carolCard = page.locator('.contact-card', { hasText: 'Carol Clark' }).first();
    await expect(carolCard).toBeVisible();
    await expect(carolCard).toContainText('Dave Davis');
    // Dave has his own contact info, but must not render a second card.
    await expect(page.locator('.contact-card', { hasText: 'Dave Davis' })).toHaveCount(1);
  });

  test('hovering one spouse underlines only that name', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    const card = page.locator('.contact-card', { hasText: 'Carol Clark' }).first();
    const carol = card.locator('.clickable-name').filter({ hasText: 'Carol Clark' });
    const dave = card.locator('.clickable-name').filter({ hasText: 'Dave Davis' });
    await expect(carol).toBeVisible();
    await expect(dave).toBeVisible();
    await expect(dave).toHaveCSS('text-decoration-line', 'none');

    await carol.hover();

    await expect(carol).toHaveCSS('text-decoration-line', 'underline');
    await expect(dave).toHaveCSS('text-decoration-line', 'none');
  });

  test('deep link /contacts/:id opens that person modal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts/person-a');
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
  });

  test('contact detail: clicking a name opens the person modal', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contacts');
    const aliceCard = page.locator('.contact-card', { hasText: 'Alice Anderson' }).first();
    await aliceCard.locator('.clickable-name').first().click();
    await expect(page.locator('app-person-detail-modal h2')).toContainText('Alice Anderson');
    await expect(page.locator('app-person-detail-modal')).toContainText('Alder');
  });
});

test.describe('mobile touch targets', () => {
  test('contact list fits 320px with 24px email targets', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page, 'user');
    await page.goto('/contacts');
    await expect(page.locator('.contacts-grid')).toBeVisible();
    await expectNoHorizontalOverflow(page.locator('.app-container'));
    await expectMinTouchTarget(page, '.email-value');
  });
});

test.describe('mobile convergence', () => {
  test('contacts filter field spans the controls card at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page, 'user');
    await page.goto('/contacts');
    const card = page.locator('.page-toolbar');
    const field = card.locator('.filter-people-form-field');
    await expect(field).toBeVisible();
    const contentWidth = await card.evaluate((el) => {
      const style = getComputedStyle(el);
      return (
        el.getBoundingClientRect().width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight)
      );
    });
    const fieldWidth = await field.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(fieldWidth - contentWidth)).toBeLessThanOrEqual(2);
  });
});
