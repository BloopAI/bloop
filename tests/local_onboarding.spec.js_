import { test, expect } from '@playwright/test';

const REPOS_TO_SYNC = 3;

test.skip('test', async ({ page }) => {
  if (!process.env.SCAN_FOLDER) {
    throw new Error('SCAN_FOLDER env not set');
  }

  await page.goto(
    `http://localhost:5173/?chosen_scan_folder=${process.env.SCAN_FOLDER}`,
  );
  await page.getByRole('button', { name: "Don't share" }).click();
  await page.getByPlaceholder('First name').click();
  await page.getByPlaceholder('First name').fill('Steve');
  await page.getByPlaceholder('First name').press('Tab');
  await page.getByRole('button').first().press('Tab');
  await page.getByPlaceholder('Last name').fill('Wozniak');
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('steve@bloop.ai');
  await page.locator('form').getByRole('button').nth(2).click();
  await page.getByPlaceholder('Email address').fill('steve.w@bloop.ai');
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('button', { name: 'Choose a folder' }).click();
  await page.getByRole('button', { name: 'Sync selected repos' }).click();

  await page.waitForSelector('.bg-skeleton', {
    state: 'detached',
    timeout: 60 * 1000,
  });

  await page
    .locator('label')
    .filter({ hasText: 'Select all' })
    .getByRole('checkbox')
    .click();

  // Store repo names to check status later
  const repoNames = [];

  for (let i = 1; i <= REPOS_TO_SYNC; i++) {
    const repo = page.locator(`ul > :nth-match(li, ${i})`);
    repoNames.push(await repo.locator('span').innerText());
    await repo.click();
  }

  await page.getByRole('button', { name: 'Sync repositories' }).click();
  await page.getByRole('button', { name: 'Setup later' }).click();

  await Promise.all(
    repoNames.map((repoName) =>
      page.waitForSelector(`p:has-text("${repoName}")`, {
        state: 'attached',
        timeout: 60 * 1000,
      }),
    ),
  );

  await Promise.all(
    repoNames.map((repoName, i) =>
      page
        .locator('.bg-green-500')
        .nth(i)
        .waitFor({ timeout: 60 * 1000 }),
    ),
  );
});
