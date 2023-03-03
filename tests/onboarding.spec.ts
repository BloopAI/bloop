import { test } from '@playwright/test';
import { runOnboarding } from './onboarding';

test.describe.serial('OnBoarding', () => {
  let page; // Share page context between tests
  let context;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(
      `http://localhost:5173/?chosen_scan_folder=${process.env.SCAN_FOLDER}`,
    );
  });

  test.afterAll(async ({ browser }) => {
    await browser.close();
  });

  test('Local and GitHub', async () => {
    await runOnboarding(page, context);
  });
});
