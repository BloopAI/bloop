import { expect } from '@playwright/test';

const REPOS_TO_SYNC = 1;

export const runOnboarding = async (page, context) => {
  const repoNames = [];

  await page.getByPlaceholder('First name').click();
  await page.getByPlaceholder('First name').fill('Steve');
  await page.getByPlaceholder('First name').press('Tab');
  await page.getByRole('button').first().press('Tab');
  await page.getByPlaceholder('Last name', { exact: true }).fill('Wozniak');
  await page.getByPlaceholder('Email address', { exact: true }).click();
  await page
    .getByPlaceholder('Email address', { exact: true })
    .fill('steve@bloop.ai');
  await page.locator('form').getByRole('button').nth(2).click();
  await page
    .getByPlaceholder('Email address', { exact: true })
    .fill('steve.w@bloop.ai');
  await page.getByRole('button', { name: 'Submit' }).click();

  await page.getByRole('button', { name: 'Get Started' }).click();

  await page.getByText('Opt-out of remote services').click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByRole('button', { name: 'Change selection' }).click();
  await page.getByText('Opt-in to remote services').click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  // GitHub login

  await new Promise((res) => setTimeout(() => res(1), 1500));
  if (
    (await page.isVisible("text='Connect GitHub'")) &&
    !(await page.isVisible("text='Sync GitHub repositories'"))
  ) {
    await expect(page.locator('.subhead-l > span')).toBeVisible();
    // await page.getByRole('button').first().click();
    const page1 = await context.newPage();
    await page1.goto('https://github.com/login/device');
    await page1
      .getByLabel('Username or email address')
      .fill(process.env.GITHUB_USER);
    await page1.getByLabel('Password').click();
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
  }

  await page.getByRole('button', { name: 'Sync selected repos' }).click();

  await page.waitForSelector('.bg-skeleton', {
    state: 'detached',
    timeout: 60 * 1000,
  });

  for (let i = 1; i <= REPOS_TO_SYNC; i++) {
    const repo = page.locator(`ul > :nth-match(li, ${i})`);
    repoNames.push(await repo.locator('span').innerText());
    await repo.click();
  }

  await page.getByRole('button', { name: 'Sync repositories' }).click();

  // Local

  await page.getByRole('button', { name: 'Choose a folder' }).click();
  await page.getByRole('button', { name: 'Sync selected repos' }).click();

  await page.waitForSelector('.bg-skeleton', {
    state: 'detached',
    timeout: 60 * 1000,
  });

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
};
