import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_XLSX = resolve(__dirname, 'fixtures/sample.xlsx');

test.describe('Spending tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_XLSX);
    await page.waitForURL(/\/overview/);

    // Enable the spending feature.
    await page.locator('a[href="/pfs-tool/settings"]').click();
    await page.waitForURL(/\/settings$/);
    const spendingCheckbox = page.getByRole('checkbox', { name: 'Enable Spending tracker tab' });
    await spendingCheckbox.click();
    await expect(spendingCheckbox).toBeChecked();
  });

  test('the flag reveals the Spending nav tab', async ({ page }) => {
    await expect(page.locator('a[href="/pfs-tool/spending"]').first()).toBeVisible();
  });

  test('adding a spending shows it in the entries ledger and overview total', async ({ page }) => {
    // Enter the section, then reach the ledger via its sub-nav.
    await page.locator('a[href="/pfs-tool/spending"]').first().click();
    await page.waitForURL(/\/spending$/);
    await page.locator('a[href="/pfs-tool/spending/entries"]').click();
    await page.waitForURL(/\/spending\/entries/);

    await page.getByRole('button', { name: /add spending/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('0.00').fill('42.50');
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).not.toBeVisible();

    // Appears in the ledger.
    await expect(page.getByText('$42.50').first()).toBeVisible({ timeout: 15000 });

    // And rolls into the overview total.
    await page.locator('a[href="/pfs-tool/spending"]').first().click();
    await page.waitForURL(/\/spending$/);
    await expect(page.getByText('Total spent')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('$42.50').first()).toBeVisible();
  });

  test('the Import wizard is reachable and shows the upload step', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/spending"]').first().click();
    await page.waitForURL(/\/spending$/);
    await page.locator('a[href="/pfs-tool/spending/import"]').click();
    await page.waitForURL(/\/spending\/import/);
    await expect(page.getByText('Import transactions from your bank')).toBeVisible();
    await expect(page.getByText(/Choose PDF/i)).toBeVisible();
  });

  test('a custom category can be added in Manage', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/spending/manage"]').click();
    await page.waitForURL(/\/spending\/manage/);

    await page.getByRole('button', { name: /add category/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').nth(1).fill('Pets');
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.getByText('Pets')).toBeVisible();
  });
});
