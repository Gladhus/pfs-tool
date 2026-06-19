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

  // Latest snapshot (2024-06-01): TFSA 55000 (Me 100%), Checking 6000 (Me 100%),
  // Mortgage -295000 raw (kind: debt, so signedMain flips it positive) split Me/Partner
  // 50/50. Exact figures below pin those amounts down so a regression in the ownership
  // math (not just "the number changed") gets caught.
  test('switching the viewer updates the overview net worth and category cards with exact amounts', async ({ page }) => {
    const netWorthValue = page.locator('p:has-text("Net worth") + div');
    const investmentsCard = page.locator('div.rounded-xl.p-4', { hasText: 'Investments' });
    const cashCard = page.locator('div.rounded-xl.p-4', { hasText: 'Cash' });
    const parseAmount = (s: string | null) => Number((s ?? '').replace(/[^0-9.-]/g, ''));

    const selectViewer = async (name: string) => {
      await page.getByRole('combobox', { name: 'View as' }).click();
      await page.getByRole('option', { name, exact: true }).click();
    };

    // Me (default): owns the TFSA and Checking outright, plus half the mortgage's
    // (positive, post-flip) 295000 contribution: 55000 + 6000 + 147500 = 208500.
    await expect(netWorthValue).toHaveText('$208,500.00');
    await expect(investmentsCard.locator('.text-2xl')).toHaveText('$55,000.00');
    await expect(cashCard.locator('.text-2xl')).toHaveText('$6,000.00');
    const meNetWorth = parseAmount(await netWorthValue.textContent());

    // Partner: owns none of the TFSA/Checking, just their half of the mortgage (147500) —
    // independently verifying the second person's slice, not just "differs from Me".
    await selectViewer('Partner');
    await expect(netWorthValue).toHaveText('$147,500.00');
    await expect(investmentsCard.locator('.text-2xl')).toHaveText('$0.00');
    await expect(cashCard.locator('.text-2xl')).toHaveText('$0.00');
    const partnerNetWorth = parseAmount(await netWorthValue.textContent());

    // Household: everything combined, including the full mortgage (295000):
    // 55000 + 6000 + 295000 = 356000 — and, since every account here is owned solely by
    // Me or split exactly Me/Partner, that also equals meNetWorth + partnerNetWorth.
    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Household (combined)' }).click();
    await expect(netWorthValue).toHaveText('$356,000.00');
    await expect(investmentsCard.locator('.text-2xl')).toHaveText('$55,000.00');
    await expect(cashCard.locator('.text-2xl')).toHaveText('$6,000.00');
    expect(parseAmount(await netWorthValue.textContent())).toBe(meNetWorth + partnerNetWorth);

    // Back to Me confirms the round trip isn't sticky/stale.
    await selectViewer('Me');
    await expect(netWorthValue).toHaveText('$208,500.00');
    await expect(investmentsCard.locator('.text-2xl')).toHaveText('$55,000.00');
    await expect(cashCard.locator('.text-2xl')).toHaveText('$6,000.00');
  });

  test('switching the viewer keeps the History page net worth in sync with Overview', async ({ page }) => {
    await page.locator('a[href*="/pfs-tool/portfolio"]').first().click();
    await page.locator('a[href="/pfs-tool/portfolio/history"]').click();
    await page.waitForURL(/\/portfolio\/history/);

    const latestCard = page.locator('button', { hasText: '2024-06-01' });
    await expect(latestCard).toContainText('$208,500.00');

    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Partner', exact: true }).click();
    await expect(latestCard).toContainText('$147,500.00');

    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Household (combined)' }).click();
    await expect(latestCard).toContainText('$356,000.00');
  });

  // Every multi-owner account in the fixture is a 50/50 split — re-split the TFSA into
  // an uneven 70/30 Me/Partner ratio so the per-person math is proven for ratios other
  // than half-and-half, and not just "differs between viewers".
  test('a non-50/50 ownership split scales each viewer by their actual share', async ({ page }) => {
    await page.locator('a[href*="/pfs-tool/portfolio"]').first().click();
    await page.locator('a[href="/pfs-tool/portfolio/manage"]').click();
    await page.waitForURL(/\/portfolio\/manage/);

    await page.locator('button', { hasText: 'TFSA 1' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('checkbox').first().click(); // "Split between multiple people"
    await dialog.locator('div', { hasText: /^Me$/ }).locator('input[type="number"]').fill('70');
    await dialog.locator('div', { hasText: /^Partner$/ }).locator('input[type="number"]').fill('30');
    await dialog.getByRole('button', { name: /^save changes$/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('button', { hasText: 'TFSA 1' })).toContainText('Me 70% · Partner 30%');

    await page.locator('a[href="/pfs-tool/overview"]').click();
    await page.waitForURL(/\/overview/);
    const netWorthValue = page.locator('p:has-text("Net worth") + div');
    const investmentsCard = page.locator('div.rounded-xl.p-4', { hasText: 'Investments' });

    // Me: 70% of the 55000 TFSA, all of the 6000 Checking, half the mortgage (147500).
    await expect(investmentsCard.locator('.text-2xl')).toHaveText('$38,500.00');
    await expect(netWorthValue).toHaveText('$192,000.00');

    // Partner: 30% of the TFSA, none of the Checking, half the mortgage (147500).
    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Partner', exact: true }).click();
    await expect(investmentsCard.locator('.text-2xl')).toHaveText('$16,500.00');
    await expect(netWorthValue).toHaveText('$164,000.00');

    // Household: 100% of the TFSA regardless of how it's split between Me/Partner — the
    // combined total is unaffected by the ratio, only by how it's divided.
    await page.getByRole('combobox', { name: 'View as' }).click();
    await page.getByRole('option', { name: 'Household (combined)' }).click();
    await expect(investmentsCard.locator('.text-2xl')).toHaveText('$55,000.00');
    await expect(netWorthValue).toHaveText('$356,000.00');
  });
});
