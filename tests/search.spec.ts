import { expect, Page, test } from '@playwright/test';
import { runOnboarding } from './onboarding';

test.describe.serial('Search', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto(
      `http://localhost:5173/?chosen_scan_folder=${process.env.SCAN_FOLDER}`,
    );
    await runOnboarding(page, context);
  });

  test.beforeEach(async () => {
    await page.goto('http://localhost:5173/');
  });

  test('NL search', async () => {
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('hello');
    await page.getByPlaceholder('My search').press('Enter');

    await expect(
      page.locator('li > div > div:nth-child(2)').first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('Regex search snippet more matches', async () => {
    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('const');
    await page.getByPlaceholder('My search').press('Enter');
    const bbCollapsed = await (
      await page.locator('li > div > div:nth-child(2)').first()
    ).boundingBox();
    const bbCollapsedHeight = bbCollapsed.height;

    await page
      .getByRole('button', { name: /Show\s\d*\smore\smatch/ })
      .first()
      .click();
    const bb = await (
      await page.locator('li > div > div:nth-child(2)').first()
    ).boundingBox();
    expect(bbCollapsedHeight).not.toEqual(bb.height);
  });

  test('Regex search pagination', async () => {
    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('a');
    await page.getByPlaceholder('My search').press('Enter');
    const firstItem = await page
      .locator('.flex.items-center.body-s.flex-shrink-0.gap-1')
      .first()
      .innerText();

    await page.locator('.mt-8 > div > div > button:nth-child(3)').click();

    await new Promise((res) => setTimeout(() => res(1), 1000));

    const secondPageItem = await page
      .locator('.flex.items-center.body-s.flex-shrink-0.gap-1')
      .first()
      .innerText();

    await expect(firstItem).not.toMatch(secondPageItem);
  });

  test('Code search result navigation', async () => {
    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('a');
    await page.getByPlaceholder('My search').press('Enter');

    const firstItem = await page.locator('li > div > div > div').first();

    await page.locator('li > div > div:nth-child(2)').first().click();

    await expect(
      page.getByRole('button', { name: 'Open in modal' }),
    ).toBeVisible();

    await expect(
      page
        .locator('div:nth-child(4) > div:nth-child(2) > div > div > div')
        .first()
        .innerText(),
    ).toEqual(firstItem.innerText());

    await page.getByRole('button', { name: 'Open in modal' }).click();

    await expect(
      page.getByRole('button', { name: 'Open in modal' }),
    ).toHaveClass(/text-sky-500/);

    await page.getByRole('button', { name: 'Open in full view' }).click();
    await expect(
      page
        .locator(
          '.text-gray-200 > div:nth-child(2) > div:nth-child(2) > div > div',
        )
        .first()
        .innerText(),
    ).toEqual(firstItem.innerText());
    await expect(page.locator('.overflow-scroll > div')).toBeVisible();
  });

  test('Autocomplete', async () => {
    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('a');

    const itemsCount = await page.locator('#downshift-1-menu').count();
    await page.getByRole('button', { name: 'View all results' }).click();
    await expect(page.locator('#downshift-1-menu').count()).not.toEqual(
      itemsCount,
    );
    const path = await page
      .locator('#downshift-1-item-0 div > div > div')
      .first()
      .innerText();
    await page.locator('#downshift-1-item-0').click();

    await page.waitForSelector(
      '.text-gray-200 > div:nth-child(2) > div:nth-child(2) > div > div > div',
      {
        state: 'attached',
        timeout: 60 * 1000,
      },
    );
    const currPath = await page
      .locator(
        '.text-gray-200 > div:nth-child(2) > div:nth-child(2) > div > div > div',
      )
      .first()
      .innerText();

    await expect(currPath).toEqual(path);
  });

  test('Code filters search', async () => {
    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('a');
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
    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('symbol:a');
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
    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
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

  // TODO: Fix path search
  test.skip('Path search', async () => {
    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
    await page.getByPlaceholder('My search').click();
    await page.getByPlaceholder('My search').fill('path:index');
    await page.getByPlaceholder('My search').press('Enter');
    // check path results
    await page.locator('span:nth-child(6) > .flex').first().click();
    // check opened file
  });

  test('Repo navigate from search', async () => {
    const repoName = await page
      .locator('div.flex.items-start.gap-4 > p')
      .first()
      .innerText();
    await page.locator('div.flex.items-start.gap-4').first().click();

    await expect(
      page.locator('div.flex.flex-col.gap-4 > div > h4').first(),
    ).toHaveText(new RegExp(`Files in (github.com/)?${repoName}`));
  });

  test('File navigate from search', async () => {
    let repoName = await page
      .locator('div.flex.items-start.gap-4 > p')
      .first()
      .innerText();

    await page.getByText(repoName).first().click();

    repoName = (
      await page
        .locator('div.flex.flex-col.gap-4 > div > h4')
        .first()
        .innerText()
    ).slice(9);

    const fileName = await page
      .locator(
        '.flex.flex-row.justify-between.px-4.py-4.bg-gray-900.group.cursor-pointer',
      )
      .last()
      .innerText();

    await page.getByTitle('Search type').click();
    await page.getByText('Regex').click();
    await page.getByPlaceholder('My search').click();
    await page
      .getByPlaceholder('My search')
      .fill(`open:true repo:${repoName} path:${fileName}`);
    await page.getByPlaceholder('My search').press('Enter');

    const currName = await page
      .locator('span > button > span.whitespace-nowrap')
      .nth(1)
      .innerText();

    await expect(currName.trim()).toMatch(fileName.trim());
  });
});
