// Builds public/index.html from src/ (single self-contained file).
import { readFileSync, writeFileSync } from 'node:fs';
const s = f => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
let html = s('index.tpl.html');
const parts = { CSS: s('base.css') + s('extra.css'), DATA: s('data.js'), CATALOGUE: s('catalogue.js'), ENGINE: s('engine.js'), REPLAY: s('replay.js'), GRAPH: s('graph.js'), UI: s('ui.js') };
for (const [k, v] of Object.entries(parts)) html = html.split(`/*${k}*/`).join(v);
writeFileSync(new URL('../public/index.html', import.meta.url), html);
console.log(`public/index.html built (${Math.round(html.length / 1024)} KB)`);
