// Run in the source-built computer image; see README. No model call or secrets.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.goto('http://server:3001/bot?agent=general-assistant');
  await page.waitForFunction(() => document.body.innerText.trim().length > 0);
  if (page.url().includes('/onboarding')) {
    for (let i = 0; i < 8; i++) {
      const done = page.getByRole('button', { name: 'Get started', exact: true });
      if (await done.isVisible()) { await done.click(); break; }
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.waitForTimeout(600);
    }
    await page.waitForURL(url => !url.pathname.includes('/onboarding'));
    await page.goto('http://server:3001/bot?agent=general-assistant');
  }
  await page.getByText('Personal Assistant', { exact: true }).first().waitFor();
  const body = await page.locator('body').innerText();
  if (/OPENAI_API_KEY is required/.test(body)) throw new Error('Unexpected Platform-key prerequisite');
  console.log(JSON.stringify({ title: await page.title(), url: page.url(), personalAssistantVisible: true }));
} finally { await browser.close(); }
