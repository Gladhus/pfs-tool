import { test, expect } from '@playwright/test';

test.describe('Start from scratch', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: /new xlsx file/i }).click();
    await page.waitForURL(/\/overview/);
  });

  test('redirects to the overview page', async ({ page }) => {
    await expect(page).toHaveURL(/\/overview/);
  });

  test('shows XLSX mode banner with filename', async ({ page }) => {
    await expect(page.getByText(/net-worth\.xlsx/i)).toBeVisible();
  });

  test('shows empty state CTA linking to portfolio/manage (no accounts yet)', async ({ page }) => {
    await expect(page.locator('a[href="/pfs-tool/portfolio/manage"]')).toBeVisible();
  });

  test('nav links render for overview and portfolio', async ({ page }) => {
    await expect(page.locator('a[href="/pfs-tool/overview"]').first()).toBeVisible();
    await expect(page.locator('a[href*="/pfs-tool/portfolio"]').first()).toBeVisible();
  });

  test('navigates to portfolio/manage from empty state CTA', async ({ page }) => {
    await page.locator('a[href="/pfs-tool/portfolio/manage"]').click();
    await expect(page).toHaveURL(/\/portfolio\/manage/);
  });

  test('close-file confirmation modal returns to sign-in', async ({ page }) => {
    await page.getByRole('button', { name: /close file/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByTestId('close-file-confirm').click();
    await expect(page.getByRole('button', { name: /new xlsx file/i })).toBeVisible();
  });
});
