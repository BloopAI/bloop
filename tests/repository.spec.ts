import { test, expect } from '@playwright/test';

test.describe('Repository navigation', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto(
      `http://localhost:5173/?chosen_scan_folder=${process.env.SCAN_FOLDER}`,
    );
  });

  test('Navigation', async ({ page }) => {
    await page.getByRole('button', { name: "Don't share" }).click();
    await page.getByRole('button', { name: 'Skip this step' }).click();
    await page.getByRole('button', { name: 'Choose a folder' }).click();
    await page.waitForSelector('.bg-skeleton', {
      state: 'detached',
      timeout: 60 * 1000,
    });

    await page
      .locator('label')
      .filter({ hasText: 'Select all' })
      .getByRole('checkbox')
      .click();

    await page.getByRole('button', { name: 'Sync repositories' }).click();
    await page.getByRole('button', { name: 'Setup later' }).click();
    await page.locator('p.cursor-pointer.break-all').first().click();
    await page
      .locator('span.flex.flex-row.justify-between.px-4.py-4.bg-gray-900')
      .first()
      .click();
    await page
      .locator(
        'a.flex.items-center.gap-1.cursor-pointer.text-gray-500.transition-all.duration-300.ease-in-bounce.flex-shrink-0',
      )
      .nth(1)
      .click();
    await page
      .locator('span.flex.flex-row.justify-between.px-4.py-4.bg-gray-900')
      .last()
      .click();

    await page
      .locator('div.flex.items-center.cursor-pointer.bg-gray-900.text-gray-500')
      .last()
      .click();

    await page
      .locator('div.flex.items-center.cursor-pointer.bg-gray-900.text-gray-500')
      .first()
      .click();
  });
});
