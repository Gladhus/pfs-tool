import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_XLSX = resolve(__dirname, 'fixtures/sample.xlsx');

// sample.xlsx migrates to two active people (Me/Partner) with the Mortgage account
// split 50/50 between them — exactly the shape the viewer dropdown is meant to react to.
test.describe('Header viewer selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.locator('input[type="file"]').setInputFiles(LEGACY_XLSX);
    await page.waitForURL(/\/overview/);
  });

  test('is visible with Me/Partner/Household options, defaulting to Me', async ({ page }) => {
    const trigger = page.getByRole('combobox', { name: 'View as' });
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Me');

    await trigger.click();
    await expect(page.getByRole('option', { name: 'Me', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Partner', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Household (combined)' })).toBeVisible();
  });

  test('switching to Household changes the displayed net worth', async ({ page }) => {
    const netWorthValue = page.locator('p:has-text("Net worth") + div');
    const meValue = await netWorthValue.textContent();

    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Household (combined)' }).click();

    await expect(netWorthValue).not.toHaveText(meValue ?? '');
  });

  test('switching to Partner shows a different net worth than Me', async ({ page }) => {
    const netWorthValue = page.locator('p:has-text("Net worth") + div');
    const meValue = await netWorthValue.textContent();

    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Partner', exact: true }).click();

    await expect(netWorthValue).not.toHaveText(meValue ?? '');
  });

  test('selection persists across reload', async ({ page }) => {
    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Partner', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'View as' })).toContainText('Partner');

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'View as' })).toContainText('Partner');
  });
});
