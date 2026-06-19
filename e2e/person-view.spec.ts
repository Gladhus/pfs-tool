import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_XLSX = resolve(__dirname, 'fixtures/sample.xlsx');

// sample.xlsx migrates to two active people (Me/Partner) with the Mortgage account
// split 50/50 — the "By person" view only makes sense once there's more than one owner.
test.describe('Overview "By person" view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.locator('input[type="file"]').setInputFiles(LEGACY_XLSX);
    await page.waitForURL(/\/overview/);
  });

  test('is hidden while viewing as an individual person', async ({ page }) => {
    const viewMode = page.getByRole('group', { name: 'View mode' });
    await expect(viewMode.getByRole('radio', { name: 'By category' })).toBeVisible();
    await expect(viewMode.getByRole('radio', { name: 'By person' })).not.toBeVisible();
  });

  test('appears once viewing as household and splits the stat cards by person', async ({ page }) => {
    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Household' }).click();

    const viewMode = page.getByRole('group', { name: 'View mode' });
    const byPerson = viewMode.getByRole('radio', { name: 'By person' });
    await expect(byPerson).toBeVisible();
    await byPerson.click();

    const meCard = page.locator('div', { hasText: /^Me/ }).last();
    const partnerCard = page.locator('div', { hasText: /^Partner/ }).last();
    await expect(meCard).toBeVisible();
    await expect(partnerCard).toBeVisible();
  });

  test('switching back to an individual viewer falls back to the category view', async ({ page }) => {
    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Household' }).click();

    const viewMode = page.getByRole('group', { name: 'View mode' });
    await viewMode.getByRole('radio', { name: 'By person' }).click();
    await expect(viewMode.getByRole('radio', { name: 'By person' })).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Me', exact: true }).click();

    await expect(viewMode.getByRole('radio', { name: 'By person' })).not.toBeVisible();
    await expect(viewMode.getByRole('radio', { name: 'By category' })).toHaveAttribute('aria-checked', 'true');
  });
});
