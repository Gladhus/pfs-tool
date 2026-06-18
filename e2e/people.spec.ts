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
