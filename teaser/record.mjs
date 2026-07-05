// Frame-by-frame capture of teaser.html through system Chrome → frames/ + audio.wav
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';

const FPS = 30, DUR = 15, FRAMES = FPS * DUR;
const URL = 'http://127.0.0.1:4791/teaser/teaser.html';

mkdirSync('frames', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--headless=new', '--enable-gpu', '--use-angle=metal', '--hide-scrollbars', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => { console.error('[pageerror]', e.message); process.exit(1); });

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('window.READY === true', { timeout: 60000 });
console.log('page ready, rendering', FRAMES, 'frames');

for (let f = 0; f < FRAMES; f++) {
  await page.evaluate(t => window.SEEK(t), f / FPS);
  await page.screenshot({ path: `frames/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (f % 60 === 0) console.log('frame', f);
}

console.log('rendering audio…');
const wav = await page.evaluate(() => window.AUDIO());
writeFileSync('audio.wav', Buffer.from(wav, 'base64'));

await browser.close();
console.log('done: frames/ + audio.wav');
