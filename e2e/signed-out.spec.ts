import { test, expect } from '@playwright/test';

test.describe('Sign-out screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
  });

  test('shows app name', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Net Worth Tracker' })).toBeVisible();
  });

  test('shows Google sign-in button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
  });

  test('shows Open XLSX and New XLSX File options', async ({ page }) => {
    await expect(page.getByRole('button', { name: /open xlsx/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new xlsx file/i })).toBeVisible();
  });
});
