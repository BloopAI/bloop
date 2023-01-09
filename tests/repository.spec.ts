import * as console from 'console';
import { test, expect, Page } from '@playwright/test';

test.describe('Repository navigation', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto(
      `http://localhost:5173/?chosen_scan_folder=${process.env.SCAN_FOLDER}`,
    );
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
  });

  test.beforeEach(async () => {
    await page.goto('http://localhost:5173/');
  });

  test('Navigation folder', async () => {
    const repoName = await page
      .locator('div.flex.items-start.gap-4 > p')
      .first()
      .innerText();
    await page.locator('p.cursor-pointer.break-all').first().click();
    await expect(
      page.locator('div.flex.flex-col.gap-4 > div > h4').first(),
    ).toHaveText(`Files in ${repoName}`);

    const folderName = await page
      .locator('span.flex.flex-row.justify-between.px-4.py-4.bg-gray-900')
      .first()
      .innerText();

    await page
      .locator('span.flex.flex-row.justify-between.px-4.py-4.bg-gray-900')
      .first()
      .click();

    const lastBreadcrumbs = await page
      .locator('span.flex.items-center.gap-1.flex-shrink-0 > a > span')
      .last()
      .innerText();

    await expect(folderName.trim()).toEqual(lastBreadcrumbs.trim());
  });
  test('Navigation file', async () => {
    const repoName = await page
      .locator('div.flex.items-start.gap-4 > p')
      .first()
      .innerText();
    await page.locator('p.cursor-pointer.break-all').first().click();
    await expect(
      page.locator('div.flex.flex-col.gap-4 > div > h4').first(),
    ).toHaveText(`Files in ${repoName}`);

    const fileName = await page
      .locator('span.flex.flex-row.justify-between.px-4.py-4.bg-gray-900')
      .first()
      .innerText();
    await page
      .locator('span.flex.flex-row.justify-between.px-4.py-4.bg-gray-900')
      .first()
      .click();

    const openedFile = await page
      .locator('span.flex.items-center.gap-1.flex-shrink-0 > a > span')
      .nth(1)
      .innerText();

    await expect(openedFile.trim()).toEqual(fileName.trim());
  });
});
