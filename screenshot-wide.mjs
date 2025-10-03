import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2800, height: 1200 } });
await page.goto('http://localhost:3001/dashboard');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'dashboard-wide.png', fullPage: false });
await browser.close();
console.log('Wide screenshot saved');
