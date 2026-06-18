import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_XLSX = resolve(__dirname, 'fixtures/sample.xlsx');

// sample.xlsx (built by global-setup.ts) is intentionally the *old* schema:
// accounts use owner/ownership_share columns (no `ownership` array) and there's
// no people tab at all. These tests confirm the app migrates that data on load
// instead of just tolerating it.
test.describe('Legacy data migration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.locator('input[type="file"]').setInputFiles(LEGACY_XLSX);
    await page.waitForURL(/\/overview/);
  });

  test('seeds default Me/Partner people when the people tab is missing', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/settings"]').click();
    await page.locator('a[href="/pfs-tool/settings/people"]').click();
    await page.waitForURL(/\/settings\/people/);

    await expect(page.getByText('Me', { exact: true })).toBeVisible();
    await expect(page.getByText('Partner', { exact: true })).toBeVisible();
    await expect(page.getByText('Primary owner')).toBeVisible();
  });

  test('migrates legacy owner/ownership_share columns into ownership labels', async ({ page }) => {
    await page.locator('a[href*="/pfs-tool/portfolio"]').first().click();
    await page.locator('a[href="/pfs-tool/portfolio/manage"]').click();
    await page.waitForURL(/\/portfolio\/manage/);

    // owner: 'self', ownership_share: 1.0 -> a single full owner, shown as just the name.
    await expect(page.locator('button', { hasText: 'TFSA 1' })).toContainText('Me');
    await expect(page.locator('button', { hasText: 'Checking' })).toContainText('Me');

    // owner: 'joint', ownership_share: 0.5 -> split between self and partner.
    await expect(page.locator('button', { hasText: 'Mortgage' })).toContainText('Me 50% · Partner 50%');
  });

  test('migrated data survives a reload (round-trips through the rewritten sheet)', async ({ page }) => {
    await page.locator('a[href*="/pfs-tool/portfolio"]').first().click();
    await page.locator('a[href="/pfs-tool/portfolio/manage"]').click();
    await page.waitForURL(/\/portfolio\/manage/);
    await expect(page.locator('button', { hasText: 'Mortgage' })).toContainText('Me 50% · Partner 50%');

    await page.reload();
    await expect(page.locator('button', { hasText: 'Mortgage' })).toContainText('Me 50% · Partner 50%');
    await expect(page.locator('button', { hasText: 'TFSA 1' })).toContainText('Me');
  });
});
