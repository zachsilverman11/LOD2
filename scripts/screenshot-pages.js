const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 816, height: 1056 });
  await page.goto('file:///Users/clawdbot/clawd/repos/LOD2/test-pdfs/test-report-scenario-1.html', { waitUntil: 'networkidle0' });
  
  const pageElements = await page.$$('.page');
  console.log('Found ' + pageElements.length + ' pages');
  
  for (let i = 0; i < pageElements.length; i++) {
    await pageElements[i].screenshot({ path: 'test-pdfs/page-' + (i+1) + '.jpg', type: 'jpeg', quality: 80 });
    console.log('Captured page ' + (i+1));
  }
  
  await browser.close();
  console.log('Done');
})();
