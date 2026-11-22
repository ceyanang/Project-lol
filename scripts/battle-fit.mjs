// Checks the battle screen fits common phone viewports without scrolling (run `npm run dev -- --port 5199` first).
// usage: node scripts/battle-fit.mjs [url] [outDir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] ?? 'http://localhost:5199/';
const out = process.argv[3] ?? '.';
const sizes = [[320, 568], [360, 640], [390, 844]];
const browser = await chromium.launch();
let bad = 0;
for (const keyboard of ['game', 'phone']) {
  for (const [w, h] of sizes) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true })).newPage();
    await page.addInitScript((kb) => {
      if (!localStorage.getItem('kanaslayer.profile.v1')) {
        localStorage.setItem('kanaslayer.profile.v1', JSON.stringify({ version: 1, unlocked: ['hira-vowels'], studyOff: [], srs: {}, runs: 0, wins: 0, bestFloor: 0, settings: { autoSpeak: false, sfx: false, music: false, keyboard: kb } }));
      }
    }, keyboard);
    await page.goto(url);
    await page.locator('.btn-primary, .btn-wide').first().click();
    await page.locator('.map-node.is-reachable').first().click();
    await page.waitForSelector('.battle');
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const b = document.querySelector('.battle');
      return { sh: b.scrollHeight, ch: b.clientHeight, sw: document.documentElement.scrollWidth, iw: innerWidth };
    });
    const ok = m.sh <= m.ch + 1 && m.sw <= m.iw;
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : 'BAD'} ${keyboard} ${w}x${h} scrollH ${m.sh}/${m.ch} scrollW ${m.sw}/${m.iw}`);
    await page.screenshot({ path: `${out}/battle-${keyboard}-${w}x${h}.png` });
    await page.context().close();
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
