import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_XLSX = resolve(__dirname, 'fixtures/sample.xlsx');

// sample.xlsx migrates to two active people (Me/Partner), giving us a household
// with more than one person to assign stock-option company ownership to.
test.describe('Stock options ownership', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.locator('input[type="file"]').setInputFiles(LEGACY_XLSX);
    await page.waitForURL(/\/overview/);

    // Enable the stock options feature.
    await page.locator('a[href="/pfs-tool/settings"]').click();
    await page.waitForURL(/\/settings$/);
    await expect(page.getByText('Enable Stock Options tab')).toBeVisible();
    const stockOptionsCheckbox = page.getByRole('checkbox');
    await stockOptionsCheckbox.click();
    await expect(stockOptionsCheckbox).toBeChecked();
  });

  test('a new company defaults its owner to the primary person', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/options/manage"]').click();
    await page.waitForURL(/\/options\/manage/);

    await page.getByRole('button', { name: /add company/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Owner' })).toContainText('Me');
  });

  test('changing the owner is reflected on the company card', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/options/manage"]').click();
    await page.waitForURL(/\/options\/manage/);

    await page.getByRole('button', { name: /add company/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill('Acme Corp');
    await dialog.getByRole('combobox', { name: 'Owner' }).click();
    await page.getByRole('option', { name: 'Partner', exact: true }).click();
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).not.toBeVisible();

    const companyRow = page.locator('section', { hasText: 'Acme Corp' });
    await expect(companyRow).toContainText('Partner');
  });

  test('a company is only visible to its owner unless viewing as household', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/options/manage"]').click();
    await page.waitForURL(/\/options\/manage/);

    await page.getByRole('button', { name: /add company/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill('Partner Equity Co');
    await dialog.getByRole('combobox', { name: 'Owner' }).click();
    await page.getByRole('option', { name: 'Partner', exact: true }).click();
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).not.toBeVisible();

    await page.locator('a[href="/pfs-tool/options"]').first().click();
    await page.waitForURL(/\/options$/);

    // Default viewer is Me — the company belongs to Partner, so it shouldn't show.
    await expect(page.getByText('Partner Equity Co')).not.toBeVisible();
    await expect(page.getByText(/no equity positions tracked/i)).toBeVisible();

    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Partner', exact: true }).click();
    await expect(page.getByText('Partner Equity Co')).toBeVisible();

    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Household' }).click();
    await expect(page.getByText('Partner Equity Co')).toBeVisible();
  });
});
