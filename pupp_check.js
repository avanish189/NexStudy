const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(msg.text()));
  
  await page.goto('http://localhost:8000/studyai.html', { waitUntil: 'networkidle2' });
  
  const type = await page.evaluate(() => typeof window.toggleAuthMode);
  console.log("typeof window.toggleAuthMode =", type);

  const initType = await page.evaluate(() => typeof window.initHome);
  console.log("typeof window.initHome =", initType);

  await browser.close();
})();
