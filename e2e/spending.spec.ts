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

    // Live search filters as you type.
    await page.getByPlaceholder(/Search/i).fill('zzz');
    await expect(page.getByText('No matching spendings')).toBeVisible();
    await page.getByPlaceholder(/Search/i).fill('');
    await expect(page.getByText('$42.50').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();

    // And rolls into the overview total + monthly chart.
    await page.locator('a[href="/pfs-tool/spending"]').first().click();
    await page.waitForURL(/\/spending$/);
    await expect(page.getByText('Monthly spending')).toBeVisible({ timeout: 15000 });
    await page.getByRole('radio', { name: 'By category' }).click();
    await expect(page.getByText('Groceries').first()).toBeVisible(); // stacked legend
    await page.getByRole('radio', { name: 'Total' }).click();
    await expect(page.getByText('Total spent')).toBeVisible();
    await expect(page.getByText('$42.50').first()).toBeVisible();
  });

  test('merchant autocomplete suggests past merchants', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/spending"]').first().click();
    await page.waitForURL(/\/spending$/);
    await page.getByRole('link', { name: 'Entries' }).click();
    await page.waitForURL(/\/spending\/entries/);

    // Seed a merchant.
    await page.getByRole('button', { name: /add spending/i }).first().click();
    let d = page.getByRole('dialog');
    await expect(d).toBeVisible();
    await d.getByPlaceholder('0.00').fill('80');
    await d.getByPlaceholder('Optional note').fill('Costco Wholesale');
    await d.getByRole('button', { name: /^save changes$/i }).click();
    await expect(d).not.toBeVisible();

    // Reopen, type a prefix, and pick the suggestion.
    await page.getByRole('button', { name: /add spending/i }).first().click();
    d = page.getByRole('dialog');
    await d.getByPlaceholder('Optional note').fill('cost');
    await page.getByRole('button', { name: /^Costco Wholesale/ }).click();
    await expect(d.getByPlaceholder('Optional note')).toHaveValue('Costco Wholesale');
  });

  test('the Detail tab renders the MoM/YoY breakdown', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/spending"]').first().click();
    await page.waitForURL(/\/spending$/);
    await page.locator('a[href="/pfs-tool/spending/detail"]').click();
    await page.waitForURL(/\/spending\/detail/);
    await expect(page.getByRole('radio', { name: 'Monthly' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Yearly' })).toBeVisible();
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
