// Builds the two single-file pages from src/:
//   public/index.html   Agent Harness (the business user's conversational view)
//   public/classic.html the original multi-agent workbench and foundation view
import { readFileSync, writeFileSync } from 'node:fs';
const s = f => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const fill = (tpl, parts) => { let html = s(tpl); for (const [k, v] of Object.entries(parts)) html = html.split(`/*${k}*/`).join(v); return html; };
const shared = { DATA: s('data.js'), CATALOGUE: s('catalogue.js'), ENGINE: s('engine.js') };
const out = {
  'index.html': fill('harness/harness.tpl.html', { CSS: s('harness/harness.css'), ...shared, REPLAY: s('replay.js'), PIPELINE: s('pipeline.js'), SIGNALS: s('signals.js'), HARNESS: s('harness/harness.js').replace('/*ALWAYSON*/', () => s('harness/alwayson.js')) }),
  'classic.html': fill('index.tpl.html', { CSS: s('base.css') + s('extra.css'), ...shared, REPLAY: s('replay.js'), GRAPH: s('graph.js'), UI: s('pipeline.js') + s('ui.js') })
};
for (const [f, html] of Object.entries(out)) { writeFileSync(new URL('../public/' + f, import.meta.url), html); console.log(`public/${f} built (${Math.round(html.length / 1024)} KB)`); }
