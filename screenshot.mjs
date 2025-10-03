import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3001/dashboard');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'dashboard.png', fullPage: true });
await browser.close();
console.log('Screenshot saved');
