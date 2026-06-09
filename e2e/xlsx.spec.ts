import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_XLSX = resolve(__dirname, 'fixtures/sample.xlsx');

test.describe('XLSX file upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_XLSX);
    await page.waitForURL(/\/overview/);
  });

  test('redirects to overview after upload', async ({ page }) => {
    await expect(page).toHaveURL(/\/overview/);
  });

  test('shows populated overview (not empty state)', async ({ page }) => {
    await expect(page.locator('a[href="/pfs-tool/entry"]')).not.toBeVisible();
    await expect(page.getByText('Allocation')).toBeVisible();
  });

  test('shows XLSX banner with filename', async ({ page }) => {
    await expect(page.getByText(/sample\.xlsx/i)).toBeVisible();
  });

  test('period pills are visible', async ({ page }) => {
    await expect(page.getByRole('radio', { name: '1Y' }).first()).toBeVisible();
  });

  test('shows investment category card', async ({ page }) => {
    await expect(page.getByText('Investments').first()).toBeVisible();
  });

  test('navigates to portfolio history', async ({ page }) => {
    await page.locator('a[href*="/pfs-tool/portfolio"]').first().click();
    await expect(page).toHaveURL(/\/portfolio/);
  });

  test('stays on overview after page refresh', async ({ page }) => {
    await page.reload();
    await expect(page).toHaveURL(/\/overview/);
    await expect(page.getByText('Allocation')).toBeVisible();
  });
});
