import { test, expect } from '@playwright/test';

const REPOS_TO_SYNC = 3;

test('test', async ({ page }) => {
  await page.goto(`http://localhost:5173`);
  await page.getByRole('button', { name: "Don't share" }).click();
  await page.getByRole('button', { name: 'Skip this step' }).click();
  await page.getByRole('button', { name: 'Skip this step' }).click();
  await expect(page.locator('.subhead-l > span')).toBeVisible();
  await page.getByRole('button').first().click();
  const [page1] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Connect GitHub' }).click(),
  ]);
  await page1
    .getByLabel('Username or email address')
    .fill(process.env.GITHUB_USER);
  await page1.getByLabel('Username or email address').press('Tab');
  await page1.getByLabel('Password').fill(process.env.GITHUB_PASSWORD);
  await page1.getByRole('button', { name: 'Sign in' }).click();

  const githubAuthCode = await page
    .locator('.subhead-l > span')
    .first()
    .innerText();

  for (var i = 0; i < githubAuthCode.length; i++) {
    if (i === 4) continue;
    await page1.locator(`#user-code-${i}`).fill(githubAuthCode[i]);
  }

  await page1.getByRole('button', { name: 'Continue' }).click();
  await page1.getByRole('button', { name: 'Authorize BloopAI' }).click();
  await page1.close();

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
