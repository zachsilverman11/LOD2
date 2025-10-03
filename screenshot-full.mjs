import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:3001/dashboard');
await page.waitForTimeout(2000);

// Take a full screenshot
await page.screenshot({ path: 'dashboard-full.png', fullPage: false });

// Also check if the columns are rendering
const columns = await page.$$('div[class*="bg-gradient"]');
console.log('Found gradient columns:', columns.length);

// Get the HTML of the first column to debug
const firstColumn = await page.$('div.flex-1.min-w-\\[300px\\]');
if (firstColumn) {
  const html = await firstColumn.innerHTML();
  console.log('First column HTML preview:', html.substring(0, 200));
}

await browser.close();
