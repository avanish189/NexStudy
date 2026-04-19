const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log('[CONSOLE]', msg.type(), msg.text());
  });
  
  page.on('pageerror', err => {
    console.log('[PAGE ERROR]', err.toString());
    console.log(err.stack);
  });
  
  try {
    await page.goto('http://localhost:8000/studyai.html', { waitUntil: 'networkidle2' });
  } catch (e) {
  }
  
  await browser.close();
})();
