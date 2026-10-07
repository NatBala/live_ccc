import { chromium } from 'playwright';
const dir = process.argv[2] || new URL('.', import.meta.url).pathname.replace(/\/$/, ''), FPS = 30, DUR = 15;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + dir + '/demo.html?frames=1'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
for (let i = 0; i < FPS * DUR; i++) { await p.evaluate(t => render(t), i / FPS); await p.screenshot({ path: `${dir}/frames/f${String(i).padStart(4, '0')}.png` }); }
console.log('frames', FPS * DUR, 'errors', errs); await b.close();
