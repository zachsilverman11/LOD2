import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2800, height: 1200 } });
await page.goto('http://localhost:3001/dashboard');
await page.waitForTimeout(2000);

// Get all column headers
const headers = await page.$$eval('h2.font-bold', elements => 
  elements.map(el => ({
    text: el.textContent,
    parentClass: el.parentElement?.className,
    computedBg: window.getComputedStyle(el.parentElement).backgroundColor
  }))
);

console.log('Column headers found:', JSON.stringify(headers, null, 2));

await browser.close();
