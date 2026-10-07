import { chromium } from 'playwright';
const [dir, a, z] = [process.argv[2], +process.argv[3], +process.argv[4]], FPS = 30;
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + dir + '/narrated-built.html?frames=1'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
for (let i = a; i < z; i++) { await p.evaluate(t => render(t), i / FPS); await p.screenshot({ path: `${dir}/frames/f${String(i).padStart(4, '0')}.png` }); }
console.log('chunk', a, z, 'errors', errs); await b.close();
