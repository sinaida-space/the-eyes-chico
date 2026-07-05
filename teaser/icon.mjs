import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--headless=new'] });
const page = await browser.newPage();
for (const [size, name] of [[180, 'apple-touch-icon.png'], [64, 'favicon.png']]) {
  await page.setViewport({ width: size, height: size });
  await page.goto('http://127.0.0.1:4791/teaser/icon.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: `../assets/${name}` });
}
await browser.close(); console.log('icons done');
