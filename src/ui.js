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
  check: '<path d="M5 12l5 5 9-10"/>', bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.file}</svg>`;
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>');
const agentName = id => AGENTS[id] ? AGENTS[id].name : id === 'orch' ? 'Orchestration' : EMPLOYEES[id] ? EMPLOYEES[id].name : id;
const UI = { requester: 'EMP-PRIYA', tab: 'updates', view: 'live', memAdv: null, ops: [], raf: 0, run: null, ctl: null, recordings: [], totals: { runs: 0, reused: 0, committed: 0, pending: 0, blocked: 0, calls: 0, mcp: 0 } };

/* ---------- static diagram ---------- */
function buildStatic() {
  $('whoRow').innerHTML = Object.entries(EMPLOYEES).map(([id, e]) => `<button class="who-chip" data-who="${id}" aria-pressed="${id === UI.requester}"><i style="background:${TC[e.team]}">${e.name.split(' ').map(x => x[0]).join('')}</i>${esc(e.name)} <small>${esc(TEAMS[e.team].name)}</small></button>`).join('');
  $('lanes').innerHTML = TEAM_ORDER.map(t => { const roles = Object.entries(ROLES).filter(([, r]) => r.team === t);
    return `<div class="lane bcol" data-team="${t}" style="--c:${TC[t]}"><h3><i style="background:${TC[t]}"></i>${TEAMS[t].name}<small>workbench</small></h3>${roles.map(([rid, r]) => `<div class="brole" id="role-${rid.replace('.', '-')}"><div class="brh" title="${esc(r.does)}"><b>${esc(r.name)}</b><small>${esc(r.does)}</small></div><div class="bagents" aria-label="Agents in this role">${Object.keys(AGENTS).filter(a => roleOf(a) === rid).map(a => `<span class="bag" id="bag-${a.replace('.', '-')}" title="${esc(AGENTS[a].name)}: ${esc(AGENTS[a].does)}">${esc(AGENTS[a].name)}</span>`).join('')}</div><div class="btasks" id="bt-${rid.replace('.', '-')}"></div></div>`).join('')}</div>`; }).join('');
  $('found').innerHTML = `<div class="tiles">${LAYER_ORDER.map(l => `<button class="tile" id="tile-${l}" data-layer="${l}"><span class="th">${icon(LAYERS[l].icon)}${LAYERS[l].short}</span><span class="cnt"></span><span class="tl"></span></button>`).join('')}</div><div class="fhead"><div><b>Shared AI foundation</b><span>Deterministic rules decide what each agent sees and what gets stored.</span></div><div class="ftot" id="ftot"></div></div>`;
  $('integ').innerHTML = `<div class="systems">${SYS_ORDER.map(k => `<button class="sys" id="sys-${k}" data-sys="${k}">${icon(SYSTEMS[k].icon)}<span><b>${SYSTEMS[k].name}</b><small>${SYSTEMS[k].sub}</small></span><span class="via"></span></button>`).join('')}</div><div class="gw"><b>Enterprise integration</b><span>MCP gateway · API gateway</span><span class="legend"><span class="via MCP" style="display:inline-block">MCP</span>agent tool call <span class="via API" style="display:inline-block">API</span>typed service call</span></div>`;
  $('orch').innerHTML = `<div class="ohead"><div class="oname">${icon('network')}Intelligence & orchestration</div><div class="oreq" id="oreq"></div></div><div class="pipe" id="pipe"></div><div class="othink" id="othink"></div><div class="tchips" id="tchips"></div>`;
  renderSugs(); renderOrch();
}
const pillEl = id => $('pl-' + String(id).replace('.', '-'));
const taskEl = id => $('tc-' + id);
const opEl = o => (o.task && taskEl(o.task)) || (o.agent && roleOf(o.agent) && $('role-' + roleOf(o.agent).replace('.', '-')));
function savedRun(text) { /* a run saved in this session wins over the built-in one */
  const u = UI.recordings.findIndex(r => r.text === text && r.requester === UI.requester); if (u >= 0) return 'u' + u;
  const b = RECORDED.findIndex(r => r.text === text && r.requester === UI.requester); return b >= 0 ? 'b' + b : null;
}
function renderSugs() {
  const t = EMPLOYEES[UI.requester].team;
  const own = UI.recordings.filter(r => r.requester === UI.requester && !SUGGESTIONS[t].includes(r.text)).map(r => r.text);
  $('sugs').innerHTML = [...SUGGESTIONS[t], ...own].map(s => { const rep = savedRun(s); return `<span class="sugw"><button class="sug" data-sug="${esc(s)}">${esc(s)}</button>${rep ? `<button class="sugrep" data-replay="${rep}" title="Play a saved run of this request: same foundation, tools and gatekeeper, no AI call" aria-label="Play saved run: ${esc(s)}">▶</button>` : ''}</span>`; }).join('');
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
const OSTEPS = [['understand', 'Understand', ['requester', 'intent', 'asks', 'interpretation']], ['resolve', 'Resolve', ['lookup', 'entity']], ['scope', 'Scope', ['scope']], ['reuse', 'Reuse', ['known']], ['gaps', 'Gaps', ['missing']], ['memory', 'Memory rule', ['memory']], ['controls', 'Controls', ['controls', 'registry', 'authority']], ['plan', 'Plan', ['planfix', 'success']], ['execute', 'Execute', []]];
function stepStates(r) {
  const s = OSTEPS.map(([id, name, types]) => ({ id, name, items: r ? r.decisions.filter(d => types.includes(d.type)) : [], state: 'pending' }));
  if (!r) return s;
  s.slice(0, 7).forEach(x => x.state = x.items.length ? 'done' : 'pending');
  s[7].state = r.tasks.length ? (r.status === 'thinking' ? 'active' : 'done') : 'pending';
  s[8].state = r.status === 'running' ? 'active' : r.status === 'done' ? 'done' : 'pending';
  if (r.status === 'thinking') { const f = s.find(x => x.state === 'pending'); if (f) f.state = 'active'; }
  if (['running', 'done', 'planned'].includes(r.status)) s.slice(0, 7).forEach(x => { if (x.state === 'pending') x.state = 'skipped'; });
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
    else if (r.status === 'running') { const run = [...new Set(r.tasks.filter(t => t.state === 'running').map(t => ROLES[t.role].name))]; think = `<span class="spin"></span><b>Workbench</b> · ${run.length ? esc(run.join(' and ')) + ' working' : 'assigning'} · ${r.tasks.filter(t => t.state === 'done').length} of ${r.tasks.length} tasks done`; }
    else if (r.status === 'clarify') think = '<b>Gaps</b> · waiting for your answer';
    else if (r.status === 'planned') think = `<b>Plan ready</b> · ${r.tasks.length} steps in ${new Set(r.tasks.map(t => t.wave)).size} waves · nothing has run yet`;
    else if (r.status === 'done') think = `<b>Complete</b> · ${r.tasks.length} tasks across ${new Set(r.tasks.map(t => ROLES[t.role].team)).size} teams in ${Math.round((r.t1 - r.t0) / 1000)} s`;
    else if (r.status === 'failed') think = `<b>Stopped</b> · ${esc(r.error || '')}`;
  }
  if (r && r.presentationPause) { const P = r.presentationPause; think = `<b>Wave ${P.wave} output ready</b> · ${P.wave < P.of ? 'Next wave' : 'Closing'} in ${P.seconds}s · Review the output below`; }
  setHTML($('othink'), think);
  patchList($('tchips'), r ? r.tasks.map(t => ({ key: t.id, cls: 'tchip ' + (t.state || ''), html: `<i style="--c:${TC[ROLES[t.role].team]}"></i>${esc(ROLES[t.role].name)}: ${esc(t.title)}` })) : []);
  $('orch').classList.toggle('active', !!r && ['thinking', 'running'].includes(r.status));
}

/* ---------- lanes, tiles, systems, stats ---------- */
function renderDiagram() {
  const r = UI.run;
  renderBoard(r);
  for (const l of LAYER_ORDER) {
    const el = $('tile-' + l);
    const last = [...F.events].reverse().find(e => layerOfEvent(e.type) === l);
    setHTML(el.querySelector('.cnt'), `<b>${layerCount(l)}</b> ${l === 'memory' ? 'memories & episodes' : l === 'graph' ? 'nodes' : l === 'events' ? 'events' : 'records'}`);
    const tlEl = el.querySelector('.tl'), tlText = l === 'memory' && F.changes.length ? `${F.changes[F.changes.length - 1].attr}: ${F.changes[F.changes.length - 1].after}` : last ? `${last.type}: ${last.detail}` : { memory: 'Advisor profiles, scoped and sourced', knowledge: 'Fund facts, findings, approved content', policy: POLICIES.length + ' rules applied to every agent', models: 'Sales Alpha, peer match, cost & construction', feedback: 'Outcomes and corrections', events: 'What changed, who hears it', graph: 'People, firms, units, sources, outputs' }[l];
    if (tlEl.textContent !== tlText) tlEl.textContent = tlText;
  }
  setHTML($('ftot'), `<span><b>${UI.totals.reused}</b>reused</span><span><b>${UI.totals.committed}</b>stored</span><span><b>${UI.totals.blocked}</b>blocked</span>`);
}
function taskStatus(t) {
  if (t.state === 'failed') return ['failed', 'Failed'];
  if (t.state === 'running') return ['running', 'In progress'];
  if (t.state === 'done') { const v = t.verdicts || []; if (v.some(x => x.status === 'approval')) return ['approval', 'Waiting for approval']; if (v.some(x => x.kind === 'output' && x.status === 'blocked')) return ['blocked', 'Blocked']; return ['done', 'Done']; }
  return ['queued', 'Assigned'];
}
function outOf(t) { const v = (t.verdicts || []).find(x => x.kind === 'output' && x.id); return v ? F.outputs.find(o => o.id === v.id) : null; }
function renderBoard(r) {
  for (const rid of Object.keys(ROLES)) {
    const box = $('bt-' + rid.replace('.', '-')), tasks = r ? r.tasks.filter(t => t.role === rid) : [];
    patchList(box, tasks.map(t => { const [cls, label] = taskStatus(t), o = outOf(t);
      return { key: r.id + t.id, cls: 'bcard ' + cls, html: `<button class="bcard-in" id="tc-${t.id}" data-task="${t.id}"><span class="bst"><i></i>${t.step ? 'Step ' + t.step + ' · ' : ''}${label}</span><b>${esc(t.title)}</b><small class="bwho">${icon('bell')} ${esc(t.person || '')}${cls === 'queued' ? ' notified' : ''}</small>${t.depends_on.length && cls === 'queued' ? `<small>after ${t.depends_on.map(d => { const x = r.tasks.find(y => y.id === d); return x ? esc(x.title) : d; }).join(', ')}</small>` : ''}${o && cls !== 'running' ? `<small class="bout">${esc(o.title)}</small>` : ''}</button>` }; }));
    $('role-' + rid.replace('.', '-')).classList.toggle('busy', tasks.some(t => t.state === 'running'));
    $('role-' + rid.replace('.', '-')).classList.toggle('has', tasks.length > 0);
  }
  /* which specialist agent is playing each role right now (shown quietly, in gray) */
  document.querySelectorAll('.bag').forEach(el => {
    const id = el.id.slice(4).replace('-', '.'), mine = r ? r.tasks.filter(t => t.agent === id) : [];
    el.classList.toggle('act', mine.some(t => t.state === 'running'));
    el.classList.toggle('used', mine.length > 0 && mine.every(t => ['done', 'failed'].includes(t.state)));
    el.classList.toggle('planned', mine.some(t => !t.state || t.state === 'queued'));
  });
}
const layerOfEvent = t => t.startsWith('knowledge') ? 'knowledge' : t.startsWith('memory') ? 'memory' : t.startsWith('approval') ? 'policy' : t.startsWith('commitment') ? 'events' : t.startsWith('content') ? 'knowledge' : 'events';
function renderStats() {
  const T = UI.totals, box = $('stats');
  const rows = [['runs', T.runs, 'requests'], ['reused', T.reused, 'reused'], ['committed', T.committed, 'stored'], ['pending', T.pending, 'pending'], ['blocked', T.blocked, 'blocked'], ['calls', T.calls, `calls · ${T.mcp} MCP`]];
  if (!box._built) { box.innerHTML = rows.map(([k, , l], i) => `<div class="stat ${i === 1 ? 'gold' : ''}" data-s="${k}"><b>0</b><span>${l}</span></div>`).join(''); box._built = true; }
  for (const [k, v, l] of rows) { const el = box.querySelector(`[data-s="${k}"]`), b = el.firstChild; if (b.textContent !== String(v)) { b.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } el.lastChild.textContent = l; }
}
function setAIStatus() {}

/* ---------- wires: routed through the gaps, drawn for every live operation ---------- */
function rectIn(el) { const d = $('diagram').getBoundingClientRect(), r = el.getBoundingClientRect(), dg = $('diagram'); return { x: r.left - d.left + dg.scrollLeft, y: r.top - d.top + dg.scrollTop, w: r.width, h: r.height }; }
const P2 = (x, y) => ({ x, y });
function cpath(a, b, k = .5) { const dy = Math.max(45, Math.abs(b.y - a.y) * k) * (b.y >= a.y ? 1 : -1); return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${a.x.toFixed(1)} ${(a.y + dy).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - dy).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`; }
function opPath(o) {
  const off = (o.lane || 0) * 14;
  const oe = o.kind === 'request' ? null : opEl(o); if (o.kind !== 'request' && !oe) return null;
  const pr = oe ? rectIn(oe) : null, pb = pr && P2(pr.x + pr.w / 2, pr.y + pr.h), pt = pr && P2(pr.x + pr.w / 2, pr.y);
  const tileTop = l => { const t = rectIn($('tile-' + l)); return P2(t.x + t.w / 2 + off, t.y); };
  if (o.kind === 'request') { const c = rectIn($('cmd')), r = rectIn($('orch')); return cpath(P2(c.x + c.w * .3, c.y + c.h), P2(c.x + c.w * .3, r.y)); }
  if (o.kind === 'dispatch') { const r = rectIn($('orch')); return cpath(P2(pt.x, r.y + r.h), pt); }
  if (o.kind === 'read') return cpath(tileTop(o.layer), pb);
  if (o.kind === 'write') return cpath(pb, tileTop(o.layer));
  if (o.kind === 'call') { const s = rectIn($('sys-' + o.sys)), e = P2(s.x + s.w / 2 + off / 2, s.y); return `M${pb.x.toFixed(1)} ${pb.y.toFixed(1)} C${pb.x.toFixed(1)} ${(pb.y + 170).toFixed(1)} ${e.x.toFixed(1)} ${(e.y - 170).toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`; }
  if (o.kind === 'handoff') { const fe = taskEl(o.fromTask); if (!fe) return null; const fr = rectIn(fe), a = P2(fr.x + fr.w / 2, fr.y + fr.h), t = tileTop(o.layer); return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${a.x.toFixed(1)} ${(a.y + 90).toFixed(1)} ${t.x.toFixed(1)} ${(t.y - 80).toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)} C${t.x.toFixed(1)} ${(t.y - 80).toFixed(1)} ${pb.x.toFixed(1)} ${(pb.y + 90).toFixed(1)} ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`; }
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
  const run = { id: 'RUN-' + (++RUNSEQ), requester, text, planOnly: !!opts.planOnly, clarified: opts.clarified || null, territory: null, t0: Date.now(), decisions: [], tasks: [], status: 'thinking', advisor: null, unit: null, stats: { reused: 0, reads: 0, calls: 0, mcp: 0, committed: 0, pending: 0, blocked: 0, rejected: 0, task: 0, ai: 0 }, orchText: '', record: { name: text.slice(0, 60), requester, text, orch: '', agents: {} }, replay };
  UI.run = run; UI.ctl = new AbortController(); F.runs.push(run); UI.totals.runs++;
  $('runBtn').disabled = true; $('planBtn').disabled = true; $('stopBtn').hidden = false; $('cmdIn').value = ''; $('cmdIn').blur();
  setTab('updates');
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
      /* decisions stream in faster than anyone can read; release them at a readable pace */
      const queue = []; let pumping = null;
      const pump = async () => { while (queue.length) { const o = queue.shift(); onObj(o); renderAll(); if (o.k !== 'end') await sleep(o.k === 'task' ? 450 : 750); } pumping = null; };
      const feed = streamParser(o => { queue.push(o); if (!pumping) pumping = pump(); });
      run.stats.ai++;
      const { text: full } = await AI.sample(orchestratorPrompt(run), { modelTier: 'default', cache: false, signal: UI.ctl.signal, onText: ({ text: t }) => { run.orchText = t; feed(t); updateStream(); } });
      run.orchText = full; feed(full);
      while (pumping) await pumping;
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
  if (run.tasks.length) finalizePlan(run);
  run.record.orch = run.orchText.split('\n').filter(s => s.trim().startsWith('{')).join('\n');
  if (run.clarify) { run.status = 'clarify'; renderAll(); $('runBtn').disabled = false; $('planBtn').disabled = false; $('stopBtn').hidden = true; return; }
  if (!run.tasks.length) return finishRun(run, 'Orchestration produced no tasks.');
  if (run.planOnly) { run.status = 'planned'; run.t1 = Date.now(); logEvent('plan.ready', `${run.tasks.length} steps in ${new Set(run.tasks.map(t => t.wave)).size} waves (not run)`, 'orch', run.advisor); $('runBtn').disabled = false; $('planBtn').disabled = false; $('stopBtn').hidden = true; renderAll(); return; }
  await executePlan(run);
}
/* Orchestration: run the plan wave by wave. Steps in a wave run together; each wave waits for the one before. */
async function executePlan(run) {
  if (run.advisor) { F.session.advisor = run.advisor; F.session.unit = run.unit || null; }
  F.session.requests.push({ text: run.text, adv: run.advisor });
  if (run.status === 'planned') run.t0 = Date.now();
  run.status = 'running'; $('runBtn').disabled = true; $('planBtn').disabled = true; $('stopBtn').hidden = false; renderAll();
  const waves = [...new Set(run.tasks.map(t => t.wave))].sort((a, b) => a - b);
  for (const w of waves) {
    if (UI.ctl.signal.aborted) return finishRun(run, 'Stopped.');
    const ws = run.tasks.filter(t => t.wave === w && (!t.state || t.state === 'queued'));
    await Promise.all(ws.map(t => runTask(run, t).catch(e => { t.state = 'failed'; t.error = errText(e); renderAll(); })));
    if (UI.ctl.signal.aborted) return finishRun(run, 'Stopped.');
    await holdForReading(run, w, waves.length);
  }
  finishRun(run);
}
/* Each wave's finished output stays on screen for READ_PAUSE_S before the next wave starts. */
async function holdForReading(run, wave, of) {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  run.presentationPause = { wave, of, seconds: READ_PAUSE_S };
  for (let left = READ_PAUSE_S; left > 0 && !UI.ctl.signal.aborted; left--) {
    run.presentationPause.seconds = left; renderAll();
    for (let k = 0; k < 10 && !UI.ctl.signal.aborted; k++) await sleep(100);
  }
  run.presentationPause = null; renderAll();
}
/* Tie every task to what was asked, and put the tasks in a clear order. */
function splitAsks(text) {
  const parts = text.replace(/\(clarification:.*\)$/i, '').split(/\s*(?:;|,\s*(?:and\s+)?|\s+and\s+(?=(?:also\s+)?(?:schedule|book|send|draft|create|write|prep|prepare|compare|find|identify|update|check|explain|set up|follow)))\s*/i).map(s => s.trim()).filter(s => s.split(' ').length >= 2);
  return (parts.length ? parts : [text]).slice(0, 4).map(s => s.charAt(0).toUpperCase() + s.slice(1));
}
function finalizePlan(run) {
  if (!run.asks || !run.asks.length) { run.asks = splitAsks(run.text).map(text => ({ text, tasks: [] })); run.decisions.push({ type: 'asks', src: 'code', title: `${run.asks.length} ${run.asks.length === 1 ? 'thing' : 'things'} requested`, detail: run.asks.map((a, k) => `${k + 1}. ${a.text}`).join(' · ') }); }
  const words = s => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !['with', 'from', 'that', 'this', 'their', 'month', 'next', 'have', 'about'].includes(w)));
  for (const t of run.tasks) {
    if (!(t.ask >= 1 && t.ask <= run.asks.length)) {
      const tw = words(t.title + ' ' + t.objective); let best = 1, score = -1;
      run.asks.forEach((a, k) => { const aw = words(a.text); let s = 0; aw.forEach(w => { if ([...tw].some(x => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))) s++; }); if (/schedul|meeting|book|calendar/.test(a.text.toLowerCase()) && t.role === 'sales.ssc') s += 3; if (s > score) { score = s; best = k + 1; } });
      t.ask = best;
    }
    run.asks[t.ask - 1].tasks.push(t.id);
  }
  run.asks.forEach((a, k) => { if (!a.tasks.length) run.decisions.push({ type: 'registry', src: 'code', title: `Not covered: “${a.text}”`, detail: 'No task serves this part of the request. Flagged so nothing is silently dropped.' }); });
  /* intelligence: there is always an interpretation; authority is settled by rule from the request's own words */
  if (!run.interp) { const d = run.decisions.find(x => x.type === 'intent'), LEGACY = { meeting_prep: 'prepare', research: 'retrieve', content: 'draft', campaign: 'draft', service: 'diagnose', profile_update: 'remember', question: 'retrieve' }; run.interp = ruleInterpretation(run, d ? (INTENTS[d.intent] ? d.intent : LEGACY[d.intent] || null) : null); run.decisions.push({ type: 'interpretation', src: 'code', title: 'Interpretation built from rules', detail: 'Orchestration didn’t state one, so it comes from the graph lookup and the request’s wording.' }); }
  const rule = authorityFromText(run.text, EMPLOYEES[run.requester].team), asked = run.interp.authority;
  run.authority = asked && authN(asked) < authN(rule.authority) ? asked : rule.authority;
  run.authorityNote = asked && authN(asked) > authN(rule.authority) ? `Orchestration asked for ${AUTHORITY[asked].label.toLowerCase()}; capped by rule.` : '';
  run.decisions.push({ type: 'authority', src: 'code', title: `Action authority: ${AUTHORITY[run.authority].label}`, detail: `${run.authorityNote} ${rule.why}`.trim() });
  for (const t of run.tasks) {
    const over = t.tools.filter(n => toolAct(n) > authN(run.authority));
    if (over.length) { t.tools = t.tools.filter(n => !over.includes(n)); run.decisions.push({ type: 'registry', src: 'code', title: `${taskLabel(t)}: ${over.join(', ')} removed`, detail: `${AUTHORITY[run.authority].label}: the request didn’t ask for ${over.some(n => toolAct(n) === 1) ? 'drafts' : 'changes'}.` }); }
    t.gaps = (t.services || []).filter(k => serviceStatus(k) === 'not connected');
  }
  const gaps = [...new Set(run.tasks.flatMap(t => t.gaps))];
  if (gaps.length) run.decisions.push({ type: 'registry', src: 'code', title: `Not connected here: ${gaps.map(g => '[' + g + ']').join(', ')}`, detail: 'Planned for, but unavailable in this demo; the steps that need it will report partial results.' });
  /* waves: a step runs one wave after the latest step it depends on */
  run.tasks.forEach(t => { t.wave = 0; });
  const waveOf = t => t.wave || (t.wave = 1 + Math.max(0, ...t.depends_on.map(d => run.tasks.find(x => x.id === d)).filter(Boolean).map(waveOf)));
  run.tasks.forEach(waveOf);
  /* sequential order: dependencies first, then plan order */
  const order = [], seen = new Set();
  const visit = t => { if (seen.has(t.id)) return; seen.add(t.id); t.depends_on.forEach(d => { const x = run.tasks.find(y => y.id === d); if (x) visit(x); }); order.push(t); };
  run.tasks.forEach(visit);
  order.forEach((t, k) => t.step = k + 1);
  run.tasks.sort((a, b) => a.step - b.step);
}
function handleOrch(run, o) {
  if (o.k === 'decision') {
    run.decisions.push(Object.assign({ src: 'ai' }, o));
    if (o.type === 'entity') { if (o.advisor && ADVISORS[o.advisor]) run.advisor = o.advisor; if (o.unit && run.advisor && ADVISORS[run.advisor].units[o.unit]) run.unit = o.unit; if (o.territory && TERRITORIES[o.territory]) run.territory = o.territory; else if (!run.advisor && run.resolution.territories[0]) run.territory = run.resolution.territories[0].id; UI.memAdv = run.advisor || UI.memAdv; flashTile('graph', 'read'); }
    if (o.type === 'known') flashTile('memory', 'read');
    if (o.type === 'interpretation') run.interp = normInterp(o);
    if (o.type === 'asks' && Array.isArray(o.asks)) run.asks = o.asks.map(String).filter(Boolean).slice(0, 5).map(text => ({ text, tasks: [] }));
  } else if (o.k === 'task') {
    if (run.tasks.length >= 6) return;
    const arr = x => Array.isArray(x) ? x : x ? [x] : [];
    let id = String(o.id || 'T' + (run.tasks.length + 1)); if (run.tasks.some(x => x.id === id)) id = 'T' + (run.tasks.length + 1);
    const ri = routeInfo(o.route);
    const t = { id, route: ri ? ri.route : null, sub: ri && !Array.isArray(SUBAGENTS[ri.family].subs[ri.sub]) ? ri.sub : null, services: [...new Set(arr(o.services).flatMap(x => serviceKeys(String(x))))], returns: String(o.returns || '').slice(0, 200), agent: ri ? ri.agent : resolveAgentId(o.agent) || String(o.agent || ''), objective: String(o.objective || o.task || '').slice(0, 300), depends_on: arr(o.depends_on || o.dependsOn).map(String), reads: arr(o.reads).map(String), tools: arr(o.tools).map(resolveToolName).filter(Boolean), why: String(o.why || '').slice(0, 200) };
    const rr = ROLES[o.role] ? o.role : null;
    if (!AGENTS[t.agent] && rr) t.agent = ROLE_DEFAULT_AGENT[rr];
    if (!t.objective) t.objective = AGENTS[t.agent] ? AGENTS[t.agent].does : 'Contribute to the request';
    t.role = rr && roleOf(t.agent) && ROLES[rr].team === AGENTS[t.agent]?.team ? rr : roleOf(t.agent);
    t.title = String(o.title || '').trim().slice(0, 60) || t.objective.split(/[,.;]/)[0].split(' ').slice(0, 6).join(' ');
    t.ask = Number(o.ask) || null;
    /* business assignment rules for Sales work that orchestration didn't route to a sub-agent */
    if (!t.route && AGENTS[t.agent] && AGENTS[t.agent].team === 'sales') {
      const txt = t.title + ' ' + t.objective, rule = ROLE_RULES.find(x => x.test.test(txt));
      if (rule && t.role !== rule.role) { const from = ROLES[t.role] ? ROLES[t.role].name : '—'; t.role = rule.role; t.agent = rule.agent(txt); run.decisions.push({ type: 'registry', src: 'code', title: `“${t.title}” → ${ROLES[rule.role].name}`, detail: `${rule.why}. Moved from ${from}.` }); }
    }
    t.person = ROLES[t.role] ? (t.role === 'sales.wholesalers' && run.advisor && EMPLOYEES[run.requester].team === 'sales' && ADVISORS[run.advisor].coverage.includes(run.requester) ? EMPLOYEES[run.requester].name : ROLES[t.role].person) : '';
    if (!AGENTS[t.agent]) { run.decisions.push({ type: 'registry', src: 'code', title: `Unknown agent “${t.agent}” dropped`, detail: 'Orchestration can only route to registered specialists.' }); return; }
    if (!t.route) t.route = routeOfTask(t.agent, t.sub);
    /* a shared service a step reads brings its tools, when the step's agent may use them */
    t.services.forEach(k => (SERVICES[k] ? SERVICES[k].tools : []).forEach(n => { if (toolAllowed(t.agent, n) && !t.tools.includes(n)) t.tools.push(n); }));
    const bad = t.tools.filter(x => !toolAllowed(t.agent, x));
    if (bad.length) { t.tools = t.tools.filter(x => toolAllowed(t.agent, x)); run.decisions.push({ type: 'registry', src: 'code', title: `${AGENTS[t.agent].name}: ${bad.length} tool${bad.length > 1 ? 's' : ''} removed`, detail: `${bad.join(', ')} ${bad.length > 1 ? 'are' : 'is'} not on this agent’s allow-list at the gateway.` }); UI.totals.blocked++; }
    t.depends_on = t.depends_on.filter(d => run.tasks.some(x => x.id === d));
    t.state = 'queued'; run.tasks.push(t);
  } else if (o.k === 'clarify') {
    if (run.clarified) run.decisions.push({ type: 'missing', src: 'code', title: 'Proceeding on your earlier answer', detail: `Orchestration wanted to ask “${o.question}” again; the app lets it ask only once, so it continues with stated assumptions.` });
    else run.clarify = String(o.question || 'Which advisor do you mean?');
  }
}
const taskLabel = t => t.route || (AGENTS[t.agent] ? AGENTS[t.agent].name : t.agent);
function normInterp(o) {
  const arr = x => Array.isArray(x) ? x.map(v => String(v)).filter(Boolean).slice(0, 5) : x ? [String(x)] : [];
  const sub = o.subject && typeof o.subject === 'object' ? { kind: String(o.subject.kind || 'none'), id: o.subject.id ? String(o.subject.id) : null, label: String(o.subject.label || o.subject.id || '') } : { kind: 'none', id: null, label: String(o.subject || '') };
  return { title: String(o.title || ''), subject: sub, intent: INTENTS[o.intent] ? o.intent : null, scope: String(o.scope || ''), time: String(o.time || ''), constraints: arr(o.constraints), output: String(o.output || ''), missing: arr(o.missing), authority: AUTHORITY[o.authority] ? o.authority : null, patterns: (Array.isArray(o.patterns) ? o.patterns : []).map(Number).filter(n => CATALOGUE.some(c => c.n === n)).slice(0, 3), src: o.src === 'code' ? 'code' : 'ai' };
}
/* A catalogue route, turned into the same orchestration stream the AI produces (no AI call) */
function catalogueReplay(entry, requester) {
  const p = parseRoute(entry.exec), E = EMPLOYEES[requester], L2 = o => JSON.stringify(o.k === 'decision' ? Object.assign({ src: 'code' }, o) : o), lines = [], tasks = []; /* built by rule from the route, so tagged RULE */
  const gaps = [...new Set(p.stages.flat().filter(i => i.kind === 'service').flatMap(i => i.keys).filter(k => serviceStatus(k) === 'not connected'))];
  lines.push(L2({ k: 'decision', type: 'requester', title: `${E.name}, ${TEAMS[E.team].name}`, detail: E.role }));
  lines.push(L2({ k: 'decision', type: 'intent', title: `${entry.intent[0].toUpperCase() + entry.intent.slice(1)}: ${INTENTS[entry.intent]}`, detail: `Catalogue #${entry.n}, group ${entry.group}: ${CATALOGUE_GROUPS[entry.group].title}.`, intent: entry.intent }));
  lines.push(L2({ k: 'decision', type: 'asks', title: '1 thing requested', detail: entry.ask, asks: [entry.ask.replace(/[.?]$/, '')] }));
  lines.push(L2({ k: 'decision', type: 'interpretation', title: entry.decomp, detail: `Catalogue #${entry.n}`, subject: null, intent: entry.intent, output: p.output, constraints: [], missing: gaps.map(g => `[${g}] is not connected in this demo`), authority: entry.auth, patterns: [entry.n] }));
  let prev = [], pending = [];
  p.stages.forEach((st, k) => {
    const agents = st.filter(i => i.kind === 'agent'), svc = [...pending, ...st.filter(i => i.kind === 'service').flatMap(i => i.keys)], checks = st.filter(i => i.kind === 'check');
    checks.forEach(c => lines.push(L2({ k: 'decision', type: 'controls', title: `Checkpoint: ${c.raw}`, detail: 'A person reviews before the next step.' })));
    if (!agents.length) { if (prev.length) prev.forEach(t => t.services.push(...svc)); else pending = svc; return; } /* a service on its own serves the step before it */
    pending = [];
    const ids = agents.map((a, j) => { const t = { k: 'task', id: 'T' + (tasks.length + 1), ask: 1, route: a.route, title: a.sub, objective: `${a.does}, for: ${entry.ask}`, depends_on: prev.map(x => x.id), services: j === 0 ? [...svc] : [], /* a read listed with parallel steps goes to the first of them */ tools: [], reads: ['memory', 'knowledge', 'policy'], returns: k === p.stages.length - 1 ? p.output : 'its output, sources and as-of dates to the next wave', why: `Catalogue #${entry.n} route` }; tasks.push(t); return t; });
    prev = ids;
  });
  if (pending.length && prev.length) prev.forEach(t => t.services.push(...pending));
  tasks.forEach(t => lines.push(L2(t)));
  lines.push(L2({ k: 'decision', type: 'success', title: p.output.charAt(0).toUpperCase() + p.output.slice(1), detail: `The output catalogue #${entry.n} calls for.` }));
  lines.push(L2({ k: 'end' }));
  return { name: `Catalogue #${entry.n}`, requester, text: entry.ask, orch: lines.join('\n'), agents: {}, orchOnly: true };
}
/* How long each step's finished output stays on screen before the next step starts */
const READ_PAUSE_S = 5;
async function runTask(run, t) {
  const a = AGENTS[t.agent], sig = UI.ctl.signal;
  t.state = 'running'; t.t0 = Date.now(); UI.openTask = t.id; renderAll();
  addOp({ kind: 'dispatch', agent: t.agent, task: t.id, dur: 800 }); await sleep(800);
  /* foundation assembles the context packet */
  t.packet = buildPacket(t, run);
  const layers = [...new Set(t.packet.items.map(i => i.layer))];
  layers.forEach((l, k) => { addOp({ kind: 'read', agent: t.agent, task: t.id, layer: l, lane: k - (layers.length - 1) / 2, dur: 1400 }); flashTile(l, 'read'); });
  const reusedItems = t.packet.items.filter(i => { const rec = F.memory.find(m => m.id === i.id) || F.findings.find(k => k.id === i.id); return rec && (rec.origin || rec.by) && (rec.origin || rec.by) !== t.agent; });
  run.stats.reads += t.packet.items.length;
  renderAll(); await sleep(1200);
  /* upstream work */
  const upstream = t.depends_on.map(d => run.tasks.find(x => x.id === d)).filter(x => x && x.result).map(x => ({ task: x.id, agent: x.agent, title: x.result.output?.title || '', body: x.result.output?.body || '', ids: (x.verdicts || []).filter(v => v.id).map(v => v.id) }));
  t.upstreamReuse = upstream.length;
  upstream.forEach((up, k) => { const pub = run.tasks.find(x => x.id === up.task); const l = pub && pub.verdicts && pub.verdicts.some(v => v.kind === 'memory' && v.status === 'committed') ? 'memory' : 'knowledge'; addOp({ kind: 'handoff', from: up.agent, fromTask: up.task, agent: t.agent, task: t.id, layer: l, lane: k, dur: 2000 }); });
  if (upstream.length) await sleep(900);
  t.calls = []; t.toolResults = [];
  const onCall = async (name, input) => {
    if (sig.aborted) throw new Error('stopped');
    const T = TOOLS[name];
    if (!T || !toolAllowed(t.agent, name)) { t.calls.push({ name, input, error: 'Not permitted for this agent' }); UI.totals.blocked++; renderAll(); throw new Error(`${name} is not permitted for ${a.name}`); }
    if (toolAct(name) > authN(run.authority)) { t.calls.push({ name, input, error: `Not permitted at ${AUTHORITY[run.authority].label.toLowerCase()} authority` }); UI.totals.blocked++; renderAll(); throw new Error(`${name} is not permitted: the request is ${AUTHORITY[run.authority].label.toLowerCase()}`); }
    addOp({ kind: 'call', agent: t.agent, task: t.id, sys: T.sys, via: T.via, dur: 1500 });
    let out; try { out = capResult(T.run(input && typeof input === 'object' ? input : {})); } catch (e) { t.calls.push({ name, input, error: e.message }); renderAll(); throw e; }
    t.calls.push({ name, input, sys: T.sys, via: T.via, rw: T.rw, out }); t.toolResults.push({ name, out });
    run.stats.calls++; UI.totals.calls++; if (T.via === 'MCP') { run.stats.mcp++; UI.totals.mcp++; }
    run.record.agents[t.id] = run.record.agents[t.id] || { calls: [] }; run.record.agents[t.id].calls.push([name, input]);
    renderAll(); await sleep(900);
    return out;
  };
  let res;
  if (run.replay && !run.replay.orchOnly) {
    const rec = run.replay.agents[t.id] || { calls: [], json: { says: 'No recording for this task.', output: null } };
    await sleep(700);
    for (const [n, inp] of rec.calls) await onCall(n, inp);
    await sleep(900); res = clone(rec.json);
  } else {
    if (AI.mode !== 'live') throw new Error('live AI is needed to run this step');
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
  if (res.next_step && traceable(res.next_step, corpusOf(ctx)).length) res.next_step = '';
  /* the step contract: output, sources, as-of dates, unresolved issues, status */
  const asof = new Set(res.as_of || []);
  t.toolResults.forEach(r => JSON.stringify(r.out).replace(/"(as_of|numerator_as_of|denominator_as_of|er_as_of|asOf)":"([^"]+)"/g, (m, k, v) => { asof.add(v); return m; }));
  const outBlocked = t.verdicts.some(v => v.kind === 'output' && v.status === 'blocked');
  t.contract = { status: outBlocked ? 'blocked' : res.status === 'complete' && ((t.gaps || []).length || t.calls.some(c => c.error)) ? 'partial' : res.status, sources: [...new Set([...(res.used || []), ...t.calls.filter(c => !c.error).map(c => c.name)])], as_of: [...asof].slice(0, 4), unresolved: res.open_questions || [] };
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
  [...wl].forEach((l, k) => { addOp({ kind: 'write', agent: t.agent, task: t.id, layer: l, lane: k - (wl.size - 1) / 2, dur: 1400 }); flashTile(l, 'write'); });
  if (t.verdicts.some(v => v.status === 'blocked' || v.status === 'rejected')) flashTile('policy', 'write');
  /* event fan-out: subscribers get notified */
  const subs = new Set(t.verdicts.flatMap(v => v.event ? v.event.subscribers : []));
  new Set([...subs].map(roleOf).filter(Boolean)).forEach(rid => { const el = $('role-' + rid.replace('.', '-')); if (el) { el.classList.remove('notified'); void el.offsetWidth; el.classList.add('notified'); } });
  t.state = 'done'; t.t1 = Date.now();
  if (t.verdicts.some(v => v.kind === 'memory')) badge('memory', true);
  if (t.verdicts.some(v => v.kind === 'output')) badge('updates', true);
  setTab('updates');
  renderAll();
}
function defaultArgs(n, run, t) {
  const tick = mentionsFunds(run.text + ' ' + t.objective), people = (run.resolution.people || []).map(p => p.name);
  const when = /next month/i.test(run.text) ? 'next month' : /next week/i.test(run.text) ? 'next week' : /tomorrow/i.test(run.text) ? 'tomorrow' : 'soon';
  const plan = Object.keys(PLANS).find(k => PLANS[k].adv === run.advisor) || '';
  return { plan_id: plan, topic: /fee|cost|expense/i.test(run.text) ? 'fees' : /link|access|open/i.test(run.text) ? 'access' : t.objective, case_id: (F.cases.find(c => c.adv === run.advisor && c.status === 'Open') || {}).id || '', note: '', status: '', advisor_id: run.advisor || '', ticker: tick[0] || 'GFFFX', tickers: tick.length ? tick : ['GFFFX'], name: tick[0] || '', amount_usd: 1000000, query: t.objective, weights: tick.length > 1 ? { [tick[0]]: 50, [tick[1]]: 50 } : { VIGAX: 70, GFFFX: 30 }, category: tick[0] || 'Large Growth', territory: run.territory || 'LA', content_type: /linkedin|post/i.test(run.text) ? 'linkedin post' : /committee/i.test(run.text) ? 'committee pack' : 'advisor email', to: run.advisor ? ADVISORS[run.advisor].name : people[0] || '', subject: t.objective.slice(0, 60), attendees: [run.advisor, ...people].filter(Boolean), when, title: t.objective.slice(0, 60), time: '' };
}
function errText(e) {
  const map = { not_granted: 'Claude access wasn’t allowed in this view', rate_limited: 'too many requests right now; wait a moment and try again', invalid_json: 'the reply wasn’t valid JSON', empty_completion: 'Claude returned nothing', tools_unavailable: 'tool use isn’t available here', prompt_too_large: 'the request was too large', upstream_error: 'a temporary connection problem', refused: 'Claude declined this request', session_expired: 'your session expired; sign in again', auth_failed: 'the server’s AI key was rejected; check OPENAI_API_KEY', cancelled: 'stopped' };
  return e && e.code ? `${map[e.code] || e.code}${e.message && !map[e.code] ? ' (' + e.message + ')' : ''}` : String(e && e.message || e);
}
function finishRun(run, error) {
  run.status = error ? 'failed' : 'done'; run.error = error; run.t1 = Date.now();
  $('runBtn').disabled = false; $('planBtn').disabled = false; $('stopBtn').hidden = true;

  if (!error) logEvent('plan.completed', `${run.tasks.length} tasks · ${run.stats.reused} reused · ${run.stats.committed} stored`, 'orch', run.advisor);
  renderAll();
}

/* ---------- panes ---------- */
function updateStream() {}
const SI = { done: '✓', active: '', pending: '', skipped: '–', failed: '!' };
function stepBody(r, s) {
  if (s.id === 'plan') {
    const succ = s.items.filter(d => d.type === 'success'), fixes = s.items.filter(d => d.type === 'planfix');
    return `${fixes.map(d => `<div class="dl"><span class="tag2 code">RULE</span><span><b>${esc(d.title)}</b> ${esc(d.detail || '')}</span></div>`).join('')}${r.tasks.map(t => `<div class="dl"><span class="tid" style="background:${TC[ROLES[t.role].team]}">${t.id}</span><span><b>W${t.wave} · ${esc(taskLabel(t))}: ${esc(t.title)}</b> → ${esc(TEAMS[ROLES[t.role].team].name)} · ${esc(ROLES[t.role].name)}<small>${esc(t.objective)}${t.depends_on.length ? ' · after ' + t.depends_on.join(', ') : ' · no dependencies, runs in wave 1'}${(t.services || []).length ? ' · reads ' + t.services.map(k => '[' + k + ']').join(' ') : ''}</small></span></div>`).join('')}${succ.map(d => `<div class="dl"><span class="tag2 ai">DONE WHEN</span><span>${esc(d.title)}</span></div>`).join('')}`;
  }
  if (s.id === 'execute') {
    return r.tasks.map(t => { const up = t.depends_on.map(d => r.tasks.find(x => x.id === d)).filter(Boolean);
      const icon2 = t.state === 'done' ? '✓' : t.state === 'running' ? '<span class="spin"></span>' : t.state === 'failed' ? '!' : '·';
      return `<div class="dl"><span class="tid ${t.state || ''}" style="background:${TC[ROLES[t.role].team]}">${icon2}</span><span><b>${esc(ROLES[t.role].name)}: ${esc(t.title)}</b>${t.state === 'done' && t.result ? ` · ${esc(t.result.says)}` : t.state === 'failed' ? ` · failed: ${esc(t.error)}` : t.state === 'running' ? ' · working' : ' · waiting'}${up.length ? `<small>Builds on ${up.map(x => esc(ROLES[x.role].name + '’s “' + x.title + '”')).join(', ')} through the foundation</small>` : ''}${t.verdicts ? `<small>${t.verdicts.map(v => `${v.kind} ${v.status}`).join(' · ')}</small>` : ''}</span></div>`; }).join('');
  }
  return s.items.map(d => `<div class="dl"><span class="tag2 ${d.src === 'code' ? 'code' : 'ai'}">${d.src === 'code' ? 'RULE' : 'AI'}</span><span><b>${esc(d.title)}</b>${d.detail ? ' ' + esc(d.detail) : ''}${d.uses && d.uses.length ? `<small>${esc(d.uses.join(' · '))}</small>` : ''}</span></div>`).join('');
}
function renderDecisions() {
  const r = UI.run, pane = $('pane-decisions');
  if (!r) { patchList(pane, [{ key: 'empty', cls: 'empty', html: `<p style="font:400 19px/1.4 var(--serif);color:var(--ink);margin:0 0 8px">Pick who you are, type an outcome, press Enter.</p>Orchestration works through nine steps: understand the request, resolve who and what it is about, set the scope, reuse what is known, find the gaps, apply the memory rule, set controls, plan, and execute with the right specialists. Each step fills in here as it is decided.` }]); return; }
  const items = [];
  if (r.status === 'done') items.push({ key: 'sum', cls: 'summary', html: `<h3>${r.tasks.length} specialists · ${Math.round((r.t1 - r.t0) / 1000)} s</h3><div class="sgrid"><div><b>${r.stats.reused}</b>facts reused</div><div><b>${r.stats.reads}</b>records delivered</div><div><b>${r.stats.calls}</b>system calls</div><div><b>${r.stats.committed}</b>stored</div><div><b>${r.stats.pending + r.stats.task}</b>kept scoped / pending</div><div><b>${r.stats.blocked}</b>blocked or rejected</div></div>` });
  if (r.status === 'failed') items.push({ key: 'fail', cls: 'blocked', html: `<b>${esc(r.error)}</b>${r.tasks.length ? '' : '<br>No specialist ran.'}<div style="margin-top:8px"><button class="lbtn" data-act="retry">Try again</button></div>${r.orchText ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px">What orchestration returned</summary><div class="stream">${esc(r.orchText.slice(-3000))}</div></details>` : ''}` });
  if (r.status === 'clarify') items.push({ key: 'clar-note', cls: 'clar', html: `<b>Waiting for your answer</b><p style="margin:4px 0 0">${esc(r.clarify)}</p><button class="lbtn primary" data-tab="updates" style="margin-top:6px">Answer in Updates</button>` });
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
    ${t.result ? `<div class="sec"><b>${icon('bolt')} ${esc(a.name)} → foundation</b><p class="says">“${esc(t.result.says || '')}”</p>${t.result.output ? `<div class="outbody"><b>${esc(t.result.output.title)}</b>\n${md(t.result.output.body)}</div>` : ''}${t.result.next_step ? `<p class="hint" style="margin:6px 0 0">Next step for the requester: ${esc(t.result.next_step)}</p>` : ''}${(t.result.open_questions || []).length ? `<p class="hint" style="margin:6px 0 0">Open question: ${esc(t.result.open_questions.join(' '))}</p>` : ''}</div>` : ''}
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
function verdictLines(t) {
  return (t.verdicts || []).filter(v => v.kind !== 'output' || v.status === 'blocked').map(v => {
    const txt = v.kind === 'knowledge' ? (v.status === 'published' ? `Shared with all teams: ${v.title}` : `Not shared: ${v.title} (${v.reason})`)
      : v.kind === 'memory' ? ({ committed: `Remembered: ${v.title}`, pending: `Needs the advisor’s confirmation: ${v.title}`, task: `Kept with this task only: ${v.title}`, rejected: `Not remembered: ${v.title} (a guess, not stated)`, read: `Already known: ${v.title}`, blocked: `Not allowed: ${v.title}` }[v.status] || v.title)
      : v.kind === 'commitment' ? (v.status === 'proposed' ? `Proposed follow-up, not created: ${v.title}` : `New follow-up task: ${v.title}`) : `Blocked: ${v.reason}`;
    return `<div class="uv ${v.status}">${esc(txt)}${v.status === 'proposed' ? ` <button class="lbtn mini" data-commit="${t.id}|${t.verdicts.indexOf(v)}">Create task</button>` : ''}</div>`;
  }).join('');
}
function outputHTML(o) {
  if (!o) return '';
  const body = md(o.body), rev = (o.rev > 1 ? `<p class="hint" style="margin:4px 0 0">Edited by ${esc(o.editedBy)} · rev ${o.rev} · re-checked by the gatekeeper</p>` : '') + (o.flagged && o.flagged.length ? `<div class="uv pending">Check before use: ${esc(o.flagged.join(', '))} not traced to a system of record</div>` : '');
  return (o.kind === 'email' ? `<div class="olk" style="margin-top:6px"><div class="bar"><span>Outlook draft</span><span>${esc(o.status)}</span></div><div class="bd"><b>${esc(o.title)}</b>\n\n${body}</div></div>` : `<div class="outbody" style="margin-top:6px"><b>${esc(o.title)}</b>\n${body}</div>`) + rev;
}
/* ---------- traceability: which systems each step queried, what came back, and why ---------- */
const toolPurpose = n => { const d = TOOLS[n].desc; return d.slice(d.indexOf(':') + 1).trim().split(/\.\s/)[0].replace(/\.$/, ''); };
function resultGist(out) {
  if (out == null) return 'nothing returned';
  const ids = [...new Set(JSON.stringify(out).match(/\b[A-Z]{2,}-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g) || [])].slice(0, 4);
  if (Array.isArray(out)) return `${out.length} ${out.length === 1 ? 'record' : 'records'}${ids.length ? ': ' + ids.join(', ') : ''}`;
  if (typeof out !== 'object') return String(out).slice(0, 90);
  const bits = Object.entries(out).filter(([, v]) => v != null && v !== '').slice(0, 3).map(([k, v]) => `${k.replace(/_/g, ' ')} ${Array.isArray(v) ? v.length + ' items' : typeof v === 'object' ? Object.keys(v).length + ' fields' : String(v).slice(0, 40)}`);
  return bits.join(' · ');
}
function sourcesHTML(r, t) {
  const p = t.packet; if (!p) return '';
  const used = new Set((t.result && t.result.used) || []), counts = LAYER_ORDER.map(l => [l, p.items.filter(i => i.layer === l).length]).filter(x => x[1]);
  const cited = p.items.filter(i => used.has(i.id)).slice(0, 5);
  const ups = t.depends_on.map(d => r.tasks.find(x => x.id === d)).filter(x => x && x.result);
  const calls = (t.calls || []).map(c => `<div class="srcl"><span class="vbadge ${c.via || 'API'}">${c.via || '—'}</span><span><b>${esc(c.sys ? SYSTEMS[c.sys].name : TOOLS[c.name] ? SYSTEMS[TOOLS[c.name].sys].name : c.name)}</b> · <code>${esc(c.name)}</code>${c.error ? `<small class="bad">Blocked: ${esc(c.error)}</small>` : `<small>Why: ${esc(toolPurpose(c.name))}</small><small>Returned: ${esc(resultGist(c.out))}</small>`}</span></div>`).join('');
  return `<div class="srcs"><div class="srch">${icon('network')} Where this came from</div>
    <div class="srcl"><span class="vbadge Internal">FDN</span><span><b>Shared foundation</b> · sent ${p.items.length} records (${counts.map(([l, n]) => `${esc(LAYERS[l].short)} ${n}`).join(' · ')})${p.withheld.length ? ` · withheld ${p.withheld.length}` : ''}<small>Why: only what this role is permitted to see for ${esc(r.advisor ? ADVISORS[r.advisor].short : r.territory ? TERRITORIES[r.territory].name : 'this request')}</small>${cited.length ? `<small>Cited: ${cited.map(i => `${esc(i.id)} ${esc(i.label)}`).join(' · ')}</small>` : ''}</span></div>
    ${ups.map(x => `<div class="srcl"><span class="vbadge Event">STEP ${x.step}</span><span><b>${esc(ROLES[x.role].name)}</b> · ${esc((x.result.output && x.result.output.title) || x.title)}<small>Why: this step builds on that verified work instead of redoing it</small></span></div>`).join('')}
    ${(t.gaps || []).map(k => `<div class="srcl"><span class="vbadge Gap">GAP</span><span><b>[${esc(k)}]</b> · not connected in this demo<small>Needed for: ${esc(SERVICES[k] ? SERVICES[k].does : k)}. The step reports what it could not establish.</small></span></div>`).join('')}
    ${calls || (t.state === 'running' ? '' : '<div class="srcl"><span class="vbadge Internal">—</span><span><small>No enterprise system calls: worked from the foundation alone</small></span></div>')}</div>`;
}
/* ---------- intelligence and orchestration views ---------- */
const routeChip = t => t.route ? `<span class="rc ag" style="--c:${TC[AGENTS[t.agent].team]}">${esc(t.route)}</span>` : '';
const svcChip = k => `<span class="rc sv ${serviceStatus(k).replace(' ', '-')}" title="${esc((SERVICES[k] ? SERVICES[k].does : k) + ' · ' + serviceStatus(k))}">[${esc(k)}]</span>`;
function interpHTML(r) {
  const I = r.interp, first = EMPLOYEES[r.requester].name.split(' ')[0], list = (a, none) => a && a.length ? a.map(esc).join('<br>') : `<span class="mute">${none}</span>`;
  const subj = I.subject && (I.subject.label || I.subject.id) ? `${esc(I.subject.label || I.subject.id)}${I.subject.kind && I.subject.kind !== 'none' ? ` <small>${esc(I.subject.kind.replace('_', ' '))}${I.subject.id && I.subject.label ? ' · ' + esc(I.subject.id) : ''}</small>` : ''}` : r.advisor ? `${esc(ADVISORS[r.advisor].name)} <small>advisor · from the graph</small>` : '<span class="mute">Not resolved</span>';
  const au = r.authority || I.authority, val = {
    subject: subj, intent: I.intent ? `<b class="ib">${esc(I.intent)}</b> <small>${esc(INTENTS[I.intent])}</small>` : '<span class="mute">Not stated</span>',
    scope: I.scope ? esc(I.scope) : '<span class="mute">Not stated</span>', time: I.time ? esc(I.time) : '<span class="mute">Current</span>',
    constraints: list(I.constraints, 'None stated'), output: I.output ? esc(I.output) : '<span class="mute">Not stated</span>', missing: list(I.missing, 'Nothing material'),
    authority: au ? `<b>${esc(AUTHORITY[au].label)}</b> <small>${esc(AUTHORITY[au].does)}${r.authority ? ' · settled by rule' : ' · pending rule check'}</small>${r.authorityNote ? `<small class="warn">${esc(r.authorityNote)}</small>` : ''}` : '<span class="mute">Pending</span>' };
  return `<div class="dt">INTELLIGENCE · WHAT ${esc(first.toUpperCase())} ACTUALLY WANTS <span class="tag2 ${I.src === 'code' ? 'code' : 'ai'}">${I.src === 'code' ? 'RULE' : 'AI'}</span></div>${I.title ? `<p class="ihead">${esc(I.title)}</p>` : ''}<dl class="interp">${INTERP_FIELDS.map(([k, l]) => `<dt>${l}</dt><dd>${val[k]}</dd>`).join('')}</dl>${I.patterns && I.patterns.length ? `<p class="hint" style="margin:6px 0 0">Closest catalogue pattern${I.patterns.length > 1 ? 's' : ''}: ${I.patterns.map(n => `<button class="linkbtn" data-cat-open="${n}">#${n}</button>`).join(', ')}</p>` : ''}`;
}
function planHTML(r) {
  const waves = [...new Set(r.tasks.map(t => t.wave))].sort((a, b) => a - b), uncovered = (r.asks || []).filter(a => !a.tasks.length), succ = r.decisions.find(d => d.type === 'success');
  return `<div class="dt">ORCHESTRATION · ${r.tasks.length} ${r.tasks.length === 1 ? 'STEP' : 'STEPS'} IN ${waves.length} ${waves.length === 1 ? 'WAVE' : 'WAVES'}</div>${waves.map(w => { const ts = r.tasks.filter(t => t.wave === w);
    return `<div class="wave"><div class="waveh"><span class="wn">Wave ${w}</span><small>${ts.length > 1 ? `${ts.length} steps run together` : w > 1 ? 'waits for the wave before' : 'starts immediately'}</small></div>${ts.map(t => { const [cls, label] = taskStatus(t), R = ROLES[t.role], tools = [...new Set((t.calls || []).map(c => c.name))];
      return `<button class="steprow" data-task="${t.id}"><span class="stepn" style="background:${TC[R.team]}">${t.step}</span><span class="stepb"><b>${routeChip(t)} ${esc(t.title)}</b><small>${esc(R.name)}${t.person ? ' · ' + esc(t.person) : ''}${t.depends_on.length ? ' · uses step ' + t.depends_on.map(d => (r.tasks.find(x => x.id === d) || {}).step).filter(Boolean).join(', ') : ''}${(r.asks || []).length > 1 ? ' · ask ' + t.ask : ''}</small>${(t.services || []).length ? `<small class="svcl">${t.services.map(svcChip).join(' ')}</small>` : ''}<small class="agentline">${tools.length ? 'called: ' + esc(tools.join(', ')) : t.tools.length ? 'may call: ' + esc(t.tools.join(', ')) : 'works from the foundation and upstream steps'}</small></span><em class="bst ${cls}">${label}</em></button>`; }).join('')}</div>`; }).join('')}
    <div class="wave ret"><span class="wn">Returns</span> ${esc((r.interp && r.interp.output) || (succ && succ.title) || 'The requested output')}</div>
    ${uncovered.map(a => `<div class="uv blocked">Not covered: “${esc(a.text)}”</div>`).join('')}
    ${r.status === 'planned' ? `<div style="display:flex;gap:6px;margin-top:8px"><button class="lbtn primary" data-act="run-plan">Run this plan</button><span class="hint" style="align-self:center">Nothing has run yet.</span></div>` : '<p class="hint" style="margin:6px 0 0">Click any step to see exactly what it produced.</p>'}`;
}
function contractHTML(t) {
  const c = t.contract; if (!c) return '';
  return `<div class="contract"><span class="cs ${c.status}">${esc(c.status)}</span><span><b>${c.sources.length}</b> sources</span><span>As of: ${c.as_of.length ? esc(c.as_of.join(', ')) : '<span class="mute">not stated</span>'}</span><span><b>${c.unresolved.length}</b> unresolved</span></div>${c.unresolved.length ? `<div class="unres">${c.unresolved.map(u => `<div>• ${esc(u)}</div>`).join('')}</div>` : ''}`;
}
/* ---------- the query catalogue: what users ask, how it is decomposed, which sub-agents run ---------- */
function routeHTML(route) {
  const p = parseRoute(route), chip = i => i.kind === 'agent' ? `<span class="rc ag" style="--c:${TC[AGENTS[i.agent].team]}" title="${esc(i.label + ': ' + i.does)}">${esc(i.route)}</span>` : i.kind === 'service' ? i.keys.map(svcChip).join('') : `<span class="rc ck">${esc(i.raw)}</span>`;
  return `<div class="rt">${p.stages.map(st => `<span class="rts${st.length > 1 ? ' par' : ''}">${st.map(chip).join('')}</span>`).join('<span class="rta">→</span>')}<span class="rta">→</span><span class="rto">${esc(p.output)}</span></div>`;
}
function renderCatalogue() {
  const pane = $('pane-catalogue'); if (pane._built) return; pane._built = true;
  const intentBadge = k => `<span class="ib" title="${esc(INTENTS[k])}">${esc(k)}</span>`;
  pane.innerHTML = `<div class="dcard catintro"><div class="dt">SALES AI QUERY CATALOGUE</div><p class="lead2">What users ask, how the intelligence layer decomposes it, and which sub-agents run. These are requirements and example prompts, not claims that every integration exists.</p>
    <div class="legend2"><span class="rc ag" style="--c:${TC.sales}">Prep.Notes</span> sub-agent route <span class="rc sv simulated">[assets]</span> simulated here <span class="rc sv foundation">[memory]</span> built into the foundation <span class="rc sv not-connected">[peer analytics]</span> not connected <span class="rts par" style="display:inline-flex"><span class="rc ag" style="--c:${TC.sales}">A</span><span class="rc ag" style="--c:${TC.sales}">B</span></span> run together</div>
    <p class="hint" style="margin:6px 0 0"><b>Decompose</b> turns a route into a plan without an AI call. <b>Ask</b> puts the request in the command bar; <b>Plan only</b> shows the live AI’s own decomposition.</p></div>
    <div class="dcard"><div class="dt">SAME WORD, DIFFERENT INTENT</div><p class="hint" style="margin:0 0 6px">Organize by business intent, not keywords. Each of these mentions ETFs and needs a different plan, data and controls.</p>${ETF_CONTRAST.map(e => `<div class="catq"><div class="catqh"><b>${esc(e.ask)}</b>${intentBadge(e.intent)}</div>${routeHTML(e.route)}<small class="mute">${esc(e.control)}</small></div>`).join('')}</div>
    <details class="dcard catsec"><summary><b>What the intelligence layer establishes</b><small>Eight fields, then eleven intents</small></summary><dl class="interp">${INTERP_FIELDS.map(([, l, d]) => `<dt>${l}</dt><dd>${esc(d)}</dd>`).join('')}</dl><div class="intents">${INTENT_ORDER.map(k => `<div>${intentBadge(k)} ${esc(INTENTS[k])}</div>`).join('')}</div><p class="hint">“Help me prepare” should not silently mean “book a meeting and send an email.” Action authority is settled by rule from the request’s own words, and write tools above it are removed at the gateway.</p></details>
    <details class="dcard catsec"><summary><b>Sub-agents and shared services</b><small>Route notation: Prep.Notes = Prep Me → Notes Summarizer</small></summary>${Object.entries(SUBAGENTS).map(([fam, A]) => `<div class="fam"><b>${esc(fam)}</b> <small>${esc(A.name)}</small><div>${Object.keys(A.subs).map(sub => { const ri = routeInfo(fam + '.' + sub); return `<span class="rc ag" style="--c:${TC[AGENTS[ri.agent].team]}" title="${esc(ri.does)}">${esc(sub)}</span>`; }).join('')}</div></div>`).join('')}<div class="fam"><b>Shared services</b> <small>[brackets]: tools, not autonomous agents</small><div>${Object.keys(SERVICES).map(svcChip).join('')}</div></div></details>
    ${Object.entries(CATALOGUE_GROUPS).map(([g, G], gi) => `<details class="dcard catsec" ${gi === 0 ? 'open' : ''}><summary><b>${g}. ${esc(G.title)}</b><small>${CATALOGUE.filter(c => c.group === g).length} queries</small></summary>${G.note ? `<p class="catnote">${esc(G.note)}</p>` : ''}${CATALOGUE.filter(c => c.group === g).map(c => `<div class="catq" id="cat-${c.n}"><div class="catqh"><span class="catn">${c.n}</span><b>“${esc(c.ask)}”</b>${intentBadge(c.intent)}</div><small class="mute">${esc(c.decomp)}</small>${routeHTML(c.route)}<div class="catbtns"><button class="lbtn mini" data-cat-plan="${c.n}">Decompose</button><button class="lbtn mini" data-cat-use="${c.n}">Ask</button>${c.auth ? `<small class="mute">${esc(AUTHORITY[c.auth].label)}</small>` : ''}</div></div>`).join('')}</details>`).join('')}`;
}
function openCatalogueEntry(n) { setTab('catalogue'); const el = $('cat-' + n); if (!el) return; const d = el.closest('details'); if (d) d.open = true; el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
function salesRequester() { return EMPLOYEES[UI.requester].team === 'sales' ? UI.requester : 'EMP-PRIYA'; }
/* ---------- closing card: what the requester should do next ---------- */
function nextActions(r) {
  const out = [], seen = new Set(), add = (tag, text, step) => { const k = text.toLowerCase(); if (text && !seen.has(k)) { seen.add(k); out.push({ tag, text, step }); } };
  r.tasks.forEach(t => t.result && t.result.next_step && add('Next', t.result.next_step, t.step));
  for (const t of r.tasks) {
    const o = outOf(t);
    if (o && o.status === 'Waiting for approval') add('Approve', `Review “${o.title}”, edit if needed, and approve it. Nothing is sent until you do.`, t.step);
    for (const v of t.verdicts || []) {
      if (v.kind === 'commitment' && v.status === 'committed') { const c = F.commitments.find(x => x.id === v.id); add('Follow up', `${v.title}${c ? ` (${c.owner}, due ${c.due})` : ''}`, t.step); }
      if (v.kind === 'commitment' && v.status === 'proposed') add('Proposed', `${v.title} (${v.proposal.owner}, due ${v.proposal.due}). Not created: use Create task on step ${t.step} if you want it.`, t.step);
      if (v.kind === 'memory' && v.status === 'pending') add('Confirm', `Confirm with ${r.advisor ? ADVISORS[r.advisor].short : 'the advisor'} before it becomes a lasting preference: ${v.title}`, t.step);
    }
    (t.result && t.result.open_questions || []).forEach(q => add('Resolve', q, t.step));
  }
  return out.slice(0, 5);
}
function nextHTML(r) {
  const who = EMPLOYEES[r.requester].name.split(' ')[0], acts = nextActions(r), goal = r.decisions.find(d => d.type === 'success');
  return `<div class="dt">WHAT ${esc(who.toUpperCase())} SHOULD DO NEXT</div>${goal ? `<p class="nxgoal">${esc(goal.title)}${goal.detail ? `<small>${esc(goal.detail)}</small>` : ''}</p>` : ''}${acts.length ? acts.map(a => `<div class="nx"><span class="nxt ${a.tag.replace(' ', '').toLowerCase()}">${esc(a.tag)}</span><span>${esc(a.text)}<small>From step ${a.step}</small></span></div>`).join('') : '<p class="hint">Nothing further for you to do: everything was produced and stored.</p>'}`;
}
/* ---------- keep a good live run as a replay (and download it for src/replay.js) ---------- */
function saveRun(r) {
  if (!r || r.status !== 'done' || r.replay) return;
  const rec = { name: r.text.slice(0, 60), requester: r.requester, text: r.text, orch: r.record.orch, agents: r.record.agents };
  UI.recordings = UI.recordings.filter(x => !(x.text === rec.text && x.requester === rec.requester)).concat([rec]);
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['RECORDED.push(' + JSON.stringify(rec, null, 1) + ');\n'], { type: 'text/javascript' })); a.download = 'replay-' + r.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.js'; a.click(); URL.revokeObjectURL(a.href); } catch (e) { }
  renderSugs(); toast('Saved. Use ▶ next to the suggestion to play it again; add the downloaded file’s contents to src/replay.js to keep it.');
}
/* ---------- edit a draft before approval; the gatekeeper re-checks it ---------- */
function openEdit(id) {
  const o = F.outputs.find(x => x.id === id); if (!o) return;
  openDrawer('Edit before approval', `<p class="hint" style="margin-top:0">${esc(o.title)} · drafted by ${esc(agentName(o.agent))}. Your edit goes through the same checks as the agent’s draft: no personal notes in client-facing content (POL-4), and every number traced to a system of record (POL-2).</p><textarea id="editIn" class="editin" rows="14" aria-label="Draft text">${esc(o.body)}</textarea><div id="editIssues"></div><div style="display:flex;gap:6px;margin-top:8px"><button class="lbtn primary" data-act="save-edit" data-out="${o.id}">${icon('check')} Re-check and save</button><button class="lbtn" data-act="cancel-edit">Cancel</button></div>`);
}
function saveEdit(id) {
  const o = F.outputs.find(x => x.id === id), body = $('editIn').value.trim(); if (!o) return;
  const issues = body ? recheckOutput(o, body, UI.requester) : ['The draft is empty.'];
  if (issues.length) { $('editIssues').innerHTML = issues.map(x => `<div class="uv blocked">Not saved: ${esc(x)}</div>`).join(''); return; }
  closeDrawer(); toast(`Re-checked and saved as rev ${o.rev}${o.flagged.length ? `; ${o.flagged.join(', ')} flagged for a number check` : ''}. Still waiting for approval.`); renderAll();
}
function renderUpdates() {
  const r = UI.run, pane = $('pane-updates');
  if (!r) { patchList(pane, [{ key: 'empty', cls: 'empty', html: `<p style="font:400 19px/1.4 var(--serif);color:var(--ink);margin:0 0 8px">Ask for an outcome and press Enter.</p>Orchestration decides the plan, then assigns each task to the right team: Wholesalers, SSC, Product specialists, Content & campaigns and so on. The tasks appear on the workbench, and each team’s output shows up here the moment it’s done.` }]); return; }
  const items = [{ key: 'req-' + r.id, cls: 'dcard', html: `<div class="dt">REQUEST · ${esc(EMPLOYEES[r.requester].name)}, ${esc(TEAMS[EMPLOYEES[r.requester].team].name)}</div><b class="tt2">“${esc(r.text)}”</b>` }];
  if (r.status === 'thinking') { const act = stepStates(r).find(x => x.state === 'active'); items.push({ key: 'plan-wait', cls: 'dcard ustat', html: `<span class="spin"></span> Orchestration is planning${act ? ' · ' + esc(act.name) : ''}` }); }
  if (r.status === 'clarify') items.push({ key: 'clar-' + r.id, cls: 'clar', html: `<b>One question before planning</b><p style="margin:4px 0 0">${esc(r.clarify)}</p><input id="clarIn" placeholder="Your answer"><div style="display:flex;gap:6px;margin-top:6px"><button class="lbtn primary" data-act="answer">Continue</button><button class="lbtn" data-act="assume">Let it assume</button></div>` });
  if (r.interp) items.push({ key: 'interp-' + r.id, cls: 'dcard interpcard', html: interpHTML(r) });
  if (r.tasks.length && r.tasks[0].wave) items.push({ key: 'plan-' + r.id, cls: 'dcard plancard', html: planHTML(r) });
  const done = r.tasks.filter(t => ['done', 'failed'].includes(t.state)).sort((a, b) => (a.t1 || 0) - (b.t1 || 0));
  for (const t of done) {
    const R = ROLES[t.role], o = outOf(t), [cls, label] = taskStatus(t);
    items.push({ key: 'out-' + r.id + t.id, cls: 'dcard uout ' + cls, html: `<div class="uh"><i style="background:${TC[R.team]}"></i><span><b>Step ${t.step || '?'} · ${esc(R.name)}</b> · ${esc(TEAMS[R.team].name)}${t.person ? ' · ' + esc(t.person) : ''}<small>${routeChip(t)} ${esc(t.title)} · wave ${t.wave}</small></span><em class="bst ${cls}">${label}</em></div>
      ${t.state === 'failed' ? `<div class="blocked">This task didn’t finish: ${esc(t.error)}</div>` : ''}${t.result && t.result.says ? `<p class="says">${esc(t.result.says)}</p>` : ''}${outputHTML(o)}${verdictLines(t)}${contractHTML(t)}${sourcesHTML(r, t)}
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${o && o.status === 'Waiting for approval' ? `<button class="lbtn primary" data-approve="${o.id}">${icon('check')} Approve</button><button class="lbtn" data-edit="${o.id}">Edit</button>` : ''}<button class="lbtn" data-task="${t.id}">Open full output</button></div>` });
  }
  /* the step that is working right now, with each system call as it happens */
  for (const t of r.tasks.filter(t => t.state === 'running')) {
    const R = ROLES[t.role];
    items.push({ key: 'run-' + r.id + t.id, cls: 'dcard uout running', html: `<div class="uh"><i style="background:${TC[R.team]}"></i><span><b>Step ${t.step || '?'} · ${esc(R.name)}</b> · ${esc(TEAMS[R.team].name)}${t.person ? ' · ' + esc(t.person) : ''}<small>${routeChip(t)} ${esc(t.title)} · wave ${t.wave}</small></span><em class="bst running">In progress</em></div>${t.packet ? sourcesHTML(r, t) : ''}<p class="hint" style="margin:6px 0 0"><span class="spin"></span> ${!t.packet ? 'The foundation is assembling what this role may see…' : t.calls && t.calls.length ? 'Working from these sources…' : 'Reading the foundation; calling systems if anything is missing…'}</p>` });
  }
  if (r.status === 'done') items.push({ key: 'final-' + r.id, cls: 'dcard finalcard', html: `<div class="dt">WHAT WAS PRODUCED FOR YOUR REQUEST</div>${r.tasks.map(t => { const o = outOf(t), R = ROLES[t.role]; return `<button class="steprow" data-task="${t.id}"><span class="stepn" style="background:${TC[R.team]}">${t.step}</span><span class="stepb"><b>${esc(o ? o.title : t.title)}</b><small>${esc(R.name)} · ${esc(o ? o.status : t.state === 'failed' ? 'Did not finish' : 'No document; see details')}</small></span><em class="openlink">Open</em></button>`; }).join('')}` });
  if (r.status === 'done') items.push({ key: 'sum-' + r.id, cls: 'summary', html: `<h3>All ${r.tasks.length} tasks done · ${Math.round((r.t1 - r.t0) / 1000)} s</h3><div class="sgrid"><div><b>${r.stats.reused}</b>facts reused</div><div><b>${r.stats.committed}</b>stored</div><div><b>${r.stats.calls}</b>system calls</div></div>` });
  if (r.status === 'done') items.push({ key: 'next-' + r.id, cls: 'dcard nextcard', html: nextHTML(r) + (r.replay ? '' : `<div style="margin-top:8px"><button class="lbtn" data-act="save-run" title="Keep this run so it can be played again without an AI call, and download it for src/replay.js">Save as replay</button></div>`) });
  if (r.status === 'failed') items.push({ key: 'fail-' + r.id, cls: 'blocked', html: `<b>${esc(r.error)}</b><div style="margin-top:8px"><button class="lbtn" data-act="retry">Try again</button></div>` });
  patchList(pane, items);
}
function openTask(id) {
  const r = UI.run, t = r && r.tasks.find(x => x.id === id); if (!t) return;
  const R = ROLES[t.role], A = AGENTS[t.agent], o = outOf(t), [cls, label] = taskStatus(t);
  const ask = r.asks && t.ask ? r.asks[t.ask - 1] : null;
  const prev = r.tasks.find(x => x.step === t.step - 1), next = r.tasks.find(x => x.step === t.step + 1);
  const ups = t.depends_on.map(d => r.tasks.find(x => x.id === d)).filter(Boolean);
  const body = o ? outputHTML(o).replace('style="margin-top:6px"', 'style="margin-top:0"') : t.result && t.result.output ? `<div class="outbody"><b>${esc(t.result.output.title)}</b>\n${md(t.result.output.body)}</div><p class="hint">Not stored: ${esc(((t.verdicts || []).find(v => v.kind === 'output') || {}).reason || 'see the checks below')}</p>` : `<p class="hint">${t.state === 'done' ? 'This step produced no document; its result is shown under “How it was produced”.' : t.state === 'failed' ? 'This step did not finish: ' + esc(t.error) : 'Not finished yet.'}</p>`;
  openDrawer(`<span class="stepn big" style="background:${TC[R.team]}">${t.step || ''}</span>${esc(t.title)}`, `
    <div class="ohd"><span>${esc(TEAMS[R.team].name)} · ${esc(R.name)}${t.person ? ' · ' + esc(t.person) : ''}</span><em class="bst ${cls}">${label}</em></div>
    ${ask ? `<div class="fulfills"><small>Fulfills part ${t.ask} of the request</small><b>“${esc(ask.text)}”</b></div>` : ''}
    <div class="h">Output</div>${body}
    ${o && o.status === 'Waiting for approval' ? `<div style="display:flex;gap:6px;margin-top:8px"><button class="lbtn primary" data-approve="${o.id}">${icon('check')} Approve</button><button class="lbtn" data-edit="${o.id}">Edit</button></div>` : ''}
    ${t.result && t.result.next_step ? `<div class="h">Suggested next step</div><p class="hint" style="margin:0">${esc(t.result.next_step)}</p>` : ''}
    ${verdictLines(t) ? `<div class="h">What this step added to the foundation</div>${verdictLines(t)}` : ''}
    ${sourcesHTML(r, t)}
    <div class="h">How it was produced</div>
    <dl class="kv"><dt>Agent</dt><dd>${esc(A.name)}: ${esc(A.does)}</dd><dt>Task</dt><dd>${esc(t.objective)}</dd>${ups.length ? `<dt>Built on</dt><dd>${ups.map(x => `Step ${x.step}: ${esc(x.title)}`).join('; ')}</dd>` : ''}${t.result && t.result.says ? `<dt>Agent’s note</dt><dd>${esc(t.result.says)}</dd>` : ''}</dl>
    <details class="tcard" style="margin-top:8px"><summary style="padding:8px 10px"><span><b>Full trace</b><small>What the foundation sent, every system call and result, and each gatekeeper decision</small></span></summary>${taskHTML(r, t).replace(/^<summary>[\s\S]*?<\/summary>/, '')}</details>
    <div style="display:flex;justify-content:space-between;margin-top:14px">${prev ? `<button class="lbtn" data-task="${prev.id}">← Step ${prev.step}</button>` : '<span></span>'}${next ? `<button class="lbtn" data-task="${next.id}">Step ${next.step} →</button>` : ''}</div>`);
}
const PANES = { updates: renderUpdates, decisions: renderDecisions, packets: renderPackets, catalogue: renderCatalogue, memory: renderMemory, events: renderEvents };
let RQ = 0;
function renderAll() { if (RQ) return; RQ = requestAnimationFrame(() => { RQ = 0; renderOrch(); renderDiagram(); renderStats(); (PANES[UI.tab] || renderUpdates)(); autoScroll(); if (KG.open) renderKG(); }); }
/* Follow the work while agents run; pause for 5 s whenever the person scrolls. */
function autoScroll() {
  const r = UI.run; if (!r || !['thinking', 'running', 'done'].includes(r.status)) return;
  if (r.status === 'done' && (r._scrolledDone || UI.tab !== 'updates')) return; if (r.status === 'done') r._scrolledDone = true;
  if (performance.now() - (UI.userScrollAt || -1e9) < 5000) return;
  const pane = $('pane-' + UI.tab); if (!pane || pane.hidden) return;
  let target = null;
  if (UI.tab === 'updates') target = pane.lastElementChild;
  else if (UI.tab === 'decisions') { const lines = [...pane.querySelectorAll('.scard.active .dl')]; target = lines.filter(l => l.querySelector('.tid.running')).pop() || lines.pop() || pane.querySelector('.scard.active'); }
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
function setTab(t) { if (!PANES[t]) t = 'updates'; UI.tab = t; document.querySelectorAll('.tab').forEach(b => { b.setAttribute('aria-selected', String(b.dataset.tab === t)); if (b.dataset.tab === t) b.classList.remove('has'); }); document.querySelectorAll('.pane').forEach(p => p.hidden = p.id !== 'pane-' + t); if (PANES[t]) PANES[t](); }
function setView(v) { UI.view = v; $('app').dataset.view = v; document.querySelectorAll('.mnav button').forEach(b => b.setAttribute('aria-current', String(b.dataset.view === v))); if (v !== 'live') setTab(v); }
let tt; function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3400); }
function openDrawer(title, body) { $('drawerTitle').innerHTML = title; $('drawerBody').innerHTML = body; $('drawer').hidden = false; $('scrim').hidden = false; }
function closeDrawer() { $('drawer').hidden = true; $('scrim').hidden = true; }
function openHelp() {
  openDrawer('How it works', `<p class="lead">Type a request as anyone in Sales, Product, Marketing or Service and press Enter.</p>
  <dl class="kv"><dt>Orchestration</dt><dd>The AI decides who the request is about, what can be reused, what’s missing and how to treat anything new about the advisor, then plans the work. Nine steps, each shown as AI or RULE.</dd>
  <dt>Workbench</dt><dd>Each task is assigned to a team and role: Wholesalers (meeting prep), SSC (scheduling and follow-up), Internal wholesalers, Product specialists, Investment analytics, Content & campaigns, Compliance review, Distribution, Advisor service. Cards move from Assigned to In progress to Done.</dd>
  <dt>Updates</dt><dd>Each team’s output appears on the right the moment its task finishes, with what was shared, remembered or held for approval. Each step shows where its answer came from: what the foundation sent, which systems it queried and why, and what came back. Drafts can be edited before approval; edits are re-checked. The run ends with what you should do next.</dd>
  <dt>Agents</dt><dd>The full trace for each specialist: the exact context packet, every tool call and result, and each gatekeeper verdict.</dd>
  <dt>Foundation</dt><dd>Plain rules, not AI: what each task may see, evidence and number checks, memory rules, approvals, events and the knowledge graph.</dd></dl>
  <div class="h">Try</div><ol style="font-size:13.5px;padding-left:18px;margin:0"><li>Identify the growing trends in LA territory</li><li>Compare BFA and AMBAL for Rachel and schedule a meeting with her next month</li><li>Prep me for my call with Alex tomorrow</li><li>Alex said on today’s call he wants the numbers in an appendix from now on. Update his profile.</li></ol>
  <div class="h">Reference data</div><p class="hint">Advisors and teams are fictional. Expense ratios for GFA, BFA, AMBAL, VWUAX and VIGAX are from public sources as of the dates shown.</p>`);
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-task],[data-who],[data-sug],[data-replay],[data-tab],[data-view],[data-act],[data-approve],[data-edit],[data-commit],[data-cat-plan],[data-cat-use],[data-cat-open],[data-madv],[data-agent],[data-layer],[data-sys]'); if (!el) return;
  const d = el.dataset;
  if (d.who) { UI.requester = d.who; buildStaticWho(); return; }
  if (d.sug) { $('cmdIn').value = d.sug; $('cmdIn').focus(); return; }
  if (d.replay) { const rec = d.replay[0] === 'b' ? RECORDED[+d.replay.slice(1)] : UI.recordings[+d.replay.slice(1)]; runRequest(rec.text, rec); return; }
  if (d.tab) { setTab(d.tab); return; }
  if (d.view) { setView(d.view); return; }
  if (d.madv) { UI.memAdv = d.madv; renderMemory(); return; }
  if (d.approve) { const o = F.outputs.find(x => x.id === d.approve); if (o) { o.status = 'Approved · ready to send'; logEvent('approval.granted', o.title, UI.requester, o.adv); toast('Approved by ' + EMPLOYEES[UI.requester].name + (o.rev > 1 ? ` (edited version, rev ${o.rev})` : '') + '. Queued for the approved channel.'); renderAll(); } return; }
  if (d.edit) { openEdit(d.edit); return; }
  if (d.commit) { const [tid, k] = d.commit.split('|'), t = UI.run && UI.run.tasks.find(x => x.id === tid), v = t && t.verdicts[+k]; if (v && v.status === 'proposed') { const id = 'TASK-' + (400 + (++F.seq)), P = v.proposal; F.commitments.push({ id, adv: UI.run.advisor, scope: UI.run.unit || 'advisor', title: P.title, owner: P.owner, due: P.due, status: 'Open', run: UI.run.id }); v.status = 'committed'; v.id = id; v.reason = `Created by ${EMPLOYEES[UI.requester].name}`; logEvent('commitment.created', P.title, UI.requester, UI.run.advisor); toast('Task created: ' + P.title); renderAll(); } return; }
  if (d.catPlan) { const c = CATALOGUE.find(x => x.n === +d.catPlan); if (c && !(UI.run && ['thinking', 'running'].includes(UI.run.status))) { const who = salesRequester(); UI.requester = who; buildStaticWho(); runRequest(c.ask, catalogueReplay(c, who), { planOnly: true }); } return; }
  if (d.catUse) { const c = CATALOGUE.find(x => x.n === +d.catUse); if (c) { UI.requester = salesRequester(); buildStaticWho(); $('cmdIn').value = c.ask; $('cmdIn').focus(); toast('In the command bar. Run it, or use Plan only to see the decomposition first.'); } return; }
  if (d.catOpen) { openCatalogueEntry(+d.catOpen); return; }
  if (d.act === 'run-plan') { const r = UI.run; if (r && r.status === 'planned') { if (AI.mode !== 'live' && !(r.replay && !r.replay.orchOnly)) { toast('Running the steps needs live AI. The plan above is the decomposition.'); return; } UI.ctl = new AbortController(); executePlan(r).catch(e => finishRun(r, 'Unexpected problem: ' + errText(e))); } return; }
  if (d.act === 'save-edit') { saveEdit(d.out); return; }
  if (d.act === 'cancel-edit') { closeDrawer(); return; }
  if (d.act === 'kg') { openKG(d.adv); return; }
  if (d.act === 'answer' || d.act === 'assume') { const v = d.act === 'assume' ? 'Make your best assumption and continue' : $('clarIn').value.trim(); if (v) { const q = UI.run.clarify, t = UI.run.text.replace(/ \(clarification:.*\)$/, ''); UI.run = null; runRequest(`${t} (clarification: ${v})`, null, { clarified: { question: q, answer: v } }); } return; }
  if (d.act === 'save-run') { saveRun(UI.run); return; }
  if (d.act === 'retry') { const t = UI.run.text; UI.run = null; runRequest(t); return; }
  if (d.task) { openTask(d.task); return; }
  if (d.agent) { const a = AGENTS[d.agent]; openDrawer(esc(a.name), `<p class="hint">${esc(TEAMS[a.team].name)}</p><p class="lead">${esc(a.does)}</p><div class="h">Tools it may call</div>${a.tools.length ? a.tools.map(t => `<div class="pk"><span class="vbadge ${TOOLS[t].via}">${TOOLS[t].via}</span><span><code style="font:12px var(--code)">${esc(t)}</code><small>${esc(SYSTEMS[TOOLS[t].sys].name)} · ${esc(TOOLS[t].desc)}</small></span></div>`).join('') : '<p class="hint">None. It works only from the foundation.</p>'}<div class="h">Subscribed to</div><p class="hint">${Object.entries(SUBSCRIPTIONS).filter(([, v]) => v.includes(d.agent)).map(([k]) => k).join(', ') || 'No events'}</p>`); return; }
  if (d.layer === 'graph') { openKG(UI.memAdv || F.session.advisor); return; }
  if (d.act === 'kg') { openKG(d.adv); return; }
  if (d.layer) { const l = d.layer; openDrawer(esc(LAYERS[l].name), `<p class="lead">${esc({ memory: 'Scoped, sourced memory: current conversation, lasting preferences, pending validation, interaction history and commitments.', knowledge: 'Fund facts from the data platform, approved Seismic content, and verified findings agents have published.', policy: 'The rules every packet and contribution passes through.', models: 'Sales Alpha, peer match, cost on assets and portfolio construction.', feedback: 'Explicit reactions and outcomes.', events: 'Every committed change, and which specialists hear it.', graph: 'People, firms, buying units, memories, findings, outputs and their sources.' }[l])}</p>${l === 'policy' ? POLICIES.map(p => `<div class="pk"><span class="lid">${p.id}</span><span>${esc(p.text)}</span></div>`).join('') : l === 'knowledge' ? F.findings.map(k => `<div class="pk"><span class="lid">${esc(k.id)}</span><span><b>${esc(k.label)}</b>: ${esc(k.value)}<small>by ${esc(agentName(k.by))} · evidence ${esc(k.evidence.join(', '))}</small></span></div>`).join('') : `<p class="hint">${layerCount(l)} records right now. Open the Memory or Events tab for detail.</p>`}`); return; }
  if (d.sys) { const k = d.sys, tools = Object.entries(TOOLS).filter(([, t]) => t.sys === k); openDrawer(esc(SYSTEMS[k].name), `<p class="hint">${esc(SYSTEMS[k].sub)}</p>${tools.map(([n, t]) => `<div class="pk"><span class="vbadge ${t.via}">${t.via}</span><span><code style="font:12px var(--code)">${esc(n)}</code> · ${t.rw}<small>${esc(t.desc)}</small></span></div>`).join('')}`); return; }
});
$('runBtn').onclick = () => runRequest($('cmdIn').value);
/* Plan only: show the interpretation and the waves without running any step */
$('planBtn').onclick = () => { const v = $('cmdIn').value.trim(); if (!v) return; const c = catalogueExact(v); if (AI.mode !== 'live' && c) { const who = salesRequester(); UI.requester = who; buildStaticWho(); runRequest(c.ask, catalogueReplay(c, who), { planOnly: true }); } else runRequest(v, null, { planOnly: true }); };
$('stopBtn').onclick = () => UI.ctl && UI.ctl.abort();
$('cmdIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runRequest($('cmdIn').value); } });
$('sessionBtn').onclick = () => { F.session = { advisor: null, unit: null, requests: [], requirements: [] }; toast('New session. The conversation is closed; lasting memory, findings and commitments remain.'); renderAll(); };
$('resetBtn').onclick = () => { if (UI.run && ['thinking', 'running'].includes(UI.run.status)) return; F = freshFoundation(); UI.run = null; UI.totals = { runs: 0, reused: 0, committed: 0, pending: 0, blocked: 0, calls: 0, mcp: 0 }; toast('Foundation reset to its starting data.'); renderAll(); };
$('deepBtn').onclick = () => { AI.deep = !AI.deep; $('deepBtn').setAttribute('aria-pressed', String(AI.deep)); toast(AI.deep ? 'Agents will think longer (slower).' : 'Agents use the fast model.'); };
$('helpBtn').onclick = openHelp;
$('railBtn').onclick = () => { const on = !$('app').classList.contains('norail'); $('app').classList.toggle('norail', on); $('railBtn').setAttribute('aria-pressed', String(on)); $('railBtn').querySelector('.tlabel').textContent = on ? 'Show panel' : 'Hide panel'; requestAnimationFrame(drawOps); };
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
