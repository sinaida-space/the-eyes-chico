// One-off: renders assets/og-image.jpg + PNG favicons from favicon.svg
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--headless=new', '--hide-scrollbars'],
});
const page = await browser.newPage();

await page.setViewport({ width: 1200, height: 630 });
await page.goto('http://127.0.0.1:4791/teaser/og.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: '../assets/og-image.jpg', type: 'jpeg', quality: 90 });
console.log('og-image.jpg done');

for (const [size, name] of [[180, 'apple-touch-icon.png'], [64, 'favicon.png']]) {
  await page.setViewport({ width: size, height: size });
  await page.goto('data:text/html,<body style="margin:0"><img src="http://127.0.0.1:4791/assets/favicon.svg" style="width:100%;image-rendering:pixelated">', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: `../assets/${name}` });
  console.log(name, 'done');
}
await browser.close();
