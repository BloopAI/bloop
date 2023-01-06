import { expect, Page, test } from '@playwright/test';

test.describe.serial('Search', () => {
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

  test('Code search', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('api');
    await page.getByPlaceholder('My search').press('Enter');

    await expect(
      page.locator('li > div > div:nth-child(2)').first(),
    ).toBeVisible();
  });

  // TODO:
  test('Code search snippet more matches', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('api');
    await page.getByPlaceholder('My search').press('Enter');
    // check results
    await page
      .getByRole('button', { name: 'Show 25 more matches' })
      .first()
      .click();
  });

  // TODO:
  test.skip('Code search pagination', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('api');
    await page.getByPlaceholder('My search').press('Enter');
    // check results
    // save items paths
    await page.locator('.mt-8 > div > div > button:nth-child(3)').click();
    // check results
    // compare items paths should be different
  });

  // TODO:
  test.skip('Code search result navigation', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('api');
    await page.getByPlaceholder('My search').press('Enter');
    // get first item path
    await page.locator('li > div > div:nth-child(2)').first().click();
    // check right side modal opened, check path
    // change mode
    await page.getByRole('button', { name: 'Open in modal' }).click();
    // check center modal opened, check path

    // change mode
    await page.getByRole('button', { name: 'Open in full view' }).click();
    // check full view opened, check path
  });

  // TODO:
  test.skip('Autocomplete', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('ap');
    //check results count

    await page.getByRole('button', { name: 'View all results' }).click();
    // check results count
    // find suggestions first item path
    // locator('#downshift-39-item-0').getByText('build/config/metallb.yamlbuild/config/metallb.yaml1 match# from https://github.c')
    await page.locator('#downshift-1-item-1').click();
    // compare opened path with suggestion path
  });

  test('Code filters search', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('api');
    await page.getByPlaceholder('My search').press('Enter');

    await expect(
      page.locator('li > div > div:nth-child(2)').first(),
    ).toBeVisible();

    const filterCheckBox = await page
      .locator('label')
      .nth(1)
      .getByRole('checkbox');

    await filterCheckBox.click();
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(
      page.locator('li > div > div:nth-child(2)').first(),
    ).toBeVisible();

    const inputValue = await page.getByPlaceholder('My search').innerText();
    await expect(
      inputValue.includes(await filterCheckBox.innerText()),
    ).toBeTruthy();
  });

  test('Symbol search', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('symbol:get');
    await page.getByPlaceholder('My search').press('Enter');

    await expect(
      page.locator('li > div > div:nth-child(2)').first(),
    ).toBeVisible();
    await expect(page.locator('div > .w-4 > svg').first()).toBeVisible();
    await page.locator('.text-gray-400 > button').first().click();

    await expect(
      page.locator('li > div > div:nth-child(2)').first(),
    ).toHaveClass(
      'bg-gray-900 text-gray-600 text-xs  border-gray-700 py-4 cursor-pointer w-full overflow-auto',
    );
  });

  test('Repo search', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('repo:a');
    await page.getByPlaceholder('My search').press('Enter');

    const repoItem = await page
      .getByRole('list')
      .locator('div > span > span')
      .nth(1);
    const repoName = await repoItem.innerText();

    await expect(repoItem).toBeVisible();
    await page.getByRole('list').locator('div > span > span').first().click();

    await expect(page.getByRole('heading').first()).toHaveText(
      `Files in ${repoName}`,
    );
  });

  test.skip('Path search', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('path:index');
    await page.getByPlaceholder('My search').press('Enter');
    // check path results
    await page.locator('span:nth-child(6) > .flex').first().click();
    // check opened file
  });

  //TODO: run open:true repo:name search and check if repo opened (not sure how to handle repo for different indexes)
  test.skip('Repo navigate from search', () => {});
  //TODO: run open:true repo:name path: search and check if repo opened (not sure how to handle repo for different indexes)
  test.skip('File navigate from search', () => {});
});
