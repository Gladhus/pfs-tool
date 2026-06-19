import { test, expect } from '@playwright/test';

test.describe('People settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: /new xlsx file/i }).click();
    await page.waitForURL(/\/overview/);
    await page.locator('a[href="/pfs-tool/settings"]').click();
    await page.locator('a[href="/pfs-tool/settings/people"]').click();
    await page.waitForURL(/\/settings\/people/);
  });

  test('lists the default Me/Partner people, with Me flagged as primary', async ({ page }) => {
    await expect(page.locator('main').locator('button', { hasText: 'Me' })).toBeVisible();
    await expect(page.locator('main').locator('button', { hasText: 'Partner' })).toBeVisible();
    await expect(page.getByText('Primary owner')).toBeVisible();
  });

  test('the primary owner cannot be archived', async ({ page }) => {
    await page.locator('main').locator('button', { hasText: 'Me' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /^archive$/i })).not.toBeVisible();
    await expect(page.getByText(/can't be archived/i)).toBeVisible();
  });

  test('a non-primary person can be archived and reactivated', async ({ page }) => {
    await page.locator('main').locator('button', { hasText: 'Partner' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /^archive$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const partnerRow = page.locator('main').locator('button', { hasText: 'Partner' });
    await expect(partnerRow).toContainText('Archived');

    await partnerRow.click();
    await page.getByRole('button', { name: /^reactivate$/i }).click();
    await expect(partnerRow).not.toContainText('Archived');
  });

  test('adding a new person shows it in the list', async ({ page }) => {
    await page.getByRole('button', { name: /add person/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').locator('input').first().fill('Alex');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Alex', { exact: true })).toBeVisible();
  });
});

test.describe('Archiving blocked by active ownership', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: /new xlsx file/i }).click();
    await page.waitForURL(/\/overview/);
  });

  test('a person owning an active account cannot be archived until ownership is removed', async ({ page }) => {
    // Give Partner sole ownership of a brand-new account.
    await page.locator('a[href*="/pfs-tool/portfolio"]').first().click();
    await page.getByRole('link', { name: 'Manage', exact: true }).click();
    await page.waitForURL(/\/portfolio\/manage/);
    await page.getByRole('button', { name: /add account/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').locator('input').first().fill('Partner Savings');
    await page.getByRole('combobox', { name: 'Owner' }).click();
    await page.getByRole('option', { name: 'Partner', exact: true }).click();
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Partner now has an active claim — archiving must be blocked.
    await page.locator('a[href="/pfs-tool/settings"]').click();
    await page.locator('a[href="/pfs-tool/settings/people"]').click();
    await page.waitForURL(/\/settings\/people/);
    await page.locator('main').locator('button', { hasText: 'Partner' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /^archive$/i })).not.toBeVisible();
    await expect(page.getByText(/still owns active accounts/i)).toBeVisible();
    await page.keyboard.press('Escape');

    // Reassign the account to Me — Partner has no more active claims, archiving is allowed again.
    await page.locator('a[href*="/pfs-tool/portfolio"]').first().click();
    await page.getByRole('link', { name: 'Manage', exact: true }).click();
    await page.waitForURL(/\/portfolio\/manage/);
    await page.locator('button', { hasText: 'Partner Savings' }).click();
    await page.getByRole('combobox', { name: 'Owner' }).click();
    await page.getByRole('option', { name: 'Me', exact: true }).click();
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.locator('a[href="/pfs-tool/settings"]').click();
    await page.locator('a[href="/pfs-tool/settings/people"]').click();
    await page.waitForURL(/\/settings\/people/);
    await page.locator('main').locator('button', { hasText: 'Partner' }).click();
    await expect(page.getByRole('button', { name: /^archive$/i })).toBeVisible();
  });
});

test.describe('Negative ownership share validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: /new xlsx file/i }).click();
    await page.waitForURL(/\/overview/);
    await page.locator('a[href*="/pfs-tool/portfolio"]').first().click();
    await page.getByRole('link', { name: 'Manage', exact: true }).click();
    await page.waitForURL(/\/portfolio\/manage/);
  });

  test('typing a negative share clamps it to 0', async ({ page }) => {
    await page.getByRole('button', { name: /add account/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill('Split Account');
    await dialog.getByRole('checkbox').first().click();
    const meShare = dialog.locator('div', { hasText: /^Me$/ }).locator('input[type="number"]');
    await meShare.fill('-25');
    await meShare.blur();
    await expect(meShare).toHaveValue('0');
  });
});
