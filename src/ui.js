/* ===== UI + live runtime ===== */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TC = { sales: '#82b6ff', product: '#7fd4ab', marketing: '#f0b870', service: '#b9a5f5' };
const ICONS = {
  memory: '<path d="M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>', file: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', chart: '<path d="M5 20V11M11 20V5M17 20v-7M3 20h18"/>',
  loop: '<path d="M4 12a8 8 0 0114-5l2 2M20 4v5h-5M20 12a8 8 0 01-14 5l-2-2M4 20v-5h5"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  network: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5M12 12l-5.5 5.5M12 12l5.5 5.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 3.5-5 7-5s6 1.5 7 5M16 4.5a3.5 3.5 0 010 7M18 15c2 .7 3.3 2.3 4 5"/>', mail: '<path d="M3 6h18v12H3zM3 7l9 6 9-6"/>',
  book: '<path d="M4 19V5a2 2 0 012-2h13v16H6a2 2 0 00-2 2 2 2 0 002 2h13"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.file}</svg>`;
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>');
const agentName = id => AGENTS[id] ? AGENTS[id].name : id === 'orch' ? 'Orchestration' : EMPLOYEES[id] ? EMPLOYEES[id].name : id;
const UI = { requester: 'EMP-PRIYA', tab: 'decisions', view: 'live', memAdv: null, ops: [], raf: 0, run: null, ctl: null, recordings: [], totals: { runs: 0, reused: 0, committed: 0, pending: 0, blocked: 0, calls: 0, mcp: 0 } };

/* ---------- static diagram ---------- */
function buildStatic() {
  $('whoRow').innerHTML = Object.entries(EMPLOYEES).map(([id, e]) => `<button class="who-chip" data-who="${id}" aria-pressed="${id === UI.requester}"><i style="background:${TC[e.team]}">${e.name.split(' ').map(x => x[0]).join('')}</i>${esc(e.name)} <small>${esc(TEAMS[e.team].name)}</small></button>`).join('');
  $('lanes').innerHTML = TEAM_ORDER.map(t => { const ids = Object.keys(AGENTS).filter(k => AGENTS[k].team === t);
    return `<div class="lane" data-team="${t}"><h3><i style="background:${TC[t]}"></i>${TEAMS[t].name}<small>${ids.length} specialists</small></h3><div class="pills">${ids.map(id => `<button class="pill" id="pl-${id.replace('.', '-')}" data-agent="${id}" style="--c:${TC[t]}" title="${esc(AGENTS[id].does)}"><i></i><span>${esc(AGENTS[id].name)}</span></button>`).join('')}</div></div>`; }).join('');
  $('found').innerHTML = `<div class="tiles">${LAYER_ORDER.map(l => `<button class="tile" id="tile-${l}" data-layer="${l}"><span class="th">${icon(LAYERS[l].icon)}${LAYERS[l].short}</span><span class="cnt"></span><span class="tl"></span></button>`).join('')}</div><div class="fhead"><div><b>Shared AI foundation</b><span>Deterministic rules decide what each agent sees and what gets stored.</span></div><div class="ftot" id="ftot"></div></div>`;
  $('integ').innerHTML = `<div class="systems">${SYS_ORDER.map(k => `<button class="sys" id="sys-${k}" data-sys="${k}">${icon(SYSTEMS[k].icon)}<span><b>${SYSTEMS[k].name}</b><small>${SYSTEMS[k].sub}</small></span><span class="via"></span></button>`).join('')}</div><div class="gw"><b>Enterprise integration</b><span>MCP gateway · API gateway</span><span class="legend"><span class="via MCP" style="display:inline-block">MCP</span>agent tool call <span class="via API" style="display:inline-block">API</span>typed service call</span></div>`;
  $('orch').innerHTML = `<div class="ohead"><div class="oname">${icon('network')}Intelligence & orchestration</div><div class="oreq" id="oreq"></div></div><div class="pipe" id="pipe"></div><div class="othink" id="othink"></div><div class="tchips" id="tchips"></div>`;
  renderSugs(); renderOrch();
}
const pillEl = id => $('pl-' + id.replace('.', '-'));
function renderSugs() {
  const t = EMPLOYEES[UI.requester].team;
  $('sugs').innerHTML = SUGGESTIONS[t].map(s => `<button class="sug" data-sug="${esc(s)}">${esc(s)}</button>`).join('');
}

/* ---------- keyed patching: only what changed is touched ---------- */
function setHTML(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }
function patchList(box, items) {
  const existing = new Map([...box.children].filter(c => c.dataset && c.dataset.k).map(c => [c.dataset.k, c]));
  [...box.children].forEach(c => { if (!c.dataset || !c.dataset.k) c.remove(); });
  let prev = null;
  for (const it of items) {
    let el = existing.get(it.key);
    if (!el) {
      el = document.createElement(it.tag || 'div'); el.dataset.k = it.key; el.className = (it.cls || '') + (box._ready ? ' enter' : '');
      el.innerHTML = it.html; el._h = it.html; el._cls = it.cls || '';
      el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
    } else {
      existing.delete(it.key);
      if (el._h !== it.html) { el.innerHTML = it.html; el._h = it.html; }
      if ((it.cls || '') !== el._cls) { const entering = el.classList.contains('enter'); el.className = (it.cls || '') + (entering ? ' enter' : ''); el._cls = it.cls || ''; }
    }
    const ref = prev ? prev.nextSibling : box.firstChild;
    if (el !== ref) box.insertBefore(el, ref);
    prev = el;
  }
  existing.forEach(el => el.remove());
  box._ready = true;
}

/* ---------- orchestration: nine precise steps ---------- */
const OSTEPS = [['understand', 'Understand', ['requester', 'intent']], ['resolve', 'Resolve', ['lookup', 'entity']], ['scope', 'Scope', ['scope']], ['reuse', 'Reuse', ['known']], ['gaps', 'Gaps', ['missing']], ['memory', 'Memory rule', ['memory']], ['controls', 'Controls', ['controls', 'registry']], ['plan', 'Plan', ['planfix', 'success']], ['execute', 'Execute', []]];
function stepStates(r) {
  const s = OSTEPS.map(([id, name, types]) => ({ id, name, items: r ? r.decisions.filter(d => types.includes(d.type)) : [], state: 'pending' }));
  if (!r) return s;
  s.slice(0, 7).forEach(x => x.state = x.items.length ? 'done' : 'pending');
  s[7].state = r.tasks.length ? (r.status === 'thinking' ? 'active' : 'done') : 'pending';
  s[8].state = r.status === 'running' ? 'active' : r.status === 'done' ? 'done' : 'pending';
  if (r.status === 'thinking') { const f = s.find(x => x.state === 'pending'); if (f) f.state = 'active'; }
  if (['running', 'done'].includes(r.status)) s.slice(0, 7).forEach(x => { if (x.state === 'pending') x.state = 'skipped'; });
  if (r.status === 'clarify') s[4].state = 'active';
  if (r.status === 'failed') { const f = s.find(x => x.state === 'pending' || x.state === 'active'); if (f) f.state = 'failed'; }
  return s;
}
function renderOrch() {
  const r = UI.run, st = stepStates(r);
  setHTML($('oreq'), r ? `“${esc(r.text)}” <small>${esc(EMPLOYEES[r.requester].name)}</small>` : '');
  patchList($('pipe'), st.map((x, k) => ({ key: x.id, cls: 'pstep ' + x.state, html: `<i>${x.state === 'done' ? icon('check') : k + 1}</i>${x.name}` })));
  let think = 'Waiting for a request.';
  if (r) {
    const act = st.find(x => x.state === 'active');
    const last = [...r.decisions].reverse()[0];
    if (r.status === 'thinking') think = `<span class="spin"></span><b>${act ? act.name : 'Thinking'}</b>${last ? ' · ' + esc(last.title) : ''}`;
    else if (r.status === 'running') { const run = r.tasks.filter(t => t.state === 'running').map(t => AGENTS[t.agent].name); think = `<span class="spin"></span><b>Execute</b> · ${run.length ? esc(run.join(' and ')) + ' working' : 'routing'} · ${r.tasks.filter(t => t.state === 'done').length} of ${r.tasks.length} done`; }
    else if (r.status === 'clarify') think = '<b>Gaps</b> · waiting for your answer';
    else if (r.status === 'done') think = `<b>Complete</b> · ${r.tasks.length} specialists in ${Math.round((r.t1 - r.t0) / 1000)} s`;
    else if (r.status === 'failed') think = `<b>Stopped</b> · ${esc(r.error || '')}`;
  }
  setHTML($('othink'), think);
  patchList($('tchips'), r ? r.tasks.map(t => ({ key: t.id, cls: 'tchip ' + (t.state || ''), html: `<i style="--c:${TC[AGENTS[t.agent].team]}"></i>${t.id} ${esc(AGENTS[t.agent].name)}${t.depends_on.length ? ` <span class="arr">after ${t.depends_on.join(', ')}</span>` : ''}` })) : []);
  $('orch').classList.toggle('active', !!r && ['thinking', 'running'].includes(r.status));
}

/* ---------- lanes, tiles, systems, stats ---------- */
function renderDiagram() {
  const r = UI.run;
  document.querySelectorAll('.pill').forEach(el => {
    const t = r && r.tasks.find(x => x.agent === el.dataset.agent);
    el.classList.toggle('planned', !!t); el.classList.toggle('running', !!t && t.state === 'running'); el.classList.toggle('done', !!t && t.state === 'done');
  });
  for (const l of LAYER_ORDER) {
    const el = $('tile-' + l);
    const last = [...F.events].reverse().find(e => layerOfEvent(e.type) === l);
    setHTML(el.querySelector('.cnt'), `<b>${layerCount(l)}</b> ${l === 'memory' ? 'memories & episodes' : l === 'graph' ? 'nodes' : l === 'events' ? 'events' : 'records'}`);
    const tlEl = el.querySelector('.tl'), tlText = l === 'memory' && F.changes.length ? `${F.changes[F.changes.length - 1].attr}: ${F.changes[F.changes.length - 1].after}` : last ? `${last.type}: ${last.detail}` : { memory: 'Advisor profiles, scoped and sourced', knowledge: 'Fund facts, findings, approved content', policy: POLICIES.length + ' rules applied to every agent', models: 'Sales Alpha, peer match, cost & construction', feedback: 'Outcomes and corrections', events: 'What changed, who hears it', graph: 'People, firms, units, sources, outputs' }[l];
    if (tlEl.textContent !== tlText) tlEl.textContent = tlText;
  }
  setHTML($('ftot'), `<span><b>${UI.totals.reused}</b>reused</span><span><b>${UI.totals.committed}</b>stored</span><span><b>${UI.totals.blocked}</b>blocked</span>`);
}
const layerOfEvent = t => t.startsWith('knowledge') ? 'knowledge' : t.startsWith('memory') ? 'memory' : t.startsWith('approval') ? 'policy' : t.startsWith('commitment') ? 'events' : t.startsWith('content') ? 'knowledge' : 'events';
function renderStats() {
  const T = UI.totals, box = $('stats');
  const rows = [['runs', T.runs, 'requests'], ['reused', T.reused, 'reused'], ['committed', T.committed, 'stored'], ['pending', T.pending, 'pending'], ['blocked', T.blocked, 'blocked'], ['calls', T.calls, `calls · ${T.mcp} MCP`]];
  if (!box._built) { box.innerHTML = rows.map(([k, , l], i) => `<div class="stat ${i === 1 ? 'gold' : ''}" data-s="${k}"><b>0</b><span>${l}</span></div>`).join(''); box._built = true; }
  for (const [k, v, l] of rows) { const el = box.querySelector(`[data-s="${k}"]`), b = el.firstChild; if (b.textContent !== String(v)) { b.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } el.lastChild.textContent = l; }
}
function setAIStatus() {
  const el = $('aistat');
  if (AI.mode === 'live') { el.className = 'aistat live'; el.innerHTML = `<i></i><span>Live AI · ${esc(AI.provider || 'Claude')}${AI.tools ? ' with tools' : ''}</span>`; }
  else if (AI.mode === 'checking') { el.className = 'aistat'; el.innerHTML = '<i></i><span>Checking AI…</span>'; }
  else { el.className = 'aistat off'; el.innerHTML = '<i></i><span>Live AI not connected</span>'; }
}

/* ---------- wires: routed through the gaps, drawn for every live operation ---------- */
function rectIn(el) { const d = $('diagram').getBoundingClientRect(), r = el.getBoundingClientRect(), dg = $('diagram'); return { x: r.left - d.left + dg.scrollLeft, y: r.top - d.top + dg.scrollTop, w: r.width, h: r.height }; }
const P2 = (x, y) => ({ x, y });
function cpath(a, b, k = .5) { const dy = Math.max(45, Math.abs(b.y - a.y) * k) * (b.y >= a.y ? 1 : -1); return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${a.x.toFixed(1)} ${(a.y + dy).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - dy).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`; }
function opPath(o) {
  const off = (o.lane || 0) * 14;
  const pr = o.agent ? rectIn(pillEl(o.agent)) : null, pb = pr && P2(pr.x + pr.w / 2, pr.y + pr.h), pt = pr && P2(pr.x + pr.w / 2, pr.y);
  const tileTop = l => { const t = rectIn($('tile-' + l)); return P2(t.x + t.w / 2 + off, t.y); };
  if (o.kind === 'request') { const c = rectIn($('cmd')), r = rectIn($('orch')); return cpath(P2(c.x + c.w * .3, c.y + c.h), P2(c.x + c.w * .3, r.y)); }
  if (o.kind === 'dispatch') { const r = rectIn($('orch')); return cpath(P2(pt.x, r.y + r.h), pt); }
  if (o.kind === 'read') return cpath(tileTop(o.layer), pb);
  if (o.kind === 'write') return cpath(pb, tileTop(o.layer));
  if (o.kind === 'call') { const s = rectIn($('sys-' + o.sys)), e = P2(s.x + s.w / 2 + off / 2, s.y); return `M${pb.x.toFixed(1)} ${pb.y.toFixed(1)} C${pb.x.toFixed(1)} ${(pb.y + 170).toFixed(1)} ${e.x.toFixed(1)} ${(e.y - 170).toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`; }
  if (o.kind === 'handoff') { const fr = rectIn(pillEl(o.from)), a = P2(fr.x + fr.w / 2, fr.y + fr.h), t = tileTop(o.layer); return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${a.x.toFixed(1)} ${(a.y + 90).toFixed(1)} ${t.x.toFixed(1)} ${(t.y - 80).toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)} C${t.x.toFixed(1)} ${(t.y - 80).toFixed(1)} ${pb.x.toFixed(1)} ${(pb.y + 90).toFixed(1)} ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`; }
  return null;
}
const OPCOL = { request: '#ffd27a', dispatch: '#b9cadb', read: '#7fd4ab', write: '#ffd27a', handoff: '#e2b6ff' };
function addOp(o) {
  o.t0 = performance.now(); o.dur = o.dur || 1400; o.id = Math.random().toString(36).slice(2);
  o.color = o.kind === 'call' ? (o.via === 'MCP' ? '#82b6ff' : '#7fd4ab') : OPCOL[o.kind];
  UI.ops.push(o); drawOps(); if (o.sys) hotSys(o.sys, o.via, o.dur);
  if (!UI.raf) UI.raf = requestAnimationFrame(tick);
}
function hotSys(k, via, dur) { const el = $('sys-' + k); el.classList.add('hot'); const v = el.querySelector('.via'); v.textContent = via; v.className = 'via ' + via; clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('hot'), dur + 300); }
function flashTile(l, cls) { const el = $('tile-' + l); if (!el) return; el.classList.add(cls); clearTimeout(el['_' + cls]); el['_' + cls] = setTimeout(() => el.classList.remove(cls), 1600); }
function drawOps() {
  const svg = $('wires'), dg = $('diagram');
  svg.setAttribute('viewBox', `0 0 ${dg.scrollWidth} ${dg.scrollHeight}`); svg.style.width = dg.scrollWidth + 'px'; svg.style.height = dg.scrollHeight + 'px';
  let h = '';
  for (const o of UI.ops) { let d; try { d = opPath(o); } catch (e) { d = null; } if (!d) continue; const k = o.kind === 'call' ? 'call ' + String(o.via || 'api').toLowerCase() : o.kind; h += `<path class="wbase ${k}" d="${d}"/><path class="wflow ${k}" id="op-${o.id}" d="${d}"/><circle class="pt ${k}" id="pt-${o.id}" r="4.5"/>`; }
  svg.innerHTML = h;
  for (const o of UI.ops) { const p = $('op-' + o.id); o.path = p; o.len = p ? p.getTotalLength() : 0; }
}
function tick(now) {
  const before = UI.ops.length;
  UI.ops = UI.ops.filter(o => now - o.t0 < o.dur);
  if (UI.ops.length !== before) drawOps();
  for (const o of UI.ops) { if (!o.path) continue; let f = Math.min(1, (now - o.t0) / o.dur); if (o.kind === 'call') f = f < .5 ? f * 2 : 2 - f * 2; const e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; const pt = o.path.getPointAtLength(e * o.len), c = $('pt-' + o.id); if (c) { c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('opacity', f > .96 && o.kind !== 'call' ? 0 : 1); } }
  UI.raf = UI.ops.length ? requestAnimationFrame(tick) : 0;
}

/* ---------- live runtime ---------- */
let RUNSEQ = 0;
/* Accept whatever layout the model uses: one object per line, pretty-printed objects, an array, or one wrapper object. */
function jsonObjects(text) {
  const out = []; let depth = 0, start = -1, inStr = false, escp = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (escp) escp = false; else if (c === '\\') escp = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}' && depth > 0) { depth--; if (depth === 0 && start >= 0) { out.push(text.slice(start, i + 1)); start = -1; } }
  }
  return out;
}
function normalizeOrch(o) {
  if (!o || typeof o !== 'object') return [];
  if (Array.isArray(o.decisions) || Array.isArray(o.tasks)) return [...(o.decisions || []).map(d => Object.assign({ k: 'decision' }, d)), ...(o.clarify ? [{ k: 'clarify', question: o.clarify }] : []), ...(o.tasks || []).map(t => Object.assign({ k: 'task' }, t))];
  const k = o.k || o.kind || (o.agent && o.objective ? 'task' : o.question ? 'clarify' : o.type && o.title ? 'decision' : o.type === 'end' ? 'end' : null);
  return k ? [Object.assign({}, o, { k })] : [];
}
function streamParser(onObj) {
  let seen = 0;
  return text => { const objs = jsonObjects(text); for (let k = seen; k < objs.length; k++) { try { normalizeOrch(JSON.parse(objs[k])).forEach(onObj); } catch (e) { } } seen = Math.max(seen, objs.length); };
}
async function runRequest(text, replay, opts = {}) {
  try { await runRequestInner(text, replay, opts); }
  catch (e) { if (UI.run && ['thinking', 'running'].includes(UI.run.status)) finishRun(UI.run, 'Unexpected problem: ' + errText(e)); console.error(e); }
}
async function runRequestInner(text, replay, opts = {}) {
  if (UI.run && ['thinking', 'running'].includes(UI.run.status)) return;
  text = text.trim(); if (!text) return;
  if (!replay && AI.mode !== 'live') { toast(AI.mode === 'checking' ? 'Connecting to the AI… try again in a moment.' : 'Live AI isn’t available here. Run it on claude.ai or with the deployment package.'); return; }
  const requester = replay ? replay.requester : UI.requester;
  if (replay) { UI.requester = requester; buildStaticWho(); }
  const run = { id: 'RUN-' + (++RUNSEQ), requester, text, clarified: opts.clarified || null, territory: null, t0: Date.now(), decisions: [], tasks: [], status: 'thinking', advisor: null, unit: null, stats: { reused: 0, reads: 0, calls: 0, mcp: 0, committed: 0, pending: 0, blocked: 0, rejected: 0, task: 0, ai: 0 }, orchText: '', record: { name: text.slice(0, 60), requester, text, orch: '', agents: {} }, replay };
  UI.run = run; UI.ctl = new AbortController(); F.runs.push(run); UI.totals.runs++;
  $('runBtn').disabled = true; $('stopBtn').hidden = false; $('cmdIn').value = ''; $('cmdIn').blur();
  setTab('decisions');
  logEvent('request.received', `${EMPLOYEES[requester].name}: ${text}`, requester);
  addOp({ kind: 'request', dur: 900 });
  run.resolution = resolveEntities(text);
  const top = run.resolution.candidates[0];
  const R = run.resolution, bits = [];
  if (top) bits.push(`${top.name} (${top.firm})${top.fromSession ? ', carried over from this conversation' : ''}`);
  R.people.forEach(p => bits.push(`${p.name}: colleague in ${p.team}, not an advisor`));
  R.territories.forEach(t => bits.push(`${t.name} territory: ${t.advisors.length} advisors`));
  R.funds.forEach(f => bits.push(`${f.ticker}: ${f.name}`));
  run.decisions.push({ type: 'lookup', src: 'code', title: bits.length ? `${bits.length} ${bits.length === 1 ? 'entity' : 'entities'} resolved` : 'Nothing the graph recognizes', detail: bits.join(' · ') || 'No advisor, colleague, territory or fund matched. Orchestration will interpret the request.' });
  flashTile('graph', 'read'); renderAll();
  /* 1. orchestrator */
  const onObj = o => handleOrch(run, o);
  try {
    if (replay) {
      for (const line of replay.orch.split('\n')) { if (UI.ctl.signal.aborted) throw { code: 'cancelled' }; await sleep(JSON.parse(line).k === 'task' ? 450 : 650); run.orchText += line + '\n'; onObj(JSON.parse(line)); renderAll(); }
    } else {
      const feed = streamParser(o => { onObj(o); renderAll(); });
      run.stats.ai++;
      const { text: full } = await AI.sample(orchestratorPrompt(run), { modelTier: 'default', cache: false, signal: UI.ctl.signal, onText: ({ text: t }) => { run.orchText = t; feed(t); updateStream(); } });
      run.orchText = full; feed(full);
      if (!run.tasks.length && !run.clarify) {
        run.decisions.push({ type: 'planfix', src: 'code', title: 'Plan unreadable; asking again in strict JSON', detail: 'The first reply had no usable tasks, so orchestration is asked once more for one JSON object.' }); renderAll();
        run.stats.ai++;
        const fix = await AI.sample.json(orchestratorPrompt(run) + '\n\nIMPORTANT: your previous reply could not be used. Reply now with ONE JSON object only: {"decisions":[{"type":"...","title":"...","detail":"..."}],"tasks":[{"id":"T1","agent":"...","objective":"...","depends_on":[],"reads":[],"tools":[],"why":"..."}]} including the entity decision.', { modelTier: 'default', cache: false, signal: UI.ctl.signal });
        normalizeOrch(fix).forEach(onObj); run.orchText += '\n' + JSON.stringify(fix);
      }
    }
  } catch (e) {
    if (e.code === 'not_granted' || e.code === 'sampling_disabled' || e.code === 'not_declared') { AI.mode = 'replay-only'; setAIStatus(); return finishRun(run, 'Claude access isn’t allowed in this view, so live runs are off. Allow access when claude.ai asks, then reload.'); }
    if (e.code === 'cancelled') return finishRun(run, 'Stopped.');
    if (e.code === 'rate_limited' || e.code === 'session_expired' || e.code === 'refused') return finishRun(run, `Orchestration failed: ${errText(e)}`);
    if (!run.tasks.length && !run.clarify) run.decisions.push({ type: 'planfix', src: 'code', title: 'AI plan failed; using the rules-based plan', detail: `Orchestration hit a problem (${errText(e)}), so a plan was built from rules instead.` });
    else if (!run.tasks.length) return finishRun(run, `Orchestration failed: ${errText(e)}`);
  }
  /* guarantees: an entity, and a plan */
  if (!run.decisions.some(d => d.type === 'entity')) {
    const R = run.resolution, c = R.candidates[0];
    if (c && c.score >= 2) run.advisor = c.advisor; if (!run.advisor && R.territories[0]) run.territory = R.territories[0].id;
    run.decisions.push({ type: 'entity', src: 'code', title: run.advisor ? `Using ${ADVISORS[run.advisor].name} from the graph` : run.territory ? `Using ${TERRITORIES[run.territory].name} territory` : 'No advisor for this request', detail: 'Orchestration didn’t state an entity, so the graph lookup result is used.' });
  }
  if (!run.tasks.length && !run.clarify) {
    run.decisions.push({ type: 'planfix', src: 'code', title: 'Rules-based plan', detail: 'No usable AI plan, so specialists were chosen by rules from the request’s wording.' });
    fallbackPlan(run).forEach(o => handleOrch(run, o)); renderAll();
  }
  run.record.orch = run.orchText.split('\n').filter(s => s.trim().startsWith('{')).join('\n');
  if (run.clarify) { run.status = 'clarify'; renderAll(); $('runBtn').disabled = false; $('stopBtn').hidden = true; return; }
  if (!run.tasks.length) return finishRun(run, 'Orchestration produced no tasks.');
  /* registry governance on the plan */
  if (run.advisor) { F.session.advisor = run.advisor; F.session.unit = run.unit || null; }
  F.session.requests.push({ text, adv: run.advisor });
  run.status = 'running'; renderAll();
  /* 2. execute in dependency order, two at a time */
  const done = new Set();
  while (run.tasks.some(t => !t.state || t.state === 'queued')) {
    if (UI.ctl.signal.aborted) return finishRun(run, 'Stopped.');
    const ready = run.tasks.filter(t => (!t.state || t.state === 'queued') && t.depends_on.every(d => done.has(d)));
    if (!ready.length) { run.tasks.filter(t => t.state === 'queued').forEach(t => t.depends_on = []); continue; }
    for (let k = 0; k < ready.length; k += 2) {
      await Promise.all(ready.slice(k, k + 2).map(t => runTask(run, t).catch(e => { t.state = 'failed'; t.error = errText(e); renderAll(); })));
      ready.slice(k, k + 2).forEach(t => done.add(t.id));
      if (UI.ctl.signal.aborted) return finishRun(run, 'Stopped.');
    }
  }
  finishRun(run);
}
function handleOrch(run, o) {
  if (o.k === 'decision') {
    run.decisions.push(Object.assign({ src: 'ai' }, o));
    if (o.type === 'entity') { if (o.advisor && ADVISORS[o.advisor]) run.advisor = o.advisor; if (o.unit && run.advisor && ADVISORS[run.advisor].units[o.unit]) run.unit = o.unit; if (o.territory && TERRITORIES[o.territory]) run.territory = o.territory; else if (!run.advisor && run.resolution.territories[0]) run.territory = run.resolution.territories[0].id; UI.memAdv = run.advisor || UI.memAdv; flashTile('graph', 'read'); }
    if (o.type === 'known') flashTile('memory', 'read');
  } else if (o.k === 'task') {
    if (run.tasks.length >= 5) return;
    const arr = x => Array.isArray(x) ? x : x ? [x] : [];
    let id = String(o.id || 'T' + (run.tasks.length + 1)); if (run.tasks.some(x => x.id === id)) id = 'T' + (run.tasks.length + 1);
    const t = { id, agent: resolveAgentId(o.agent) || String(o.agent || ''), objective: String(o.objective || o.task || '').slice(0, 300), depends_on: arr(o.depends_on || o.dependsOn).map(String), reads: arr(o.reads).map(String), tools: arr(o.tools).map(resolveToolName).filter(Boolean), why: String(o.why || '').slice(0, 200) };
    if (!t.objective) t.objective = AGENTS[t.agent] ? AGENTS[t.agent].does : 'Contribute to the request';
    if (!AGENTS[t.agent]) { run.decisions.push({ type: 'registry', src: 'code', title: `Unknown agent “${t.agent}” dropped`, detail: 'Orchestration can only route to registered specialists.' }); return; }
    const bad = t.tools.filter(x => !toolAllowed(t.agent, x));
    if (bad.length) { t.tools = t.tools.filter(x => toolAllowed(t.agent, x)); run.decisions.push({ type: 'registry', src: 'code', title: `${AGENTS[t.agent].name}: ${bad.length} tool${bad.length > 1 ? 's' : ''} removed`, detail: `${bad.join(', ')} ${bad.length > 1 ? 'are' : 'is'} not on this agent’s allow-list at the gateway.` }); UI.totals.blocked++; }
    t.depends_on = t.depends_on.filter(d => run.tasks.some(x => x.id === d));
    t.state = 'queued'; run.tasks.push(t);
  } else if (o.k === 'clarify') {
    if (run.clarified) run.decisions.push({ type: 'missing', src: 'code', title: 'Proceeding on your earlier answer', detail: `Orchestration wanted to ask “${o.question}” again; the app lets it ask only once, so it continues with stated assumptions.` });
    else run.clarify = String(o.question || 'Which advisor do you mean?');
  }
}
async function runTask(run, t) {
  const a = AGENTS[t.agent], sig = UI.ctl.signal;
  t.state = 'running'; t.t0 = Date.now(); UI.openTask = t.id; renderAll();
  addOp({ kind: 'dispatch', agent: t.agent, dur: 800 }); await sleep(800);
  /* foundation assembles the context packet */
  t.packet = buildPacket(t, run);
  const layers = [...new Set(t.packet.items.map(i => i.layer))];
  layers.forEach((l, k) => { addOp({ kind: 'read', agent: t.agent, layer: l, lane: k - (layers.length - 1) / 2, dur: 1400 }); flashTile(l, 'read'); });
  const reusedItems = t.packet.items.filter(i => { const rec = F.memory.find(m => m.id === i.id) || F.findings.find(k => k.id === i.id); return rec && (rec.origin || rec.by) && (rec.origin || rec.by) !== t.agent; });
  run.stats.reads += t.packet.items.length;
  renderAll(); await sleep(1200);
  /* upstream work */
  const upstream = t.depends_on.map(d => run.tasks.find(x => x.id === d)).filter(x => x && x.result).map(x => ({ task: x.id, agent: x.agent, title: x.result.output?.title || '', body: x.result.output?.body || '', ids: (x.verdicts || []).filter(v => v.id).map(v => v.id) }));
  t.upstreamReuse = upstream.length;
  upstream.forEach((up, k) => { const pub = run.tasks.find(x => x.id === up.task); const l = pub && pub.verdicts && pub.verdicts.some(v => v.kind === 'memory' && v.status === 'committed') ? 'memory' : 'knowledge'; addOp({ kind: 'handoff', from: up.agent, agent: t.agent, layer: l, lane: k, dur: 2000 }); });
  if (upstream.length) await sleep(900);
  t.calls = []; t.toolResults = [];
  const onCall = async (name, input) => {
    if (sig.aborted) throw new Error('stopped');
    const T = TOOLS[name];
    if (!T || !toolAllowed(t.agent, name)) { t.calls.push({ name, input, error: 'Not permitted for this agent' }); UI.totals.blocked++; renderAll(); throw new Error(`${name} is not permitted for ${a.name}`); }
    addOp({ kind: 'call', agent: t.agent, sys: T.sys, via: T.via, dur: 1500 });
    let out; try { out = capResult(T.run(input && typeof input === 'object' ? input : {})); } catch (e) { t.calls.push({ name, input, error: e.message }); renderAll(); throw e; }
    t.calls.push({ name, input, sys: T.sys, via: T.via, rw: T.rw, out }); t.toolResults.push({ name, out });
    run.stats.calls++; UI.totals.calls++; if (T.via === 'MCP') { run.stats.mcp++; UI.totals.mcp++; }
    run.record.agents[t.id] = run.record.agents[t.id] || { calls: [] }; run.record.agents[t.id].calls.push([name, input]);
    renderAll(); await sleep(900);
    return out;
  };
  let res;
  if (run.replay) {
    const rec = run.replay.agents[t.id] || { calls: [], json: { says: 'No recording for this task.', output: null } };
    await sleep(700);
    for (const [n, inp] of rec.calls) await onCall(n, inp);
    await sleep(900); res = clone(rec.json);
  } else {
    const useTools = AI.tools && t.tools.length;
    if (!useTools && t.tools.length) { /* fetch the planned tools for the agent */
      t.prefetched = {};
      for (const n of t.tools) { try { t.prefetched[n] = await onCall(n, defaultArgs(n, run, t)); } catch (e) { } }
    }
    run.stats.ai++;
    try {
      res = await AI.sample.json(agentPrompt(t, run, t.packet, upstream, useTools), Object.assign({ modelTier: AI.deep ? 'default' : 'quick', signal: sig }, useTools ? { tools: toolDefs(t, onCall) } : { cache: false }));
      const probe = sanitizeResult(res); if (!probe.output && !probe.says) throw { code: 'empty_completion', message: 'no usable fields' };
    } catch (e) {
      if (e.code === 'not_granted' || e.code === 'sampling_disabled') { AI.mode = 'replay-only'; setAIStatus(); throw e; }
      if (e.code === 'cancelled' || e.code === 'rate_limited' || e.code === 'refused') throw e;
      t.retry = errText(e); renderAll();
      t.prefetched = t.prefetched || {};
      for (const n of t.tools) if (!(n in t.prefetched)) { try { t.prefetched[n] = await onCall(n, defaultArgs(n, run, t)); } catch (x) { t.prefetched[n] = 'unavailable: ' + (x.message || x); } }
      run.stats.ai++;
      res = await AI.sample.json(agentPrompt(t, run, t.packet, upstream, false) + '\nReply with the JSON object only.', { modelTier: 'default', cache: false, signal: sig });
    }
  }
  res = sanitizeResult(res);
  if (!res.output && !res.says) throw new Error('the agent returned nothing usable');
  t.result = res; run.record.agents[t.id] = Object.assign(run.record.agents[t.id] || { calls: [] }, { json: res });
  /* gatekeeper */
  const ctx = { run, packet: t.packet, toolIds: t.calls.flatMap(c => [c.name, ...JSON.stringify(c.out || '').match(/[A-Z]+-[A-Z0-9-]+/g) || []]), toolResults: t.toolResults, upstream, upstreamIds: upstream.flatMap(u => u.ids.concat([u.task])) };
  t.verdicts = gatekeep(t, res, ctx);
  /* count reuse the foundation made possible */
  const usedIds = new Set(res.used || []);
  const reused = reusedItems.filter(i => usedIds.has(i.id)).length + (upstream.length ? 1 : 0) * upstream.length;
  run.stats.reused += reused; UI.totals.reused += reused;
  for (const v of t.verdicts) {
    if (['published', 'committed'].includes(v.status)) { run.stats.committed++; UI.totals.committed++; }
    if (['pending', 'approval'].includes(v.status)) { run.stats.pending++; if (v.status === 'pending') UI.totals.pending++; }
    if (['blocked', 'rejected'].includes(v.status)) { run.stats.blocked++; UI.totals.blocked++; }
    if (v.status === 'task') run.stats.task++;
  }
  const wl = new Set(t.verdicts.filter(v => !['blocked', 'rejected', 'read'].includes(v.status)).map(v => ({ knowledge: 'knowledge', memory: 'memory', commitment: 'events', output: 'knowledge' }[v.kind])));
  if (t.verdicts.some(v => v.event)) wl.add('events');
  if (t.verdicts.some(v => ['published', 'committed'].includes(v.status))) wl.add('graph');
  [...wl].forEach((l, k) => { addOp({ kind: 'write', agent: t.agent, layer: l, lane: k - (wl.size - 1) / 2, dur: 1400 }); flashTile(l, 'write'); });
  if (t.verdicts.some(v => v.status === 'blocked' || v.status === 'rejected')) flashTile('policy', 'write');
  /* event fan-out: subscribers get notified */
  const subs = new Set(t.verdicts.flatMap(v => v.event ? v.event.subscribers : []));
  subs.forEach(sid => { const el = pillEl(sid); if (el) { el.classList.remove('notified'); void el.offsetWidth; el.classList.add('notified'); } });
  t.state = 'done'; t.t1 = Date.now();
  if (t.verdicts.some(v => v.kind === 'memory')) badge('memory', true);
  if (t.verdicts.some(v => v.kind === 'output')) badge('outputs', true);
  renderAll(); await sleep(1100);
}
function defaultArgs(n, run, t) {
  const tick = mentionsFunds(run.text + ' ' + t.objective), people = (run.resolution.people || []).map(p => p.name);
  const when = /next month/i.test(run.text) ? 'next month' : /next week/i.test(run.text) ? 'next week' : /tomorrow/i.test(run.text) ? 'tomorrow' : 'soon';
  return { advisor_id: run.advisor || '', ticker: tick[0] || 'GFFFX', tickers: tick.length ? tick : ['GFFFX'], name: tick[0] || '', amount_usd: 1000000, query: t.objective, weights: tick.length > 1 ? { [tick[0]]: 50, [tick[1]]: 50 } : { VIGAX: 70, GFFFX: 30 }, category: tick[0] || 'Large Growth', territory: run.territory || 'LA', content_type: 'advisor email', to: run.advisor ? ADVISORS[run.advisor].name : people[0] || '', subject: t.objective.slice(0, 60), attendees: [run.advisor, ...people].filter(Boolean), when, title: t.objective.slice(0, 60), time: '' };
}
function errText(e) {
  const map = { not_granted: 'Claude access wasn’t allowed in this view', rate_limited: 'too many requests right now; wait a moment and try again', invalid_json: 'the reply wasn’t valid JSON', empty_completion: 'Claude returned nothing', tools_unavailable: 'tool use isn’t available here', prompt_too_large: 'the request was too large', upstream_error: 'a temporary connection problem', refused: 'Claude declined this request', session_expired: 'your session expired; sign in again', auth_failed: 'the server’s AI key was rejected; check OPENAI_API_KEY', cancelled: 'stopped' };
  return e && e.code ? `${map[e.code] || e.code}${e.message && !map[e.code] ? ' (' + e.message + ')' : ''}` : String(e && e.message || e);
}
function finishRun(run, error) {
  run.status = error ? 'failed' : 'done'; run.error = error; run.t1 = Date.now();
  $('runBtn').disabled = false; $('stopBtn').hidden = true;

  if (!error) logEvent('plan.completed', `${run.tasks.length} tasks · ${run.stats.reused} reused · ${run.stats.committed} stored`, 'orch', run.advisor);
  renderAll();
}

/* ---------- panes ---------- */
function updateStream() {}
const SI = { done: '✓', active: '', pending: '', skipped: '–', failed: '!' };
function stepBody(r, s) {
  if (s.id === 'plan') {
    const succ = s.items.filter(d => d.type === 'success'), fixes = s.items.filter(d => d.type === 'planfix');
    return `${fixes.map(d => `<div class="dl"><span class="tag2 code">RULE</span><span><b>${esc(d.title)}</b> ${esc(d.detail || '')}</span></div>`).join('')}${r.tasks.map(t => `<div class="dl"><span class="tid" style="background:${TC[AGENTS[t.agent].team]}">${t.id}</span><span><b>${esc(AGENTS[t.agent].name)}</b> · ${esc(t.objective)}${t.depends_on.length ? ` <small>after ${t.depends_on.join(', ')}</small>` : ''}</span></div>`).join('')}${succ.map(d => `<div class="dl"><span class="tag2 ai">DONE WHEN</span><span>${esc(d.title)}</span></div>`).join('')}`;
  }
  if (s.id === 'execute') {
    return r.tasks.map(t => { const up = t.depends_on.map(d => r.tasks.find(x => x.id === d)).filter(Boolean);
      const icon2 = t.state === 'done' ? '✓' : t.state === 'running' ? '<span class="spin"></span>' : t.state === 'failed' ? '!' : '·';
      return `<div class="dl"><span class="tid ${t.state || ''}" style="background:${TC[AGENTS[t.agent].team]}">${icon2}</span><span><b>${esc(AGENTS[t.agent].name)}</b>${t.state === 'done' && t.result ? ` · ${esc(t.result.says)}` : t.state === 'failed' ? ` · failed: ${esc(t.error)}` : t.state === 'running' ? ' · working' : ' · waiting'}${up.length ? `<small>Builds on ${up.map(x => esc(x.id + ' ' + AGENTS[x.agent].name)).join(', ')} through the foundation</small>` : ''}${t.verdicts ? `<small>${t.verdicts.map(v => `${v.kind} ${v.status}`).join(' · ')}</small>` : ''}</span></div>`; }).join('');
  }
  return s.items.map(d => `<div class="dl"><span class="tag2 ${d.src === 'code' ? 'code' : 'ai'}">${d.src === 'code' ? 'RULE' : 'AI'}</span><span><b>${esc(d.title)}</b>${d.detail ? ' ' + esc(d.detail) : ''}${d.uses && d.uses.length ? `<small>${esc(d.uses.join(' · '))}</small>` : ''}</span></div>`).join('');
}
function renderDecisions() {
  const r = UI.run, pane = $('pane-decisions');
  if (!r) { patchList(pane, [{ key: 'empty', cls: 'empty', html: `<p style="font:400 19px/1.4 var(--serif);color:var(--ink);margin:0 0 8px">Pick who you are, type an outcome, press Enter.</p>Orchestration works through nine steps: understand the request, resolve who and what it is about, set the scope, reuse what is known, find the gaps, apply the memory rule, set controls, plan, and execute with the right specialists. Each step fills in here as it is decided.` }]); return; }
  const items = [];
  if (r.status === 'done') items.push({ key: 'sum', cls: 'summary', html: `<h3>${r.tasks.length} specialists · ${Math.round((r.t1 - r.t0) / 1000)} s</h3><div class="sgrid"><div><b>${r.stats.reused}</b>facts reused</div><div><b>${r.stats.reads}</b>records delivered</div><div><b>${r.stats.calls}</b>system calls</div><div><b>${r.stats.committed}</b>stored</div><div><b>${r.stats.pending + r.stats.task}</b>kept scoped / pending</div><div><b>${r.stats.blocked}</b>blocked or rejected</div></div>` });
  if (r.status === 'failed') items.push({ key: 'fail', cls: 'blocked', html: `<b>${esc(r.error)}</b>${r.tasks.length ? '' : '<br>No specialist ran.'}<div style="margin-top:8px"><button class="lbtn" data-act="retry">Try again</button></div>${r.orchText ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px">What orchestration returned</summary><div class="stream">${esc(r.orchText.slice(-3000))}</div></details>` : ''}` });
  if (r.status === 'clarify') items.push({ key: 'clar-' + r.id, cls: 'clar', html: `<b>One question before planning</b><p style="margin:4px 0 0">${esc(r.clarify)}</p><input id="clarIn" placeholder="Your answer"><div style="display:flex;gap:6px;margin-top:6px"><button class="lbtn primary" data-act="answer">Continue</button><button class="lbtn" data-act="assume">Let it assume</button></div>` });
  items.push({ key: 'req-' + r.id, cls: 'dcard', html: `<div class="dt">REQUEST · ${esc(EMPLOYEES[r.requester].name)}, ${esc(TEAMS[EMPLOYEES[r.requester].team].name)}</div><b class="tt2">“${esc(r.text)}”</b>` });
  stepStates(r).forEach((s, k) => items.push({ key: 'st-' + s.id, cls: 'scard ' + s.state, html: `<div class="sh"><span class="sn">${s.state === 'done' ? '✓' : s.state === 'active' ? '<span class="spin"></span>' : k + 1}</span><b>${s.name}</b>${s.state === 'skipped' ? '<small>not stated</small>' : ''}</div>${['pending', 'skipped'].includes(s.state) && !(s.id === 'execute' && r.tasks.length) ? '' : `<div class="sb">${stepBody(r, s)}</div>`}` }));
  patchList(pane, items);
}
function taskHTML(r, t) {
  const a = AGENTS[t.agent], st = t.state || 'queued', p = t.packet;
  const byLayer = p ? LAYER_ORDER.map(l => [l, p.items.filter(i => i.layer === l)]).filter(x => x[1].length) : [];
  return `<summary><span class="av" style="background:${TC[a.team]};width:28px;height:28px;border-radius:8px;font-size:12px;font-weight:800;color:#0e2135">${t.id}</span><span><b>${esc(a.name)}</b><small>${esc(TEAMS[a.team].name)} · ${esc(t.objective)}</small></span><span class="st ${st}">${st === 'queued' ? 'Waiting' : st === 'running' ? 'Working' : st === 'done' ? 'Done' : 'Failed'}</span></summary><div class="tbody">
    ${p ? `<div class="sec"><b>${icon('memory')} Foundation → ${esc(a.name)} · ${p.items.length} items</b>${byLayer.map(([l, its]) => its.map(i => `<div class="pk"><span class="lid">${esc(i.id)}</span><span>${esc(i.label)}: ${esc(String(i.value).slice(0, 150))}<small>${esc(LAYERS[l].short)} · from ${esc(i.from)} · scope ${esc(i.scope)}</small></span></div>`).join('')).join('')}${p.withheld.map(w => `<div class="wh">Withheld ${esc(w.id)}: ${esc(w.why)}</div>`).join('')}</div>` : ''}
    ${t.calls && t.calls.length ? `<div class="sec"><b>${icon('arrow')} ${esc(a.name)} → enterprise systems</b>${t.calls.map(c => `<div class="pk"><span class="vbadge ${c.via || 'API'}">${c.via || '—'}</span><span><code style="font:11.5px var(--code)">${esc(c.name)}(${esc(JSON.stringify(c.input || {}).slice(0, 90))})</code><small>${c.error ? 'Blocked: ' + esc(c.error) : esc(SYSTEMS[c.sys].name) + ' · ' + esc(JSON.stringify(c.out).slice(0, 140))}</small></span></div>`).join('')}</div>` : ''}
    ${t.result ? `<div class="sec"><b>${icon('bolt')} ${esc(a.name)} → foundation</b><p class="says">“${esc(t.result.says || '')}”</p>${t.result.output ? `<div class="outbody"><b>${esc(t.result.output.title)}</b>\n${md(t.result.output.body)}</div>` : ''}${(t.result.open_questions || []).length ? `<p class="hint" style="margin:6px 0 0">Open question: ${esc(t.result.open_questions.join(' '))}</p>` : ''}</div>` : ''}
    ${t.verdicts ? `<div class="sec"><b>${icon('shield')} Gatekeeper</b>${t.verdicts.length ? t.verdicts.map(v => `<div class="vd"><span class="vb ${v.status}">${v.status.toUpperCase()}</span><span><b>${esc(v.kind)}: ${esc(v.title)}</b><small>${esc(v.reason)}${v.event ? ` · event ${esc(v.event.type)} → ${esc(v.event.subscribers.map(agentName).join(', ') || 'no subscribers')}` : ''}</small></span></div>`).join('') : '<p class="hint">Nothing proposed for storage. Read only.</p>'}</div>` : ''}
    ${t.retry ? `<p class="hint" style="margin-top:6px">First attempt failed (${esc(t.retry)}); retried once.</p>` : ''}
    ${st === 'failed' ? `<div class="blocked">This agent failed: ${esc(t.error)}. The rest of the plan continued.</div>` : ''}
    ${st === 'running' && !t.result ? `<p class="hint" style="margin-top:8px">${t.packet ? 'Working…' : 'Waiting for its context packet…'}</p>` : ''}</div>`;
}
function renderPackets() {
  const r = UI.run, pane = $('pane-packets');
  if (!r || !r.tasks.length) { patchList(pane, [{ key: 'empty', cls: 'empty', html: 'When the plan runs, each specialist appears here with exactly what the foundation sent it, what it asked the enterprise systems, what it contributed, and what the gatekeeper decided.' }]); return; }
  patchList(pane, r.tasks.map(t => ({ key: r.id + t.id, tag: 'details', cls: 'tcard ' + (t.state || 'queued'), html: taskHTML(r, t) })));
  r.tasks.forEach(t => { const el = pane.querySelector(`[data-k="${r.id + t.id}"]`); if (el && t.state === 'running' && !el._opened) { el.open = true; el._opened = true; } });
}
function renderMemory() {
  const pane = $('pane-memory'), id = UI.memAdv || F.session.advisor || 'ADV-101', A = ADVISORS[id];
  const r = UI.run, fresh = r ? r.id : null, viewer = UI.requester;
  const mems = F.memory.filter(m => m.adv === id);
  const vis = m => m.access === 'shared' || (m.access === 'relationship' && A.coverage.includes(viewer)) || m.access === 'owner:' + viewer;
  const items = [
    { key: 'sel', cls: 'advsel', html: Object.entries(ADVISORS).map(([k, x]) => `<button class="who-chip" data-madv="${k}" aria-pressed="${k === id}" style="color:var(--ink);background:var(--card);border-color:var(--rule)"><i style="background:#dce8f4">${x.short[0]}</i>${esc(x.short)}</button>`).join('') },
    { key: 'head-' + id, cls: 'a360-head', html: `<span class="big">${A.short[0]}</span><div><b>${esc(A.name)}</b><small>${esc(A.title)} · ${esc(FIRMS[A.firm].name)}</small><div class="a360-meta">${Object.entries(A.units).map(([u, l]) => `<span ${F.session.unit === u ? 'style="background:var(--hl);color:var(--hl-fg);font-weight:700"' : ''}>${u} ${esc(l)}</span>`).join('')}</div></div>` },
    { key: 'kg-' + id, cls: 'kgwrap', html: kgCompact(id) }
  ];
  F.changes.filter(c => c.adv === id).slice(-3).reverse().forEach(c => items.push({ key: 'chg-' + c.id + c.rev, cls: 'change', html: `<div class="h2">MEMORY UPDATE · ${esc(c.id)} rev ${c.rev}</div><b>${esc(c.attr)}</b> · scope ${esc(c.scope)}<span class="bf">${esc(c.before)}</span>${esc(c.after)}<small style="display:block;color:var(--mute)">Source ${esc(c.src)} · captured by ${esc(agentName(c.by))}</small>` }));
  items.push({ key: 'conv-' + id, cls: 'memsec', html: `<h4><span>Current conversation</span><span>short-term</span></h4>${F.session.advisor === id ? `<div class="mrow"><b>Active: ${esc(A.short)} · ${esc(F.session.unit || 'no unit')}</b><small>${F.session.requests.filter(q => q.adv === id).slice(-3).map(q => esc(q.text)).join(' · ') || 'No requests yet'}</small></div>${F.session.requirements.slice(-4).map(q => `<div class="mrow"><b>Task requirement</b>${esc(q.text)}<small>Kept with the task, not as a lasting preference · ${esc(agentName(q.by))}</small></div>`).join('')}` : `<div class="mrow"><small>Not the advisor in this conversation.</small></div>`}` });
  items.push({ key: 'lt-' + id, cls: 'memsec', html: `<h4><span>Lasting preferences & facts</span><span>long-term</span></h4>${mems.map(m => vis(m) ? `<div class="mrow ${m.status === 'superseded' ? 'old' : ''} ${m.run && m.run === fresh ? 'hl' : ''}"><b>${esc(m.attr)}${m.rev > 1 ? ` · rev ${m.rev}` : ''}</b>${esc(m.value)}<small>${esc(m.id)} · scope ${esc(m.scope)} · ${esc(m.basis)} (${esc(m.src)})${m.access !== 'shared' ? ' · ' + (m.access === 'relationship' ? 'relationship team only' : 'private to its owner') : ''}</small></div>` : `<div class="mrow"><small>${esc(m.id)} · hidden from ${esc(EMPLOYEES[viewer].name)} (${m.access === 'relationship' ? 'relationship team only' : 'private'})</small></div>`).join('')}${(UNKNOWNS[id] || []).map(x => `<div class="mrow"><b>Not known</b>${esc(x)}</div>`).join('')}` });
  const pend = F.pending.filter(p => p.adv === id);
  if (pend.length) items.push({ key: 'pend-' + id, cls: 'memsec', html: `<h4><span>Pending validation</span><span>not yet memory</span></h4>${pend.map(p => `<div class="mrow pend"><b>${esc(p.attr)}</b>${esc(p.value)}<small>${esc(p.reason)} · proposed by ${esc(agentName(p.by))} · scope ${esc(p.scope)}</small></div>`).join('')}` });
  items.push({ key: 'hist-' + id, cls: 'memsec', html: `<h4><span>Interaction history</span><span>episodes in Salesforce</span></h4>${F.episodes.filter(e => e.adv === id).map(e => `<div class="mrow"><b>${esc(e.kind)} · ${esc(e.date)}</b>${esc(e.text)}<small>${esc(e.id)} · ${esc(e.scope)}</small></div>`).join('')}` });
  items.push({ key: 'com-' + id, cls: 'memsec', html: `<h4><span>Open commitments</span><span>workflow state</span></h4>${F.commitments.filter(c => c.adv === id && c.status === 'Open').map(c => `<div class="mrow ${c.run && c.run === fresh ? 'hl' : ''}"><b>${esc(c.title)}</b><small>${esc(c.id)} · ${esc(c.owner)} · due ${esc(c.due)}</small></div>`).join('') || '<div class="mrow"><small>None.</small></div>'}` });
  patchList(pane, items);
}
function egoGraph(id) {
  const edges = F.graph.edges.filter(e => e.from === id || e.to === id).slice(0, 14);
  const W = 420, H = 210, cx = W / 2, cy = H / 2;
  const nodes = edges.map((e, k) => { const other = e.from === id ? e.to : e.from, n = F.graph.nodes.find(x => x.id === other) || { label: other, type: 'x' }; const ang = -Math.PI / 2 + k * 2 * Math.PI / Math.max(edges.length, 1); return { x: cx + Math.cos(ang) * 150, y: cy + Math.sin(ang) * 78, n, e }; });
  const col = { firm: '#9fb6cc', unit: '#82b6ff', employee: '#ffd27a', memory: '#7fd4ab', finding: '#b9a5f5', output: '#f0b870', task: '#ff9f8a', fund: '#7fd4ab' };
  const isNew = o => o.e.run && UI.run && o.e.run === UI.run.id;
  return `<svg viewBox="0 0 ${W} ${H}">${nodes.map(o => `<line x1="${cx}" y1="${cy}" x2="${o.x}" y2="${o.y}" stroke="${isNew(o) ? '#ffd27a' : '#44698f'}" stroke-width="${isNew(o) ? 2.4 : 1.2}"/>`).join('')}${nodes.map(o => `<circle cx="${o.x}" cy="${o.y}" r="6" fill="${col[o.n.type] || '#9fb6cc'}"/><text x="${o.x}" y="${o.y + (o.y > cy ? 16 : -9)}" text-anchor="middle">${esc(String(o.n.label).slice(0, 22))}</text>`).join('')}<circle cx="${cx}" cy="${cy}" r="12" fill="#e6edf4"/><text x="${cx}" y="${cy + 26}" text-anchor="middle" style="font-weight:800">${esc(ADVISORS[id].short)}</text></svg>`;
}
function renderOutputs() {
  const pane = $('pane-outputs');
  if (!F.outputs.length) { patchList(pane, [{ key: 'empty', cls: 'empty', html: 'Briefs, drafts, findings and notes appear here as specialists finish. Anything client-facing waits for human approval.' }]); return; }
  patchList(pane, [...F.outputs].reverse().map(o => { const a = AGENTS[o.agent], body = md(o.body);
    return { key: o.id, cls: 'dcard', html: `<div class="dt"><span class="av sm" style="background:${TC[a.team]};width:18px;height:18px;border-radius:5px"></span>${esc(a.name)} · ${esc(o.kind)} · ${esc(o.run)}</div>${o.kind === 'email' ? `<div class="olk" style="margin-top:6px"><div class="bar"><span>Outlook draft</span><span>${esc(o.status)}</span></div><div class="bd"><b>${esc(o.title)}</b>\n\n${body}</div></div>` : `<b class="tt2">${esc(o.title)}</b><div class="outbody" style="margin-top:5px">${body}</div>`}
      <p class="hint" style="margin:6px 0 0">Used: ${esc((o.used || []).join(', ') || '—')}${o.flagged && o.flagged.length ? ` · <b style="color:var(--hl-fg)">Check before use: ${esc(o.flagged.join(', '))}</b>` : ''}</p>${o.status === 'Waiting for approval' ? `<button class="lbtn primary" data-approve="${o.id}" style="margin-top:6px">${icon('check')} Approve</button>` : `<span class="vb published" style="display:inline-block;margin-top:6px">${esc(o.status.toUpperCase())}</span>`}` }; }));
}
function renderEvents() {
  const pane = $('pane-events');
  if (!F.events.length) { patchList(pane, [{ key: 'empty', cls: 'empty', html: 'Every change in the foundation publishes an event, and subscribing specialists are notified.' }]); return; }
  patchList(pane, [...F.events].reverse().slice(0, 80).map(e => ({ key: e.id, cls: 'vd', html: `<span class="vb read">${esc(e.id)}</span><span><b>${esc(e.type)}</b> · ${esc(e.detail)}<small>${esc(agentName(e.by))} · ${esc(e.at)}${e.subscribers.length ? ' · notified ' + esc(e.subscribers.map(agentName).join(', ')) : ''}</small></span>` })));
}
const PANES = { decisions: renderDecisions, packets: renderPackets, memory: renderMemory, outputs: renderOutputs, events: renderEvents };
let RQ = 0;
function renderAll() { if (RQ) return; RQ = requestAnimationFrame(() => { RQ = 0; renderOrch(); renderDiagram(); renderStats(); PANES[UI.tab](); autoScroll(); if (KG.open) renderKG(); }); }
/* Follow the work while agents run; pause for 5 s whenever the person scrolls. */
function autoScroll() {
  const r = UI.run; if (!r || !['thinking', 'running'].includes(r.status)) return;
  if (performance.now() - (UI.userScrollAt || -1e9) < 5000) return;
  const pane = $('pane-' + UI.tab); if (!pane || pane.hidden) return;
  let target = null;
  if (UI.tab === 'decisions') { const lines = [...pane.querySelectorAll('.scard.active .dl')]; target = lines.filter(l => l.querySelector('.tid.running')).pop() || lines.pop() || pane.querySelector('.scard.active'); }
  else if (UI.tab === 'packets') target = [...pane.querySelectorAll('details.tcard.running')].pop();
  else return;
  if (!target) return;
  const pr = pane.getBoundingClientRect(), tr = target.getBoundingClientRect();
  const below = tr.bottom - pr.bottom + 20, above = tr.top - pr.top - 12;
  const followBottom = UI.tab === 'packets';
  if (below > 0) pane.scrollTo({ top: pane.scrollTop + (tr.height > pr.height - 40 && !followBottom ? above : below), behavior: reduceMotion ? 'auto' : 'smooth' });
  else if (above < 0) pane.scrollTo({ top: pane.scrollTop + above, behavior: reduceMotion ? 'auto' : 'smooth' });
}
['wheel', 'touchmove', 'keydown'].forEach(ev => document.addEventListener(ev, e => { if (e.target.closest && e.target.closest('.pane')) UI.userScrollAt = performance.now(); }, { passive: true }));
document.addEventListener('pointerdown', e => { if (e.target.classList && e.target.classList.contains('pane')) UI.userScrollAt = performance.now(); });

/* ---------- chrome ---------- */
function buildStaticWho() { document.querySelectorAll('[data-who]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === UI.requester))); renderSugs(); }
function badge(t, on) { const b = document.querySelector(`.tab[data-tab="${t}"]`); if (b && UI.tab !== t) b.classList.toggle('has', on); }
function setTab(t) { UI.tab = t; document.querySelectorAll('.tab').forEach(b => { b.setAttribute('aria-selected', String(b.dataset.tab === t)); if (b.dataset.tab === t) b.classList.remove('has'); }); document.querySelectorAll('.pane').forEach(p => p.hidden = p.id !== 'pane-' + t); if (PANES[t]) PANES[t](); }
function setView(v) { UI.view = v; $('app').dataset.view = v; document.querySelectorAll('.mnav button').forEach(b => b.setAttribute('aria-current', String(b.dataset.view === v))); if (v !== 'live') setTab(v); }
let tt; function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3400); }
function openDrawer(title, body) { $('drawerTitle').innerHTML = title; $('drawerBody').innerHTML = body; $('drawer').hidden = false; $('scrim').hidden = false; }
function closeDrawer() { $('drawer').hidden = true; $('scrim').hidden = true; }
function openHelp() {
  openDrawer('How it works', `<p class="lead">Type a request as anyone in Sales, Product, Marketing or Service. The app runs it live.</p>
  <dl class="kv"><dt>Orchestration</dt><dd>Claude reads the request and a snapshot of the foundation, then decides: who it’s about, the scope, what to reuse, what’s missing, how to classify anything new about the advisor, and which of the 37 specialists should work, in what order. Decisions stream in as they’re made.</dd>
  <dt>Specialists</dt><dd>Each planned agent is a separate Claude call. It receives only the context packet the foundation allows, can call its permitted Salesforce, Microsoft 365, Seismic, data-platform and Morningstar tools, and returns a structured contribution.</dd>
  <dt>Foundation</dt><dd>Plain rules, not AI. It builds each packet (withholding out-of-scope, personal or private records), then checks every contribution: evidence for findings, traceable numbers, the advisor’s own words for lasting preferences, scope, and human approval for anything client-facing.</dd>
  <dt>Events</dt><dd>Every stored change publishes an event; subscribing specialists light up.</dd>
  <dt>Memory</dt><dd>Current conversation, lasting preferences, pending validation, interaction history and open commitments, per advisor. “New session” ends the conversation; lasting memory stays.</dd>
  <dt>Replay</dt><dd>Every live run is recorded. Replays run through the same foundation and rules, so they’re safe for presentations.</dd>
  <dt>If AI misbehaves</dt><dd>An unreadable plan is requested again in strict JSON, then replaced by a rules-based plan. A clarifying question is asked at most once. Each specialist retries once. Internal outputs with untraceable numbers are flagged for checking; client-facing ones are blocked.</dd></dl>
  <div class="h">Try these in order</div><ol style="font-size:13.5px;padding-left:18px;margin:0"><li>Sales: “Identify the growing trends in LA territory”</li><li>Sales: “Compare BFA and AMBAL for Rachel and schedule a meeting with her next month”</li><li>Sales: “Prep me for my call with Alex tomorrow”</li><li>Marketing: “Draft the follow-up email to Alex using Product’s verified comparison”</li><li>Sales: “Alex said on today’s call he wants the numbers in an appendix from now on. Update his profile.” (watch it land as pending, not memory)</li><li>New session, then Sales: “What does Maya care about for her retirement committee?”</li></ol>
  <div class="h">Reference data</div><p class="hint">Advisors and teams are fictional. Fund expense ratios for GFA, VWUAX and VIGAX are from public fund pages as of the dates shown; other funds’ numbers are left out on purpose.</p>`);
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-who],[data-sug],[data-replay],[data-tab],[data-view],[data-act],[data-approve],[data-madv],[data-agent],[data-layer],[data-sys]'); if (!el) return;
  const d = el.dataset;
  if (d.who) { UI.requester = d.who; buildStaticWho(); return; }
  if (d.sug) { $('cmdIn').value = d.sug; $('cmdIn').focus(); return; }
  if (d.replay) { const rec = d.replay[0] === 'b' ? RECORDED[+d.replay.slice(1)] : UI.recordings[+d.replay.slice(1)]; runRequest(rec.text, rec); return; }
  if (d.tab) { setTab(d.tab); return; }
  if (d.view) { setView(d.view); return; }
  if (d.madv) { UI.memAdv = d.madv; renderMemory(); return; }
  if (d.approve) { const o = F.outputs.find(x => x.id === d.approve); if (o) { o.status = 'Approved · ready to send'; logEvent('approval.granted', o.title, UI.requester, o.adv); toast('Approved by ' + EMPLOYEES[UI.requester].name + '. Queued for the approved channel.'); renderAll(); } return; }
  if (d.act === 'kg') { openKG(d.adv); return; }
  if (d.act === 'answer' || d.act === 'assume') { const v = d.act === 'assume' ? 'Make your best assumption and continue' : $('clarIn').value.trim(); if (v) { const q = UI.run.clarify, t = UI.run.text.replace(/ \(clarification:.*\)$/, ''); UI.run = null; runRequest(`${t} (clarification: ${v})`, null, { clarified: { question: q, answer: v } }); } return; }
  if (d.act === 'retry') { const t = UI.run.text; UI.run = null; runRequest(t); return; }
  if (d.agent) { const a = AGENTS[d.agent]; openDrawer(esc(a.name), `<p class="hint">${esc(TEAMS[a.team].name)}</p><p class="lead">${esc(a.does)}</p><div class="h">Tools it may call</div>${a.tools.length ? a.tools.map(t => `<div class="pk"><span class="vbadge ${TOOLS[t].via}">${TOOLS[t].via}</span><span><code style="font:12px var(--code)">${esc(t)}</code><small>${esc(SYSTEMS[TOOLS[t].sys].name)} · ${esc(TOOLS[t].desc)}</small></span></div>`).join('') : '<p class="hint">None. It works only from the foundation.</p>'}<div class="h">Subscribed to</div><p class="hint">${Object.entries(SUBSCRIPTIONS).filter(([, v]) => v.includes(d.agent)).map(([k]) => k).join(', ') || 'No events'}</p>`); return; }
  if (d.layer === 'graph') { openKG(UI.memAdv || F.session.advisor); return; }
  if (d.act === 'kg') { openKG(d.adv); return; }
  if (d.layer) { const l = d.layer; openDrawer(esc(LAYERS[l].name), `<p class="lead">${esc({ memory: 'Scoped, sourced memory: current conversation, lasting preferences, pending validation, interaction history and commitments.', knowledge: 'Fund facts from the data platform, approved Seismic content, and verified findings agents have published.', policy: 'The rules every packet and contribution passes through.', models: 'Sales Alpha, peer match, cost on assets and portfolio construction.', feedback: 'Explicit reactions and outcomes.', events: 'Every committed change, and which specialists hear it.', graph: 'People, firms, buying units, memories, findings, outputs and their sources.' }[l])}</p>${l === 'policy' ? POLICIES.map(p => `<div class="pk"><span class="lid">${p.id}</span><span>${esc(p.text)}</span></div>`).join('') : l === 'knowledge' ? F.findings.map(k => `<div class="pk"><span class="lid">${esc(k.id)}</span><span><b>${esc(k.label)}</b>: ${esc(k.value)}<small>by ${esc(agentName(k.by))} · evidence ${esc(k.evidence.join(', '))}</small></span></div>`).join('') : `<p class="hint">${layerCount(l)} records right now. Open the Memory or Events tab for detail.</p>`}`); return; }
  if (d.sys) { const k = d.sys, tools = Object.entries(TOOLS).filter(([, t]) => t.sys === k); openDrawer(esc(SYSTEMS[k].name), `<p class="hint">${esc(SYSTEMS[k].sub)}</p>${tools.map(([n, t]) => `<div class="pk"><span class="vbadge ${t.via}">${t.via}</span><span><code style="font:12px var(--code)">${esc(n)}</code> · ${t.rw}<small>${esc(t.desc)}</small></span></div>`).join('')}`); return; }
});
$('runBtn').onclick = () => runRequest($('cmdIn').value);
$('stopBtn').onclick = () => UI.ctl && UI.ctl.abort();
$('cmdIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runRequest($('cmdIn').value); } });
$('sessionBtn').onclick = () => { F.session = { advisor: null, unit: null, requests: [], requirements: [] }; toast('New session. The conversation is closed; lasting memory, findings and commitments remain.'); renderAll(); };
$('resetBtn').onclick = () => { if (UI.run && ['thinking', 'running'].includes(UI.run.status)) return; F = freshFoundation(); UI.run = null; UI.totals = { runs: 0, reused: 0, committed: 0, pending: 0, blocked: 0, calls: 0, mcp: 0 }; toast('Foundation reset to its starting data.'); renderAll(); };
$('deepBtn').onclick = () => { AI.deep = !AI.deep; $('deepBtn').setAttribute('aria-pressed', String(AI.deep)); toast(AI.deep ? 'Agents will think longer (slower).' : 'Agents use the fast model.'); };
$('helpBtn').onclick = openHelp;
const SKINS = [['navy', 'Midnight navy', '#16375a'], ['graphite', 'Graphite', '#2a2e34'], ['evergreen', 'Evergreen', '#164039'], ['porcelain', 'Porcelain (light)', '#eef1f4']];
function setSkin(s) { document.documentElement.dataset.skin = s; try { localStorage.setItem('cce-skin', s); } catch (e) { } document.querySelectorAll('[data-skin-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.skinBtn === s))); requestAnimationFrame(drawOps); if (KG.open) renderKG(true); }
$('skinPick').innerHTML = SKINS.map(([k, n, c]) => `<button data-skin-btn="${k}" title="${n}" aria-label="Theme: ${n}" style="background:${c};box-shadow:inset 0 0 0 1px rgba(128,128,128,.5)"></button>`).join('');
$('skinPick').addEventListener('click', e => { const b = e.target.closest('[data-skin-btn]'); if (b) setSkin(b.dataset.skinBtn); });
let savedSkin = 'navy'; try { savedSkin = localStorage.getItem('cce-skin') || new URLSearchParams(location.search).get('theme') || 'navy'; } catch (e) { }
setSkin(savedSkin); $('drawerClose').onclick = closeDrawer; $('scrim').onclick = closeDrawer;
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (KG.open) closeKG(); else closeDrawer(); } });
addEventListener('resize', () => requestAnimationFrame(drawOps));


buildStatic(); renderAll(); setAIStatus(); drawOps(); setTimeout(kgInit, 0);
initAI().then(() => { setAIStatus(); if (AI.mode !== 'live') toast('Live AI isn’t available here. Run it on claude.ai or with the deployment package.'); });
