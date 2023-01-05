import { test, expect } from '@playwright/test';

test.describe('Settings panel', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto(
      `http://localhost:5173/?chosen_scan_folder=${process.env.SCAN_FOLDER}`,
    );
  });

  test('Settings panel', async ({ page }) => {
    await page.getByRole('button', { name: "Don't share" }).click();
    await page.getByRole('button', { name: 'Skip this step' }).click();
    await page.getByRole('button', { name: 'Skip this step' }).click();
    await page.getByRole('button', { name: 'Setup later' }).click();
    await page.locator('#dropdownDefault').nth(1).click();
    await page.getByText('Settings').click();
    await page.locator('input[name="firstName"]').click();
    await page.locator('input[name="firstName"]').fill('John');
    await page.getByPlaceholder('Knight-Webb').click();
    await page.getByPlaceholder('Knight-Webb').fill('Doe');
    await page
      .locator('form div')
      .filter({
        hasText: 'EmailUsed to sign in, syncing and product updatesEmail',
      })
      .locator('div')
      .nth(4)
      .click();
    await page.getByPlaceholder('louis@bloop.ai').fill('test@test.com');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Preferences').click();
    await page
      .locator('span')
      .filter({ hasText: 'Repositories' })
      .nth(1)
      .click();
    await page
      .locator('div')
      .filter({
        hasText:
          'GeneralPreferencesRepositoriesRepositoriesAdd repositoriesConnect a GitHub accou',
      })
      .nth(1)
      .click();
    await page.locator('#dropdown span').first().click();
    await page.getByRole('button', { name: 'Choose a folder' }).click();
    await page
      .locator('label')
      .filter({ hasText: 'Select all' })
      .getByRole('checkbox')
      .click();
    await page
      .locator('label')
      .filter({ hasText: 'Select all' })
      .getByRole('checkbox')
      .click();
    await page.getByRole('button', { name: 'Sync repositories' }).click();
  });
});
