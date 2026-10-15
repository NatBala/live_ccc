/* ===== Agent Harness: the orchestration canvas =====
   A request goes through the real pipeline (pipeline.js over engine.js): the
   orchestrator plans it from the shared foundation (live AI, or a saved AI run
   replayed), and every step becomes a ticket on a person's workbench. The
   canvas shows the conversation that follows: the planner assigns, each
   workbench picks up and reports back, the planner relays the handoff to the
   next workbench, context rises from the foundation, systems are read, and
   verified work is written back. The live dock shows each running agent's
   progress and output as it happens. Nothing here is scripted. */

/* ---- hooks the shared pipeline calls (the classic view has its own) ---- */
const HX_NULL = { disabled: false, hidden: false, value: '', blur() {}, focus() {}, classList: { add() {}, remove() {}, toggle() {} }, offsetWidth: 0, style: {} };
const $ = id => document.getElementById(id) || HX_NULL;
const HX = { schedule() {}, op() {}, flash() {}, toast() {}, ai() {} };
function renderAll() { HX.schedule(); }
function updateStream() { HX.schedule(); }
function addOp(o) { HX.op(o); }
function flashTile(l, cls) { HX.flash(l, cls); }
function toast(m) { HX.toast(m); }
function setAIStatus() { HX.ai(); }
function setTab() {}
function badge() {}
function buildStaticWho() {}

(() => {
/* the planner's display name, in one place; alternatives: Conductor, Nexus, Maestro, Synapse */
const HUB = 'Intelligence';
const el = id => document.getElementById(id);
const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const QS = new URLSearchParams(location.search);
if (QS.has('fast')) SLEEP_SCALE = 0.05;
UI.readPause = 0;
const ANIM = () => Math.max(SLEEP_SCALE, 0.35);

/* ---------- design tokens used from script ---------- */
const TEAM = { sales: '#2563eb', product: '#059669', marketing: '#d97706', service: '#7c3aed' };
const TCOL = t => TEAM[t] || '#64748b';
const LAYER_COL = { memory: '#7c3aed', knowledge: '#059669', policy: '#dc2626', models: '#2563eb', feedback: '#b45309', events: '#d97706', graph: '#0891b2' };
const SYS_COL = { sf: '#0b84d8', m365: '#2f5bea', seismic: '#e0482f', fund: '#059669', mstar: '#b91c1c', gen: '#ea580c', mcloud: '#0284c7', aem: '#9333ea', news: '#b45309', exp: '#475569' };
const SYS_SHORT = { sf: 'Salesforce', m365: 'Microsoft 365', seismic: 'Seismic', fund: 'Data platform', mstar: 'Morningstar', gen: 'Genesys', mcloud: 'Marketing Cloud', aem: 'AEM', news: 'News feed', exp: 'Expenses' };
const DRAFTING = { start: 'Reading the request', requester: 'Checking who is asking', entity: 'Resolving the advisor in the graph', intent: 'Classifying the business intent', asks: 'Splitting the request into asks', interpretation: 'Writing the interpretation', missing: 'Checking what the foundation already answers', memory: 'Applying memory rules', reuse: 'Looking for reusable work', controls: 'Setting controls', success: 'Defining done', task: 'Routing tickets to teams', clarify: 'Drafting a question', next: 'Planning' };

/* ---------- icons (stroke, 24px grid) ---------- */
const P = {
  play: 'M7 5l12 7-12 7z', check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6L6 18', send: 'M4 12l16-8-6 16-2-7z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z', alert: 'M12 8v5M12 16.5v.5M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  cal: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 10h16M9 3v4M15 3v4', mail: 'M4 6h16v12H4zM4 7l8 6 8-6', doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  task: 'M9 11l2.5 2.5L16 9M5 4h14v16H5z', note: 'M5 4h14v12l-4 4H5zM15 16v4M9 9h6M9 13h4', tool: 'M14.5 6.5a4 4 0 01-5 5L4 17l3 3 5.5-5.5a4 4 0 005-5l-2.5 2.5-2.5-.5-.5-2.5z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', db: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', branch: 'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9',
  arrow: 'M5 12h14M13 6l6 6-6 6', chevron: 'M9 6l6 6-6 6', pause: 'M8 5v14M16 5v14', inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3', users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c0-3.5 3-6 7-6s7 2.5 7 6M16 3.5a4 4 0 010 7.5M18 14.5c2.4.8 4 2.9 4 6.5',
  sparkles: 'M9 4l1.4 4.1L14.5 9.5l-4.1 1.4L9 15l-1.4-4.1L3.5 9.5l4.1-1.4zM17 13l.8 2.2 2.2.8-2.2.8L17 19l-.8-2.2L14 16l2.2-.8z',
  cpu: 'M8 8h8v8H8zM5 5h14v14H5zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3', link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z', target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  msg: 'M4 5h16v11H8l-4 4z', pulse: 'M3 12h4l3-8 4 16 3-8h4', expand: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7'
};
const I = (n, s = 16, cls = '') => `<svg class="i ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n] || P.doc}"/></svg>`;

/* ---------- people: refined monogram avatars ---------- */
const ROSTER = Object.entries(ROLES).map(([rid, r]) => ({ rid, team: r.team, role: r.name, name: r.person, does: r.does }));
const initials = n => String(n).replace(/,.*$/, '').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
function avatar(name, team, size = 36, ring = '') {
  const n = [...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const hues = [[221, 70], [199, 75], [172, 55], [160, 60], [262, 60], [292, 45], [24, 75], [340, 60], [210, 35], [36, 75]];
  const [hu, sa] = hues[n % hues.length];
  return `<span class="ava ${ring}" style="--s:${size}px;--g1:hsl(${hu} ${sa}% 60%);--g2:hsl(${(hu + 24) % 360} ${sa}% 42%);--tc:${TCOL(team)}"><b>${h(initials(name))}</b></span>`;
}
let ME = 'EMP-PRIYA';
const meName = () => EMPLOYEES[ME].name;

/* ---------- state ---------- */
const ST = { approved: new Set(), open: null, openTask: null, auto: false, flash: {}, menu: false, announced: null, view: 'floor', msgs: [], type: {}, recent: [], pos: {} };
const run = () => UI.run;
const tid = (r, t) => `CCE-${1000 + parseInt(String(r.id).replace(/\D/g, '') || '0', 10) * 10 + (t.step || 0)}`;
const personOf = t => t.person || (ROLES[t.role] || {}).person || meName();
const roleOfT = t => ROLES[t.role] || { name: AGENTS[t.agent].name, team: AGENTS[t.agent].team };
const depsOf = (r, t) => t.depends_on.map(d => r.tasks.find(x => x.id === d)).filter(Boolean);
const outputsOf = t => (t.verdicts || []).filter(v => v.kind === 'output').map(v => F.outputs.find(o => o.id === v.id)).filter(Boolean);
const waitingOutput = t => outputsOf(t).find(o => o.status === 'Waiting for approval');
const first = n => String(n).split(' ')[0];
function status(r, t) {
  if (t.state === 'running') return 'running';
  if (t.state === 'failed') return 'failed';
  if (t.state === 'done') return !ST.approved.has(t.id) ? 'review' : waitingOutput(t) ? 'signoff' : 'approved';
  return depsOf(r, t).every(d => ST.approved.has(d.id)) ? 'ready' : 'blocked';
}
const ST_LABEL = { ready: 'To do', blocked: 'Blocked', running: 'In progress', review: 'In review', signoff: 'Needs sign-off', approved: 'Done', failed: 'Failed', idle: 'Available' };
const ST_ICON = { ready: 'target', blocked: 'clock', running: 'cpu', review: 'eye', signoff: 'alert', approved: 'check', failed: 'alert', idle: 'users' };
const badge2 = s => `<span class="badge ${s}">${I(ST_ICON[s], 12)}${h(ST_LABEL[s])}</span>`;
const busyPlanning = () => !!(run() && run().status === 'thinking');
const anyRunning = () => !!(run() && run().tasks.some(t => t.state === 'running'));
const teamName = t => TEAMS[t].short || TEAMS[t].name;
const kindName = k => ({ brief: 'Brief', note: 'Note', email: 'Email draft', comparison: 'Comparison', one_pager: 'One-pager', agenda: 'Agenda', finding: 'Finding', content_pick: 'Content selection', case_note: 'Case note', post: 'Post', answer: 'Answer' }[k] || String(k || 'Output').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()));
/* a tool call, said the way a business user would */
const CALL_WORDS = { find_times: 'Checked availability', create_event: 'Placed a calendar hold', draft: 'Drafted an email', create_task: 'Created a task', log_activity: 'Logged the activity', update_case: 'Updated the case', cost_on_assets: 'Computed costs', compare: 'Compared funds', search_content: 'Searched approved content', synthesize: 'Generated demo evidence', changes_since: 'Read changes since last meeting', get_peers: 'Read peer data', resolve: 'Resolved fund categories', get_approved_language: 'Read approved language', get_disclosures: 'Read disclosures', plan_fee_comparison: 'Compared plan fees', portfolio_construction: 'Built a portfolio view', get_recommendations: 'Read recommendations', resolve_evidence: 'Traced the evidence' };
const callText = c => { const k = c.name.split('.')[1] || c.name; return CALL_WORDS[k] || (c.rw === 'write' ? 'Updated ' : 'Read ') + k.replace(/^get_/, '').replace(/_/g, ' '); };
const gist = out => { if (out == null) return ''; if (typeof out !== 'object') return ''; if (Array.isArray(out)) return `${out.length} record${out.length === 1 ? '' : 's'}`; const a = Object.entries(out).find(([, x]) => Array.isArray(x) && x.length); return a ? `${a[1].length} ${a[0].replace(/_/g, ' ')}` : ''; };
const reusedIn = (t, i) => { const rec = F.memory.find(m => m.id === i.id) || F.findings.find(k => k.id === i.id); return !!(rec && (rec.origin || rec.by) && (rec.origin || rec.by) !== t.agent); };

/* ---------- requests ---------- */
const recordedFor = who => RECORDED.filter(r => r.requester === who || (EMPLOYEES[r.requester] && EMPLOYEES[r.requester].team === EMPLOYEES[who].team));
const suggestions = () => AI.mode === 'live' ? (SUGGESTIONS[EMPLOYEES[ME].team] || []).slice(0, 5) : [...new Set(recordedFor(ME).map(r => r.text))].slice(0, 6);
function ask(text, clarified) {
  text = String(text || '').trim(); if (!text) return;
  if (busyPlanning() || anyRunning()) { toast('Still working on the current request.'); return; }
  const rec = RECORDED.find(r => r.text === text && r.requester === ME) || RECORDED.find(r => r.text === text);
  if (AI.mode !== 'live' && !rec) { ST.nokey = text; UI.run = null; paintAll(); return; }
  Object.assign(ST, { nokey: null, approved: new Set(), open: null, openTask: null, auto: false, announced: null, view: 'floor', msgs: [], type: {}, recent: [] });
  if (rec && AI.mode !== 'live' && rec.requester !== ME) ME = rec.requester;
  UI.requester = ME; UI.run = null;
  runRequest(text, AI.mode === 'live' ? null : rec, Object.assign({ planOnly: true }, clarified ? { clarified } : {}));
  setTimeout(() => comm('req', 'hub', `Request: “${text.replace(/ \(clarification:.*\)$/, '').slice(0, 60)}${text.length > 60 ? '…' : ''}”`, 'request'), 80);
}
function answer(v) {
  const r = run(); if (!r || r.status !== 'clarify' || !v) return;
  ask(`${r.text.replace(/ \(clarification:.*\)$/, '')} (clarification: ${v})`, { question: r.clarify, answer: v });
}

/* ---------- running tickets ---------- */
async function startTask(t) {
  const r = run(); if (!r || status(r, t) !== 'ready') return;
  if (AI.mode !== 'live' && !(r.replay && !r.replay.orchOnly)) { toast('Running agents needs live AI.'); return; }
  if (r.status === 'planned') { r.status = 'running'; r.t0 = Date.now(); if (r.advisor) { F.session.advisor = r.advisor; F.session.unit = r.unit || null; } F.session.requests.push({ text: r.text, adv: r.advisor }); }
  if (!UI.ctl || UI.ctl.signal.aborted) UI.ctl = new AbortController();
  ST.recent = [t.id, ...ST.recent.filter(x => x !== t.id)].slice(0, 6);
  comm('t:' + t.id, 'hub', `Picked up ${tid(r, t)} · running ${AGENTS[t.agent].name}`, 'ack');
  paintAll();
  try { await runTask(r, t); } catch (e) { t.state = 'failed'; t.error = errText(e); }
  if (t.state === 'done') { const o = t.result && t.result.output; comm('t:' + t.id, 'hub', `Done ${tid(r, t)} · ${o && o.title ? o.title : t.title}`, 'report'); }
  paintAll();
}
function signOff(o, by) { if (o && o.status === 'Waiting for approval') { o.status = 'Approved by ' + (by || meName()); logEvent('approval.granted', o.title, ME, o.adv); flashTile('policy', 'write'); comm('req', 'hub', `Approved “${o.title}”`, 'approve'); } }
/* hand a finished ticket on: the planner relays it to each dependent workbench */
function approve(t, signOutputs = true) {
  const r = run(); if (!r || t.state !== 'done' || ST.approved.has(t.id)) return;
  ST.approved.add(t.id);
  if (signOutputs) outputsOf(t).forEach(o => signOff(o, meName()));
  logEvent('ticket.approved', `${tid(r, t)} ${t.title}`, ME, r.advisor);
  const o = t.result && t.result.output, what = o && o.title ? o.title : t.title;
  r.tasks.filter(x => x.depends_on.includes(t.id)).forEach((x, k) => setTimeout(() => comm('hub', 't:' + x.id, `Handoff to ${tid(r, x)} · “${what}” from ${first(personOf(t))}`, 'handoff'), 300 + k * 260));
  const w = waitingOutput(t); if (w && !signOutputs) setTimeout(() => comm('hub', 'req', `Sign-off needed · “${w.title}”`, 'signoff'), 200);
  if (r.tasks.every(x => ST.approved.has(x.id))) { finishRun(r); setTimeout(() => comm('hub', 'req', `Delivered · ${r.tasks.filter(x => x.result && x.result.output).length} deliverables`, 'deliver'), 500); setTimeout(() => { ST.view = 'results'; ST.open = null; paintAll(); }, 2800 * ANIM()); toast(r.tasks.some(waitingOutput) ? 'Complete. Client-facing items are waiting for your sign-off.' : 'Complete.'); }
  paintAll();
}
function sendBack(t) { if (t.state !== 'done') return; ['result', 'verdicts', 'calls', 'packet', 'contract', 'toolResults', 'error'].forEach(k => delete t[k]); t.state = 'queued'; delete ST.type[t.id]; comm('t:' + t.id, 'hub', `Changes requested on ${tid(run(), t)}`, 'back'); paintAll(); }
async function runAll() {
  const r = run(); if (!r || !r.tasks.length || ST.auto) return;
  ST.auto = true; ST.open = null; ST.view = 'floor'; paintAll();
  while (ST.auto && run() === r && !r.tasks.every(t => ST.approved.has(t.id))) {
    const ready = r.tasks.filter(t => status(r, t) === 'ready');
    if (ready.length) { await Promise.all(ready.map(startTask)); await sleep(700); ready.filter(t => t.state === 'done').forEach(t => approve(t, false)); await sleep(500); continue; }
    const rev = r.tasks.filter(t => status(r, t) === 'review');
    if (rev.length) { rev.forEach(t => approve(t, false)); continue; }
    break;
  }
  ST.auto = false; paintAll();
}

/* ---------- communication: messages travel along the canvas ---------- */
const MSG_ICON = { request: 'send', assign: 'inbox', ack: 'play', report: 'check', handoff: 'arrow', signoff: 'alert', deliver: 'sparkles', approve: 'check', back: 'undo' };
const nodeName = id => id === 'hub' ? HUB : id === 'req' ? (run() ? EMPLOYEES[run().requester].name : meName()) : id.startsWith('t:') ? (() => { const t = run() && run().tasks.find(x => x.id === id.slice(2)); return t ? personOf(t) : id; })() : id.slice(2);
function comm(from, to, text, kind) {
  ST.msgs.unshift({ from, to, text, kind, at: Date.now() }); ST.msgs = ST.msgs.slice(0, 40);
  travel(from, to, kind === 'assign' ? text.split(' · ')[0].replace('Assigned ', '') : { request: 'Request', ack: 'Picked up', report: 'Done', handoff: 'Handoff', signoff: 'Sign-off', deliver: 'Delivered', approve: 'Approved', back: 'Changes' }[kind] || '', kind);
  paintFeed();
}
function anchor(id, side) {
  const p = ST.pos[id]; if (!p) return null;
  if (side === 'r') return [p.x + p.w, p.y + p.h / 2];
  if (side === 'l') return [p.x, p.y + p.h / 2];
  if (side === 'b') return [p.x + p.w / 2, p.y + p.h];
  if (side === 't') return [p.x + p.w / 2, p.y];
  return [p.x + p.w / 2, p.y + p.h / 2];
}
function ends(from, to) {
  const order = id => id === 'req' ? 0 : id === 'hub' ? 1 : id.startsWith('t:') ? 2 : 3;
  if (to.startsWith('sys:') || to === 'found') return [anchor(from, 'b'), anchor(to, 't')];
  if (from.startsWith('sys:') || from === 'found') return [anchor(from, 't'), anchor(to, 'b')];
  return order(from) <= order(to) ? [anchor(from, 'r'), anchor(to, 'l')] : [anchor(from, 'l'), anchor(to, 'r')];
}
function curve(a, b) {
  const vertical = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) * 1.2;
  if (vertical) { const dy = (b[1] - a[1]) * .5; return [a, [a[0], a[1] + dy], [b[0], b[1] - dy], b]; }
  const dx = Math.max(40, Math.abs(b[0] - a[0]) * .5) * (b[0] >= a[0] ? 1 : -1); return [a, [a[0] + dx, a[1]], [b[0] - dx, b[1]], b];
}
const bez = (c, t) => [0, 1].map(k => (1 - t) ** 3 * c[0][k] + 3 * (1 - t) ** 2 * t * c[1][k] + 3 * (1 - t) * t ** 2 * c[2][k] + t ** 3 * c[3][k]);
const pathD = c => `M${c[0][0]},${c[0][1]} C${c[1][0]},${c[1][1]} ${c[2][0]},${c[2][1]} ${c[3][0]},${c[3][1]}`;
function travel(from, to, label, kind, color) {
  const cv = el('canvas'); if (!cv || ST.view !== 'floor') return;
  const e = ends(from, to); if (!e[0] || !e[1]) return;
  const c = curve(e[0], e[1]), d = document.createElement('div'), dur = 1100 * ANIM();
  d.className = 'pk ' + (kind || ''); if (color) d.style.setProperty('--c', color);
  d.innerHTML = `${I(MSG_ICON[kind] || 'db', 11)}${label ? `<span>${h(label)}</span>` : ''}`;
  cv.appendChild(d);
  const trail = document.createElementNS('http://www.w3.org/2000/svg', 'path'); trail.setAttribute('d', pathD(c)); trail.setAttribute('class', 'trail ' + (kind || '')); if (color) trail.style.stroke = color;
  const svg = cv.querySelector('svg.edges'); if (svg) svg.appendChild(trail);
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / dur), e2 = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2, p = bez(c, e2); d.style.transform = `translate(${p[0]}px,${p[1]}px) translate(-50%,-50%)`; d.style.opacity = k > .88 ? (1 - k) / .12 : 1; if (k < 1) requestAnimationFrame(step); else { d.remove(); trail.classList.add('gone'); setTimeout(() => trail.remove(), 600); const n = cv.querySelector(`[data-node="${CSS.escape(to)}"]`); if (n) { n.classList.remove('ping'); void n.offsetWidth; n.classList.add('ping'); } } };
  requestAnimationFrame(step);
}
function announcePlan(r) {
  if (ST.announced === r.id || !r.tasks.length || !['planned', 'running'].includes(r.status)) return;
  ST.announced = r.id;
  r.tasks.forEach((t, k) => setTimeout(() => comm('hub', 't:' + t.id, `Assigned ${tid(r, t)} · ${t.title}`, 'assign'), 350 + k * 420 * ANIM()));
}

/* ---------- painting ---------- */
function setHTML(node, html) { if (node && node._h !== html) { node.innerHTML = html; node._h = html; } }
let raf = 0;
HX.schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintAll(); }); };
function paintAll() { paintTop(); paintOrch(); paintFloor(); paintBench(); const r = run(); if (r) announcePlan(r); }

function paintTop() {
  const E = EMPLOYEES[ME];
  setHTML(el('asker'), `<button type="button" class="askbtn" data-menu title="Asking as ${h(E.name)}">${avatar(E.name, E.team, 24)}<span>${h(first(E.name))}</span>${I('chevron', 12, 'rot')}</button>${ST.menu ? `<div class="menu"><div class="mh">Ask as</div>${Object.entries(EMPLOYEES).map(([id, e]) => `<button type="button" data-me="${id}" class="${id === ME ? 'on' : ''}">${avatar(e.name, e.team, 28)}<span><b>${h(e.name)}</b><small>${h(e.role.split(',')[0])} · ${h(teamName(e.team))}</small></span>${id === ME ? I('check', 14) : ''}</button>`).join('')}</div>` : ''}`);
  el('send').disabled = busyPlanning() || anyRunning();
}

/* left: the orchestrator */
const kv = (k, v) => v ? `<div class="kvr"><span>${h(k)}</span><span>${v}</span></div>` : '';
function paintOrch() {
  const r = run();
  if (!r) {
    setHTML(el('orch'), `<div class="ohead"><span class="omark">${I('branch', 16)}</span><div><b>${HUB}</b><small>Plans from the shared foundation</small></div></div>
      <div class="intro"><h2>What outcome do you need?</h2><p>${HUB} checks the shared foundation, plans the work and routes a ticket to every team that owns a piece of it.</p>
        <ol class="how"><li><span>1</span>Plan from what the foundation knows</li><li><span>2</span>Route tickets to the owning teams</li><li><span>3</span>Agents run, people approve</li></ol></div>
      ${ST.nokey ? `<div class="callout warn">${I('alert', 16)}<div><b>No AI key on this server.</b> “${h(ST.nokey)}” can’t be planned live. Choose a saved AI run below, or add an OpenAI or Azure OpenAI key.</div></div>` : ''}
      <div class="sh">${AI.mode === 'live' ? 'Suggested' : 'Saved AI runs'}</div><div class="sugs">${suggestions().map(s => `<button type="button" class="sug" data-ask="${h(s)}"><span>${h(s)}</span>${I('arrow', 14)}</button>`).join('')}</div>`);
    return;
  }
  const B = r.bts || {}, C = B.context || {}, In = r.interp, thinking = r.status === 'thinking';
  const lookup = r.decisions.find(d => d.type === 'lookup');
  const assumed = r.decisions.filter(d => d.type === 'missing');
  const known = r.decisions.filter(d => ['entity', 'known', 'reuse', 'memory'].includes(d.type) && d.src !== 'code');
  const live = r.decisions.filter(d => d.type !== 'lookup').slice(-4);
  const waves = [...new Set(r.tasks.map(t => t.wave))].sort((a, b) => a - b);
  const done = r.tasks.filter(t => ST.approved.has(t.id)).length, teams = new Set(r.tasks.map(t => roleOfT(t).team)).size;
  const ready = r.tasks.some(t => status(r, t) === 'ready');
  let stat = '';
  if (thinking) stat = `<div class="scard think"><div class="srow"><span class="spin"></span><b>${h(DRAFTING[B.drafting] || 'Planning')}</b></div><div class="shimmer"></div><small>${r.replay ? 'Replaying the orchestrator’s saved reasoning' : B.chars ? `${B.chars.toLocaleString()} characters streamed from the model` : 'Sending the request with foundation context'}</small></div>`;
  else if (r.status === 'clarify') stat = `<div class="scard ask"><div class="srow">${I('alert', 16)}<b>One question</b></div><small>The foundation couldn’t settle this on its own.</small></div>`;
  else if (r.status === 'done') stat = `<div class="scard ok"><div class="srow">${I('check', 16)}<b>Complete</b></div><small>${r.tasks.length} tickets · ${teams} team${teams > 1 ? 's' : ''} · ${Math.max(1, Math.round(((r.t1 || Date.now()) - r.t0) / 1000))} s${r.tasks.some(waitingOutput) ? ' · sign-off pending' : ''}</small><div class="twob"><button type="button" class="btn primary" data-view="results">${I('doc', 13)} Results</button><button type="button" class="btn" data-view="found">${I('layers', 13)} Foundation</button></div></div>`;
  else if (r.tasks.length) stat = `<div class="scard plan"><div class="srow"><b>${r.status === 'planned' ? 'Plan ready' : ST.auto ? 'Running all agents' : 'In progress'}</b>${ST.auto ? '<span class="spin"></span>' : ''}</div>
      <div class="kpis"><div><b>${r.tasks.length}</b><small>tickets</small></div><div><b>${teams}</b><small>team${teams > 1 ? 's' : ''}</small></div><div><b>${waves.length}</b><small>wave${waves.length > 1 ? 's' : ''}</small></div><div><b>${done}/${r.tasks.length}</b><small>done</small></div></div>
      <div class="prog"><i style="width:${done / r.tasks.length * 100}%"></i></div>
      ${ST.auto ? `<button type="button" class="btn subtle block" data-stop>${I('pause', 14)} Pause</button>` : ready ? `<button type="button" class="btn primary block lg" data-runall>${I('play', 14)} Run all agents</button><small class="note">Teams hand off through ${HUB}. Client-facing drafts wait for your sign-off.</small>` : ''}</div>`;
  setHTML(el('orch'), `<div class="ohead"><span class="omark${thinking ? ' pulse' : ''}">${I('branch', 16)}</span><div><b>${HUB}</b><small>${r.replay ? 'Replaying a saved AI run' : 'Planning and orchestration'}</small></div></div>
    <div class="reqq">${avatar(EMPLOYEES[r.requester].name, EMPLOYEES[r.requester].team, 26)}<div><small>${h(EMPLOYEES[r.requester].name)}</small><p>${h(r.text.replace(/ \(clarification:.*\)$/, ''))}</p></div></div>
    ${stat}
    ${r.status === 'clarify' ? clarifyHTML(r) : ''}
    ${thinking && live.length ? `<div class="sh">Reasoning</div><div class="reason">${live.map(d => `<div class="rz"><span class="tag ${d.src === 'code' ? 'rule' : 'ai'}">${d.src === 'code' ? 'Rule' : 'AI'}</span><span>${h(d.title)}</span></div>`).join('')}</div>` : ''}
    ${r.tasks.length && r.status !== 'clarify' ? `<div class="sh">Tickets</div><div class="tl">${waves.map(w => `<div class="wv">Wave ${w}${r.tasks.filter(t => t.wave === w).length > 1 ? ' · parallel' : ''}</div>${r.tasks.filter(t => t.wave === w).map(t => { const s = status(r, t), R = roleOfT(t); return `<button type="button" class="tr ${s}${ST.openTask === t.id ? ' sel' : ''}" data-task="${t.id}"><span class="node ${s}">${s === 'running' ? '<span class="spin"></span>' : I(ST_ICON[s], 12)}</span><span class="trb"><b>${h(t.title)}</b><small><code>${tid(r, t)}</code> · ${h(R.name)} · ${h(personOf(t))}</small></span></button>`; }).join('')}`).join('')}</div>` : ''}
    ${assumed.length || known.length ? `<div class="sh">Answered by the foundation</div><div class="ans">${known.slice(0, 2).concat(assumed).slice(0, 4).map(d => `<div class="an">${I('check', 14)}<div><b>${h(d.title)}</b><small>${h(d.detail || '')}</small></div></div>`).join('')}</div>` : ''}
    ${In ? `<div class="sh">Interpretation</div><div class="kvs">${kv('Intent', In.intent ? `<span class="tag">${h(In.intent)}</span>` : '')}${kv('Subject', h(In.subject && In.subject.label))}${kv('Output', h(In.output))}${kv('Time', h(In.time))}${kv('Authority', r.authority ? `${I('lock', 12)} ${h(AUTHORITY[r.authority].label)}` : '')}</div>` : ''}
    <div class="sh">Grounding</div><div class="kvs">${kv('Graph', h(lookup ? lookup.detail || lookup.title : '…'))}${C.memories != null ? kv('Context', `${C.memories} memories · ${C.content} approved pieces · ${C.funds} funds · ${C.routes} routes`) : ''}</div>`);
}
function clarifyHTML(r) {
  const opts = (r.clarifyOptions || []).length ? r.clarifyOptions : (r.resolution && r.resolution.candidates || []).slice(0, 3).map(c => c.name);
  return `<div class="qcard"><b>${h(r.clarify)}</b>${r.clarifyWhy ? `<p>${h(r.clarifyWhy)}</p>` : ''}${opts.map((o, k) => `<button type="button" class="opt" data-answer="${h(o)}"><kbd>${k + 1}</kbd>${h(o)}</button>`).join('')}<div class="other"><input class="clarIn" placeholder="Type an answer…"><button type="button" class="btn subtle sm" data-answer-input>Answer</button></div><button type="button" class="link" data-answer="Make your best assumption and continue">Proceed with a stated assumption</button></div>`;
}

/* middle: orchestration canvas + live dock, or results */
function paintFloor() {
  const r = run(), box = el('floor');
  if (!box._init) {
    box.innerHTML = `<div class="fh"><div class="seg" id="vtabs"></div><span id="fsub" class="fsub"></span><span id="fcta"></span></div>
      <div class="results" id="results"></div><div class="fview" id="fview"></div>
      <div class="orchview" id="orchview"><div class="canvas" id="canvas"><svg class="edges"><defs><linearGradient id="beam" x1="0" x2="1"><stop offset="0" stop-color="#2f5bea" stop-opacity="0"/><stop offset=".5" stop-color="#2f5bea"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/></linearGradient></defs><g class="base"></g></svg><div class="nodes"></div><div class="lane"></div></div>
        <div class="dock"><div class="live" id="live"></div><div class="feed" id="feed"></div></div></div>`;
    box._init = 1;
    new ResizeObserver(() => paintCanvas()).observe(el('canvas'));
    setInterval(tickType, 30);
  }
  const hasRes = r && r.tasks.some(t => t.result);
  if (!hasRes && ST.view !== 'floor') ST.view = 'floor';
  setHTML(el('vtabs'), `<button type="button" class="${ST.view === 'floor' ? 'on' : ''}" data-view="floor">${I('branch', 14)} Orchestration</button><button type="button" class="${ST.view === 'results' ? 'on' : ''}" data-view="results" ${hasRes ? '' : 'disabled'}>${I('doc', 14)} Results${r && r.status === 'done' ? '<i class="dotok"></i>' : ''}</button><button type="button" class="${ST.view === 'found' ? 'on' : ''}" data-view="found" ${hasRes ? '' : 'disabled'}>${I('layers', 14)} Foundation</button>`);
  el('fsub').textContent = !r ? 'Ask for an outcome to see the plan come to life' : r.tasks.length ? `${r.tasks.length} ticket${r.tasks.length > 1 ? 's' : ''} across ${new Set(r.tasks.map(t => personOf(t))).size} workbench${new Set(r.tasks.map(t => personOf(t))).size > 1 ? 'es' : ''}` : r.status === 'thinking' ? 'Planning from the shared foundation…' : '';
  setHTML(el('fcta'), r && r.tasks.length && ['planned', 'running'].includes(r.status) && !ST.auto && r.tasks.some(t => status(r, t) === 'ready') ? `<button type="button" class="btn primary" data-runall>${I('play', 13)} Run all agents</button>` : '');
  el('results').hidden = ST.view !== 'results'; el('fview').hidden = ST.view !== 'found'; el('orchview').hidden = ST.view !== 'floor';
  if (ST.view === 'results' && r) setHTML(el('results'), resultsHTML(r));
  else if (ST.view === 'found' && r) setHTML(el('fview'), foundationHTML(r));
  else { paintCanvas(); paintLive(); paintFeed(); }
}

/* the canvas: requester → orchestrator → workbenches by wave, over the foundation and systems */
function layout(r) {
  const cv = el('canvas'), W = cv.clientWidth, H = cv.clientHeight, laneH = 104, top = 14, Hn = Math.max(160, H - laneH - top - 10);
  const pos = {}, nodeH = 66;
  const reqW = 152, hubW = 124, hubH = 124;
  pos.req = { x: 16, y: top + Hn / 2 - nodeH / 2, w: reqW, h: nodeH };
  pos.hub = { x: 16 + reqW + 40, y: top + Hn / 2 - hubH / 2, w: hubW, h: hubH };
  const waves = r && r.tasks.length ? [...new Set(r.tasks.map(t => t.wave))].sort((a, b) => a - b) : [];
  const x0 = pos.hub.x + hubW + 58, avail = W - x0 - 16, colW = waves.length ? Math.min(260, avail / waves.length) : 0, nodeW = Math.max(150, Math.min(232, colW - 22));
  waves.forEach((w, ci) => { const col = r.tasks.filter(t => t.wave === w).sort((a, b) => a.step - b.step), gap = Math.min(nodeH + 20, (Hn - 16) / col.length), nh = Math.min(nodeH, gap - 10);
    col.forEach((t, k) => { pos['t:' + t.id] = { x: x0 + ci * colW, y: top + 18 + (Hn - 16) / 2 - (col.length * gap) / 2 + k * gap + (gap - nh) / 2, w: nodeW, h: nh, wave: w, compact: nh < 56 }; }); });
  pos.found = { x: 16, y: H - laneH + 4, w: W - 32, h: 40 };
  const sysW = (W - 32) / SYS_ORDER.length;
  SYS_ORDER.forEach((k, i) => { pos['sys:' + k] = { x: 16 + i * sysW + 3, y: H - 46, w: sysW - 6, h: 30 }; });
  return { pos, waves, x0, colW, W, H, Hn };
}
function paintCanvas() {
  const cv = el('canvas'); if (!cv || ST.view !== 'floor') return;
  const r = run(), L = layout(r); ST.pos = L.pos;
  const nodes = cv.querySelector('.nodes'), svg = cv.querySelector('svg.edges'), base = svg.querySelector('g.base');
  svg.setAttribute('width', L.W); svg.setAttribute('height', L.H);
  const E = r ? EMPLOYEES[r.requester] : EMPLOYEES[ME];
  const items = [];
  const reqState = r ? (r.status === 'done' ? 'done' : r.tasks.some(waitingOutput) ? 'wait' : 'active') : 'idle';
  items.push({ k: 'req', html: `${avatar(E.name, E.team, 34)}<div><small>Requester</small><b>${h(E.name)}</b><span>${r ? (r.status === 'done' ? 'Delivered' : r.tasks.some(waitingOutput) ? 'Sign-off waiting' : 'Waiting for results') : 'Ready to ask'}</span></div>`, cls: 'nd req ' + reqState });
  const thinking = r && r.status === 'thinking';
  items.push({ k: 'hub', html: `<div class="orb${thinking || anyRunning() || ST.auto ? ' spin2' : ''}"><i></i><i></i></div><div class="hubc">${I('branch', 22)}<b>${HUB}</b><small>${!r ? 'Idle' : thinking ? 'Planning' : r.status === 'clarify' ? 'Asking' : r.status === 'done' ? 'Complete' : `${r.tasks.filter(t => ST.approved.has(t.id)).length}/${r.tasks.length} done`}</small></div>`, cls: 'nd hub' + (thinking ? ' think' : '') });
  if (r) r.tasks.forEach(t => {
    const st = status(r, t), R = roleOfT(t), p = personOf(t), P0 = L.pos['t:' + t.id] || {};
    items.push({ k: 't:' + t.id, html: `${avatar(p, R.team, P0.compact ? 26 : 32, st)}<div><small><code>${tid(r, t)}</code> ${h(R.name)}</small><b>${h(t.title)}</b>${P0.compact ? '' : `<span>${h(p)}${p === meName() ? ' · you' : ''}</span>`}</div>${badge2(st)}${st === 'running' ? '<i class="scan"></i>' : ''}`, cls: `nd wb ${st}${ST.openTask === t.id && ST.open ? ' sel' : ''}${P0.compact ? ' compact' : ''}`, team: R.team, task: t.id });
  });
  const now = performance.now(), hot = k => { const f = ST.flash[k]; if (!f) return ''; const at = typeof f === 'number' ? f : f.at; return now - at < 1400 ? (f.cls || 'hot') : ''; };
  items.push({ k: 'found', html: `<span class="fl2">${I('layers', 14)}<b>Shared foundation</b></span>${LAYER_ORDER.map(l => `<span class="ly2 ${hot('l:' + l)}" style="--c:${LAYER_COL[l]}"><i></i>${h(LAYERS[l].short || LAYERS[l].name)}<b>${layerCount(l)}</b></span>`).join('')}`, cls: 'nd found' });
  SYS_ORDER.forEach(k => { const n = r ? r.tasks.reduce((m, t) => m + (t.calls || []).filter(c => c.sys === k).length, 0) : 0; items.push({ k: 'sys:' + k, html: `<i></i>${h(SYS_SHORT[k])}${n ? `<b>${n}</b>` : ''}`, cls: `nd sys ${hot('s:' + k) ? 'hot' : n ? 'used' : ''}`, color: SYS_COL[k] }); });
  /* keyed nodes, positioned absolutely */
  const have = new Map([...nodes.children].map(c => [c.dataset.node, c]));
  items.forEach(it => {
    let c = have.get(it.k); const p = L.pos[it.k]; if (!p) return;
    if (!c) { c = document.createElement('div'); c.dataset.node = it.k; nodes.appendChild(c); c.style.left = p.x + 'px'; c.style.top = p.y + 'px'; c.classList.add('enter'); }
    const keep = ['ping', 'enter'].filter(x => c.classList.contains(x));
    c.className = it.cls + ' ' + keep.join(' ');
    if (it.team) c.style.setProperty('--c', TCOL(it.team)); if (it.color) c.style.setProperty('--c', it.color);
    if (it.task) c.dataset.task2 = it.task;
    c.style.left = p.x + 'px'; c.style.top = p.y + 'px'; c.style.width = p.w + 'px'; c.style.height = p.h + 'px';
    setHTML(c, it.html); have.delete(it.k);
  });
  have.forEach(c => c.remove());
  /* base edges */
  const P2 = L.pos, edges = [];
  const line = (a, b, cls) => { const e2 = ends(a, b); if (e2[0] && e2[1]) edges.push(`<path class="${cls}" d="${pathD(curve(e2[0], e2[1]))}"/>`); };
  line('req', 'hub', 'edge' + (r ? ' on' : ''));
  if (r) r.tasks.forEach(t => {
    const k = 't:' + t.id; if (!P2[k]) return; const running = t.state === 'running';
    line('hub', k, 'edge on' + (running ? ' live' : ''));
    if (running) line('hub', k, 'beam');
    t.depends_on.forEach(d => { if (P2['t:' + d]) line('t:' + d, k, 'dep'); });
    const a2 = anchor(k, 'b'); edges.push(`<path class="drop${running ? ' live' : ''}" d="M${a2[0]},${a2[1]} L${a2[0]},${P2.found.y}"/>`);
  });
  base.innerHTML = edges.join('');
  /* wave headers */
  const lane = cv.querySelector('.lane');
  const par = L.waves.map((w, i) => { const col = r.tasks.filter(t => t.wave === w), live = col.filter(t => t.state === 'running').length, ps = col.map(t => P2['t:' + t.id]).filter(Boolean);
    const top2 = Math.min(...ps.map(p => p.y)), bot = Math.max(...ps.map(p => p.y + p.h));
    return `<span class="wvh${live > 1 ? ' on' : ''}" style="left:${L.x0 + i * L.colW}px">Wave ${w}${col.length > 1 ? ` · ${live > 1 ? `<b><i></i>${live} running in parallel</b>` : `${col.length} in parallel`}` : ''}</span>${col.length > 1 ? `<span class="pbr${live > 1 ? ' on' : ''}" style="left:${L.x0 + i * L.colW - 9}px;top:${top2}px;height:${bot - top2}px"></span>` : ''}`; }).join('');
  setHTML(lane, par + (!r ? `<div class="idle-hint" style="left:${P2.hub.x + P2.hub.w + 70}px;top:${P2.hub.y + 10}px"><b>Workbenches appear here</b><span>Each step of the plan becomes a ticket on the workbench of the person who owns it. Messages flow through ${HUB} as work is picked up, finished and handed off.</span><div class="roster">${ROSTER.map(p => `<button type="button" class="rp" data-person="${h(p.name)}" title="${h(p.name)} · ${h(p.role)}">${avatar(p.name, p.team, 26)}</button>`).join('')}</div></div>` : ''));
}

/* the live dock: what each agent is doing right now, without scrolling */
function liveTickets(r) {
  if (!r) return [];
  const running = r.tasks.filter(t => t.state === 'running');
  const rest = ST.recent.map(id => r.tasks.find(t => t.id === id)).filter(t => t && !running.includes(t));
  return running.concat(rest).slice(0, 3);
}
function stepsOf(t) {
  const st = [
    ['Context', !!t.packet, t.packet ? `${t.packet.items.length} items` : ''],
    ['Systems', !!t.result, (t.calls || []).length ? `${t.calls.length} read${t.calls.length > 1 ? 's' : ''}` : t.packet ? 'checking' : ''],
    ['Drafting', !!t.result, t.result ? 'written' : ''],
    ['Verified', !!t.verdicts, t.verdicts ? `${t.verdicts.filter(v => ['published', 'committed'].includes(v.status)).length} stored` : '']];
  const cur = st.findIndex(s => !s[1]);
  return st.map((s, i) => ({ label: s[0], done: s[1], now: t.state === 'running' && i === cur, note: s[2] }));
}
function plain(body) { return String(body || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, ''); }
function tickType() {
  const r = run(); if (!r) return; let any = false;
  liveTickets(r).forEach(t => { const o = t.result && t.result.output, full = o ? plain(o.body).length : 0; const cur = ST.type[t.id] || 0; if (o && cur < full) { ST.type[t.id] = Math.min(full, cur + Math.max(4, Math.round(full / 90))); any = true; } });
  if (any) paintLive();
}
function paintLive() {
  const box = el('live'); if (!box) return;
  const r = run(), ts = liveTickets(r);
  if (!ts.length) { setHTML(box, `<div class="lempty">${I('pulse', 22)}<b>${r && r.tasks.length ? 'Ready when you are' : 'Live agent output'}</b><span>${r && r.tasks.length ? 'Press Run all agents, or open a workbench and run one ticket. Progress and output stream in here.' : 'When agents run, their progress and output stream in here, live.'}</span></div>`); return; }
  if (box.querySelector('.lempty')) box.innerHTML = '';
  box._h = null;
  const cards = ts.map(t => {
    const s = status(r, t), R = roleOfT(t), p = personOf(t), o = t.result && t.result.output, n = ST.type[t.id] || 0;
    const sys = {}; (t.calls || []).forEach(c => { (sys[c.sys] = sys[c.sys] || []).push(c); });
    const lastCall = (t.calls || []).slice(-1)[0];
    const reused = t.packet ? t.packet.items.filter(i => reusedIn(t, i)).length : 0;
    const text = o ? plain(o.body).slice(0, n) : '';
    const now = t.state === 'running' ? (!t.packet ? 'Assembling context from the shared foundation' : lastCall ? `${SYS_SHORT[lastCall.sys] || 'Gateway'} · ${callText(lastCall)}` : 'Reading the context') : '';
    const inner = `
      <header>${avatar(p, R.team, 28, s)}<div><b>${h(p)}</b><small>${h(R.name)} · <code>${tid(r, t)}</code></small></div>${badge2(s)}</header>
      <div class="lt">${h(t.title)}</div>
      <div class="trk">${stepsOf(t).map(x => `<span class="${x.done ? 'done' : x.now ? 'now' : ''}"><i>${x.done ? I('check', 10) : x.now ? '<span class="spin"></span>' : ''}</i><b>${x.label}</b><small>${h(x.note)}</small></span>`).join('')}</div>
      <div class="lsys">${t.packet ? `<span class="lchip found">${I('layers', 11)}${t.packet.items.length} from foundation${reused ? ` · ${reused} reused` : ''}</span>` : ''}${Object.entries(sys).map(([k, cs]) => `<span class="lchip" style="--c:${SYS_COL[k] || '#64748b'}" title="${h(cs.map(callText).join(', '))}"><i></i>${h(SYS_SHORT[k] || k)} · ${h(callText(cs[cs.length - 1]).toLowerCase())}${cs.length > 1 ? ` +${cs.length - 1}` : ''}</span>`).join('')}</div>
      <div class="lout">${o ? `<div class="lot"><small>${h(kindName(o.kind))}</small><b>${h(o.title || '')}</b></div><p>${h(text)}${n < plain(o.body).length ? '<i class="caret"></i>' : ''}</p>` : now ? `<div class="lnow"><span class="dots"><i></i><i></i><i></i></span>${h(now)}</div>` : t.state === 'failed' ? `<div class="lnow bad">${h(t.error || 'Failed')}</div>` : ''}</div>
      <footer><button type="button" class="link" data-task="${t.id}">${I('expand', 12)} Open ticket</button></footer>`;
    return { k: t.id, cls: `lc ${s}`, color: TCOL(R.team), html: inner };
  });
  /* keyed cards: each animates in once, then only its contents change */
  const have = new Map([...box.children].map(c => [c.dataset.k, c]));
  cards.forEach((c, i) => { let n = have.get(c.k); if (!n) { n = document.createElement('article'); n.dataset.k = c.k; n.classList.add('fresh'); } if (box.children[i] !== n) box.insertBefore(n, box.children[i] || null); n.className = c.cls + (n.classList.contains('fresh') ? ' fresh' : ''); n.style.setProperty('--c', c.color); setHTML(n, c.html); have.delete(c.k); });
  have.forEach(n => n.remove());
  setTimeout(() => box.querySelectorAll('.fresh').forEach(n => n.classList.remove('fresh')), 500);
}
function paintFeed() {
  const box = el('feed'); if (!box) return;
  const r = run(), ms = ST.msgs.slice(0, 7);
  const who = id => id === 'hub' ? `<span class="hubdot">${I('branch', 11)}</span>` : id === 'req' ? avatar(nodeName(id), r ? EMPLOYEES[r.requester].team : EMPLOYEES[ME].team, 20) : (() => { const t = r && r.tasks.find(x => 't:' + x.id === id); return t ? avatar(personOf(t), roleOfT(t).team, 20) : avatar(id.slice(2), 'sales', 20); })();
  setHTML(box, `<div class="fdh">${I('msg', 13)}<b>Live messages</b><small>${ST.msgs.length}</small></div>${ms.length ? ms.map((m, i) => `<div class="fm ${m.kind}${i === 0 ? ' new' : ''}"><span class="fw">${who(m.from)}${I('arrow', 10, 'ar')}${who(m.to)}</span><div><b>${h(m.text)}</b><small>${h(first(nodeName(m.from)))} → ${h(first(nodeName(m.to)))} · ${ago(m.at)}</small></div></div>`).join('') : '<p class="fempty">Assignments, pick-ups, reports and handoffs between the orchestrator and each workbench appear here.</p>'}`);
}
const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 3 ? 'now' : s < 60 ? s + 's ago' : Math.round(s / 60) + 'm ago'; };
setInterval(() => { if (ST.msgs.length) paintFeed(); }, 5000);

/* the final output */
function actionTile(c, t) {
  const o = c.out || {}, i = c.input || {}, who = personOf(t), team = roleOfT(t).team;
  if (c.name === 'calendar.create_event') { const hold = /tentative|hold/i.test(o.status || ''); return { icon: 'cal', tone: 'blue', kind: hold ? 'Tentative hold placed' : 'Meeting scheduled', big: o.time || i.time || '', title: o.title || i.title, lines: [(o.attendees || []).join(', '), o.status], id: o.event_id, who, team }; }
  if (c.name === 'mail.draft') return { icon: 'mail', tone: 'violet', kind: 'Email drafted', big: o.subject || i.subject || '', title: 'To ' + (o.to || i.to || ''), lines: [o.status], id: o.draft_id, who, team };
  if (c.name === 'crm.create_task') return { icon: 'task', tone: 'green', kind: 'Task created', big: o.title || i.title || '', title: [o.owner && 'Owner ' + o.owner, o.due && 'due ' + o.due].filter(Boolean).join(', '), lines: [], id: o.task_id, who, team };
  if (c.name === 'crm.log_activity') return { icon: 'note', tone: 'slate', kind: 'Logged to Salesforce', big: '', title: o.logged || '', lines: [], id: o.activity_id, who, team };
  if (c.name === 'service.update_case') return { icon: 'tool', tone: 'amber', kind: 'Case updated', big: o.status || '', title: o.case_id || '', lines: [], id: o.case_id, who, team };
  return null;
}
function resultsHTML(r) {
  const S = r.stats, E = EMPLOYEES[r.requester], doneAll = r.status === 'done', teams = new Set(r.tasks.map(t => roleOfT(t).team));
  const acts = r.tasks.flatMap(t => (t.calls || []).filter(c => c.rw === 'write' && !c.error).map(c => actionTile(c, t))).filter(Boolean);
  const docs = r.tasks.filter(t => t.result && t.result.output && t.result.output.body);
  const waiting = r.tasks.flatMap(t => outputsOf(t).filter(o => o.status === 'Waiting for approval').map(o => ({ o, t })));
  const proposed = r.tasks.flatMap(t => (t.verdicts || []).filter(v => v.kind === 'commitment').map(v => ({ v, t })));
  const stored = r.tasks.flatMap(t => (t.verdicts || []).filter(v => ['published', 'committed'].includes(v.status) && v.kind !== 'output').map(v => ({ v, t })));
  const secs = Math.max(1, Math.round(((r.t1 || Date.now()) - r.t0) / 1000));
  const tiles = acts.map(a => `<div class="ot ${a.tone}"><span class="oti">${I(a.icon, 18)}</span><div class="otb"><small>${h(a.kind)}</small>${a.big ? `<b>${h(a.big)}</b>` : ''}<span>${h(a.title || '')}</span>${a.lines.filter(Boolean).map(l => `<em>${h(l)}</em>`).join('')}<footer>${avatar(a.who, a.team, 18)}${h(a.who)}${a.id ? `<code>${h(a.id)}</code>` : ''}</footer></div></div>`)
    .concat(docs.map(t => { const o = t.result.output, rec = outputsOf(t)[0]; return `<a class="ot doc" href="#doc-${t.id}"><span class="oti">${I('doc', 18)}</span><div class="otb"><small>${h(kindName(o.kind))}</small><b>${h(o.title || t.title)}</b>${rec ? `<em class="${rec.status === 'Waiting for approval' ? 'w' : 'ok'}">${rec.status === 'Waiting for approval' ? 'Awaiting sign-off' : h(rec.status)}</em>` : ''}<footer>${avatar(personOf(t), roleOfT(t).team, 18)}${h(personOf(t))} · ${h(roleOfT(t).name)}</footer></div></a>`; }));
  return `<section class="hero"><div class="hl"><span class="st ${doneAll ? 'ok' : ''}">${I(doneAll ? 'check' : 'clock', 13)}${doneAll ? 'Complete' : 'In progress'}</span><h1>${h(r.text.replace(/ \(clarification:.*\)$/, ''))}</h1><p>Requested by ${h(E.name)} · ${r.tasks.length} tickets across ${teams.size} team${teams.size > 1 ? 's' : ''} · ${secs} s · ${ST.msgs.length} orchestration messages</p></div>
      <div class="metrics"><div class="mlink" data-view="found"><b>${S.reads}</b><small>Foundation items read ${I('arrow', 11)}</small></div><div><b>${S.reused}</b><small>Reused from other teams</small></div><div><b>${S.calls}</b><small>System reads and writes</small></div><div><b>${S.committed}</b><small>Stored back</small></div></div></section>
    ${waiting.length ? `<section class="signbox"><header>${I('alert', 16)}<div><b>Awaiting your sign-off</b><small>Client-facing. Nothing is sent until you approve.</small></div></header>${waiting.map(({ o, t }) => `<div class="sr">${avatar(personOf(t), roleOfT(t).team, 28)}<div><b>${h(o.title)}</b><small>${h(kindName(o.kind))} · ${h(personOf(t))}, ${h(roleOfT(t).name)}</small></div><a class="btn subtle sm" href="#doc-${t.id}">${I('eye', 13)} Review</a><button type="button" class="btn primary sm" data-signoff="${h(o.id)}">${I('check', 13)} Approve</button></div>`).join('')}</section>` : ''}
    <div class="sh2">Outcomes</div><div class="ots">${tiles.join('') || '<p class="muted">Nothing finished yet.</p>'}</div>
    ${proposed.length ? `<div class="sh2">Follow-ups</div><div class="list">${proposed.map(({ v, t }) => `<div class="li">${I('task', 15)}<div><b>${h(v.title || '')}</b><small>${h(personOf(t))}${v.reason ? ' · ' + h(v.reason) : ''}</small></div><span class="badge ${v.status === 'committed' ? 'approved' : 'review'}">${v.status === 'committed' ? 'Created' : 'Proposed'}</span></div>`).join('')}</div>` : ''}
    <div class="sh2">Deliverables</div>
    ${docs.map(t => { const o = t.result.output, rec = outputsOf(t)[0], R = roleOfT(t); return `<article class="deliv" id="doc-${t.id}"><header>${avatar(personOf(t), R.team, 32)}<div><small>${h(kindName(o.kind))} · <code>${tid(r, t)}</code></small><b>${h(o.title || t.title)}</b><span>${h(personOf(t))} · ${h(R.name)} · ${h(AGENTS[t.agent].name)}${t.contract && t.contract.as_of.length ? ' · as of ' + h(t.contract.as_of.join(', ')) : ''}</span></div>${rec ? `<span class="badge ${rec.status === 'Waiting for approval' ? 'signoff' : 'approved'}">${rec.status === 'Waiting for approval' ? 'Awaiting sign-off' : 'Ready'}</span>` : ''}</header><div class="docb">${bodyHTML(o.body)}</div>${t.contract && t.contract.sources.length ? `<footer>${I('link', 12)} ${t.contract.sources.filter(x => !/\./.test(x)).slice(0, 8).map(x => `<code>${h(x)}</code>`).join('')}</footer>` : ''}</article>`; }).join('') || '<p class="muted">No documents yet.</p>'}
    ${stored.length ? `<div class="sh2">Stored for next time</div><div class="list">${stored.map(({ v, t }) => `<div class="li">${I(v.kind === 'memory' ? 'db' : 'layers', 15)}<div><b>${h(v.title || v.id || '')}</b><small>${v.kind === 'memory' ? 'Shared memory' : 'Shared knowledge'} · ${h(personOf(t))}</small></div>${v.id ? `<code>${h(v.id)}</code>` : ''}</div>`).join('')}</div>` : ''}`;
}


/* ---------- the foundation after a run: graph, memory, what was used and what changed ---------- */
const GTYPE = { advisor: ['#0f172a', 'Advisor'], employee: ['#2563eb', 'Colleague'], firm: ['#64748b', 'Firm'], unit: ['#0891b2', 'Business unit'], memory: ['#7c3aed', 'Memory'], finding: ['#059669', 'Finding'], output: ['#e0482f', 'Deliverable'], task: ['#d97706', 'Follow-up'], fund: ['#2f5bea', 'Fund'], episode: ['#9333ea', 'Conversation'], content: ['#b45309', 'Approved content'], pending: ['#f59e0b', 'Pending memory'] };
function runSets(r) {
  const read = new Map(), cited = new Set();
  r.tasks.forEach(t => { (t.packet ? t.packet.items : []).forEach(i => { const e = read.get(i.id) || { item: i, by: [] }; e.by.push(t); read.set(i.id, e); }); ((t.result && t.result.used) || []).forEach(id => cited.add(id)); });
  const changed = F.changes.filter(c => c.run === r.id), fresh = new Set(F.graph.nodes.filter(n => n.run === r.id).map(n => n.id));
  const updated = new Set(changed.filter(c => c.before !== 'Not recorded').map(c => c.id));
  return { read, cited, changed, fresh, updated };
}
function graphSVG(r, S) {
  const centre = r.advisor || (EMPLOYEES[r.requester] ? r.requester : null); if (!centre) return '<p class="muted">No advisor in this request, so there is no relationship graph to show.</p>';
  const G = F.graph, byId = id => G.nodes.find(n => n.id === id);
  const adj = G.edges.filter(e => e.from === centre || e.to === centre).map(e => ({ id: e.from === centre ? e.to : e.from, label: e.label, run: e.run }));
  const pick = new Map(); adj.forEach(a => { const n = byId(a.id); if (n) pick.set(a.id, { n, rel: a.label, edgeRun: a.run }); });
  /* nodes this run created that hang off another node (outputs, findings, follow-ups) */
  G.nodes.filter(n => n.run === r.id && !pick.has(n.id) && n.id !== centre).forEach(n => pick.set(n.id, { n, rel: G.edges.find(e => (e.from === n.id || e.to === n.id) && e.run === r.id)?.label || 'new', edgeRun: r.id }));
  /* foundation items read that are not graph nodes yet: conversations, approved content, funds, findings */
  S.read.forEach((e, id) => { if (pick.has(id) || id === centre || ['policy', 'models'].includes(e.item.layer)) return; const n = byId(id); const type = n ? n.type : /^(CALL|EMAIL|MTG)-/.test(id) ? 'episode' : /^SEIS-/.test(id) ? 'content' : FUNDS[id] ? 'fund' : e.item.layer === 'knowledge' ? 'finding' : e.item.layer === 'memory' ? 'memory' : null; if (type && !['advisor', 'firm'].includes(type)) pick.set(id, { n: { id, label: n ? n.label : e.item.label, type }, rel: 'read', virtual: !n }); });
  F.pending.filter(p => p.run === r.id).forEach(p => pick.set(p.id, { n: { id: p.id, label: p.attr, type: 'pending' }, rel: 'pending', edgeRun: r.id }));
  const order = ['employee', 'firm', 'unit', 'memory', 'pending', 'episode', 'content', 'fund', 'finding', 'task', 'output'];
  const list = [...pick.values()].filter(x => GTYPE[x.n.type]).sort((a, b) => order.indexOf(a.n.type) - order.indexOf(b.n.type)).slice(0, 34);
  const W = 880, H = 480, cx = W / 2, cy = H / 2;
  const inner = list.filter(x => ['employee', 'firm', 'unit', 'memory', 'pending'].includes(x.n.type)), outer = list.filter(x => !inner.includes(x));
  const place = (arr, rx, ry, off) => arr.forEach((x, i) => { const a = off + (i / Math.max(1, arr.length)) * Math.PI * 2; x.x = cx + Math.cos(a) * rx; x.y = cy + Math.sin(a) * ry; x.a = a; });
  place(inner, 150, 118, -Math.PI / 2); place(outer, 268, 196, -Math.PI / 2 + .2);
  const stateOf = x => S.updated.has(x.n.id) ? 'upd' : (S.fresh.has(x.n.id) || x.n.type === 'pending' || x.edgeRun === r.id && x.rel !== 'read') ? 'new' : S.cited.has(x.n.id) ? 'cited' : S.read.has(x.n.id) ? 'read' : 'idle';
  const lab = s2 => String(s2).replace(/,.*$/, '').slice(0, 26) + (String(s2).length > 26 ? '…' : '');
  const C = byId(centre) || { label: centre };
  const sel = ST.gsel;
  const edges = list.map(x => { const st = stateOf(x); return `<line x1="${cx}" y1="${cy}" x2="${x.x.toFixed(1)}" y2="${x.y.toFixed(1)}" class="ge ${st}${sel && sel !== x.n.id ? ' dim' : ''}"/>`; }).join('');
  const nodes = list.map(x => { const st = stateOf(x), [col] = GTYPE[x.n.type], right = Math.cos(x.a) >= 0, rr = ['output', 'finding'].includes(x.n.type) ? 9 : 7.5;
    return `<g class="gn ${st}${sel === x.n.id ? ' sel' : ''}${sel && sel !== x.n.id ? ' dim' : ''}" data-gnode="${h(x.n.id)}" transform="translate(${x.x.toFixed(1)},${x.y.toFixed(1)})"><title>${h(x.n.label)} · ${h(GTYPE[x.n.type][1])} · ${h(x.n.id)}</title>${st === 'new' || st === 'upd' ? `<circle r="${rr + 7}" class="halo"/>` : ''}<circle r="${rr}" fill="${col}" class="dot"/>${st === 'read' || st === 'cited' ? `<circle r="${rr + 3.5}" class="ring"/>` : ''}<text x="${right ? rr + 6 : -(rr + 6)}" y="4" text-anchor="${right ? 'start' : 'end'}">${h(lab(x.n.label))}</text>${st === 'new' || st === 'upd' ? `<text class="tagt" x="${right ? rr + 6 : -(rr + 6)}" y="-9" text-anchor="${right ? 'start' : 'end'}">${st === 'new' ? 'NEW' : 'UPDATED'}</text>` : ''}</g>`; }).join('');
  const centreNode = `<g class="gn centre" transform="translate(${cx},${cy})"><circle r="26" class="halo2"/><circle r="20" fill="#0f172a"/><text y="4" text-anchor="middle" class="ci">${h(initials(C.label))}</text><text y="40" text-anchor="middle" class="cl">${h(String(C.label).replace(/,.*$/, ''))}</text></g>`;
  const types = [...new Set(list.map(x => x.n.type))];
  return `<svg class="kg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${edges}${centreNode}${nodes}</svg>
    <div class="glegend">${types.map(t => `<span><i style="background:${GTYPE[t][0]}"></i>${GTYPE[t][1]}</span>`).join('')}<span class="sep2"></span><span><i class="lg-read"></i>Read</span><span><i class="lg-cited"></i>Cited in output</span><span><i class="lg-new"></i>New</span><span><i class="lg-upd"></i>Updated</span></div>`;
}
function nodeDetail(r, S, id) {
  if (!id) return `<div class="gdet muted">${I('target', 14)} Click a node to see what it holds and which tickets used it.</div>`;
  const m = F.memory.filter(x => x.id === id).slice(-1)[0], k = F.findings.find(x => x.id === id), o = F.outputs.find(x => x.id === id), ep = F.episodes.find(x => x.id === id), c = CONTENT.find(x => x.id === id), pd = F.pending.find(x => x.id === id), gn = F.graph.nodes.find(x => x.id === id);
  const rd = S.read.get(id), ch = S.changed.find(x => x.id === id);
  const title = (m && m.attr) || (k && k.label) || (o && o.title) || (ep && `${ep.kind}, ${ep.date}`) || (c && c.title) || (pd && pd.attr) || (gn && gn.label) || (rd && rd.item.label) || id;
  const value = (m && m.value) || (k && k.value) || (o && o.body) || (ep && ep.text) || (c && `${c.audience} · ${c.format} · ${c.status}`) || (pd && `${pd.value} · ${pd.reason}`) || (rd && rd.item.value) || '';
  return `<div class="gdet"><div class="gdh"><code>${h(id)}</code><b>${h(title)}</b><button type="button" class="x" data-gnode="${h(id)}">${I('x', 13)}</button></div>${value ? `<p>${h(String(value).slice(0, 320))}${String(value).length > 320 ? '…' : ''}</p>` : ''}
    ${ch ? `<div class="chg"><span>Before</span><s>${h(ch.before)}</s><span>After</span><b>${h(ch.after)}</b><small>rev ${ch.rev} · source ${h(ch.src)} · ${h(AGENTS[ch.by] ? AGENTS[ch.by].name : ch.by)}</small></div>` : ''}
    ${rd ? `<small class="usedby">Read by ${rd.by.map(t => `<code>${tid(r, t)}</code> ${h(first(personOf(t)))}`).join(', ')}${S.cited.has(id) ? ' · cited in the output' : ''}</small>` : ''}${m && m.basis ? `<small class="usedby">${h(m.basis)} · ${h(m.src || '')} · scope ${h(m.scope)}</small>` : ''}</div>`;
}
function foundationHTML(r) {
  const S = runSets(r), adv = r.advisor;
  const verdicts = r.tasks.flatMap(t => (t.verdicts || []).map(v => ({ v, t })));
  const written = verdicts.filter(({ v }) => ['published', 'committed', 'pending', 'rejected', 'proposed', 'approval', 'blocked', 'flagged', 'task'].includes(v.status));
  const nNew = S.fresh.size;
  const counts = [['Read', S.read.size], ['Cited', [...S.cited].filter(id => S.read.has(id)).length], ['Reused', r.stats.reused], ['New', nNew], ['Updated', S.updated.size], ['Not stored', verdicts.filter(({ v }) => ['rejected', 'blocked'].includes(v.status)).length]];
  const mem = adv ? F.memory.filter(m => m.adv === adv) : [];
  const tab = ST.ftab || 'memory';
  const memRow = m => { const ch = S.changed.find(c => c.id === m.id && c.rev === m.rev), st = m.status === 'superseded' ? 'old' : ch ? (ch.before === 'Not recorded' ? 'new' : 'upd') : S.cited.has(m.id) ? 'cited' : S.read.has(m.id) ? 'read' : 'idle';
    return `<div class="mr ${st}"><div class="mrh"><b>${h(m.attr)}</b><code>${h(m.id)}</code>${{ new: '<span class="badge approved">New</span>', upd: '<span class="badge review">Updated</span>', old: '<span class="badge blocked">Superseded</span>', cited: '<span class="badge ready">Cited</span>', read: '<span class="badge running">Read</span>', idle: '' }[st]}</div>
      ${ch && ch.before !== 'Not recorded' ? `<div class="chg"><span>Before</span><s>${h(ch.before)}</s><span>After</span><b>${h(ch.after)}</b></div>` : `<p class="${st === 'old' ? 'strike' : ''}">${h(m.value)}</p>`}
      <small>${h(m.basis || '')}${m.src ? ' · ' + h(m.src) : ''} · scope ${h(m.scope)}${m.access && m.access !== 'shared' ? ' · ' + h(m.access.replace('owner:', 'private to ')) : ''}${m.rev > 1 ? ' · rev ' + m.rev : ''}</small></div>`; };
  const memRank = m => m.status === 'superseded' ? 5 : S.changed.some(c => c.id === m.id && c.rev === m.rev) ? 0 : S.cited.has(m.id) ? 1 : S.read.has(m.id) ? 2 : 3;
  const byLayer = {}; S.read.forEach((e, id) => (byLayer[e.item.layer] = byLayer[e.item.layer] || []).push({ id, e }));
  const VW = { published: ['Published to knowledge', 'approved'], committed: ['Committed to memory', 'approved'], pending: ['Pending confirmation', 'review'], rejected: ['Not stored', 'failed'], blocked: ['Blocked', 'failed'], flagged: ['Flagged for a number check', 'review'], proposed: ['Proposed, needs you', 'review'], approval: ['Waiting for approval', 'signoff'], task: ['Kept to this task', 'blocked'] };
  const panes = {
    memory: mem.length ? `<div class="mlist">${mem.slice().sort((a, b) => memRank(a) - memRank(b)).map(memRow).join('')}${F.pending.filter(p => p.adv === adv).map(p => `<div class="mr pend"><div class="mrh"><b>${h(p.attr)}</b><code>${h(p.id)}</code><span class="badge review">Pending</span></div><p>${h(p.value)}</p><small>${h(p.reason)}</small></div>`).join('')}</div>` : '<p class="muted">No advisor memory for this request.</p>',
    used: `<div class="ulist">${Object.entries(byLayer).map(([l, xs]) => `<div class="ul"><div class="ulh"><i style="background:${LAYER_COL[l] || '#64748b'}"></i><b>${h((LAYERS[l] || {}).name || l)}</b><small>${xs.length}</small></div>${xs.map(({ id, e }) => `<div class="ui${S.cited.has(id) ? ' cited' : ''}${reusedIn(e.by[0], e.item) ? ' re' : ''}"><code>${h(id)}</code><div><b>${h(e.item.label)}</b><small>${h(String(e.item.value).slice(0, 110))}${String(e.item.value).length > 110 ? '…' : ''}</small></div><span class="ub">${e.by.map(t => avatar(personOf(t), roleOfT(t).team, 18)).join('')}${S.cited.has(id) ? '<em>cited</em>' : ''}${reusedIn(e.by[0], e.item) ? '<em class="rz2">reused</em>' : ''}</span></div>`).join('')}</div>`).join('') || '<p class="muted">Nothing read yet.</p>'}</div>`,
    written: `<div class="wlist">${written.map(({ v, t }) => { const [lbl, cls] = VW[v.status] || [v.status, 'blocked']; return `<div class="wi"><span class="wk">${I(v.kind === 'memory' ? 'db' : v.kind === 'knowledge' ? 'layers' : v.kind === 'output' ? 'doc' : 'task', 14)}</span><div><b>${h(v.title || v.id || v.kind)}</b><small>${h(v.kind)} · ${h(personOf(t))}, <code>${tid(r, t)}</code>${v.reason ? ' · ' + h(v.reason) : ''}</small></div><span class="badge ${cls}">${h(lbl)}</span>${v.id ? `<code>${h(v.id)}</code>` : ''}</div>`; }).join('') || '<p class="muted">Nothing written yet.</p>'}</div>`
  };
  return `<section class="fhero"><div><small>Shared foundation · ${h(adv ? ADVISORS[adv].name : EMPLOYEES[r.requester].name)}</small><h2>What this request used and changed</h2></div><div class="fcounts">${counts.map(([k, n]) => `<div><b>${n}</b><small>${k}</small></div>`).join('')}</div></section>
    <div class="fgrid"><section class="gcard"><div class="gch"><b>${I('branch', 14)} Knowledge graph</b><small>This request’s neighbourhood: what it read, cited and added</small></div>${graphSVG(r, S)}${nodeDetail(r, S, ST.gsel)}</section>
      <section class="pcard2"><div class="ptabs">${[['memory', 'Memory', mem.length], ['used', 'Used', S.read.size], ['written', 'Written back', written.length]].map(([k, l, n]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-ftab="${k}">${l}<small>${n}</small></button>`).join('')}</div><div class="pbody">${panes[tab]}</div></section></div>`;
}

/* right: the ticket (overlay) */
function paintBench() {
  const r = run(), b = el('bench');
  if (!ST.open) { b.hidden = true; return; }
  b.hidden = false;
  const p = ROSTER.find(x => x.name === ST.open) || { name: ST.open, team: 'sales', role: '', does: '' };
  const ts = r ? r.tasks.filter(t => personOf(t) === p.name) : [];
  const t = ts.find(x => x.id === ST.openTask) || ts[0];
  if (!b._init) { b.innerHTML = `<div class="bh"></div><div class="bbody"></div><div class="bfoot"></div>`; b._init = 1; }
  setHTML(b.querySelector('.bh'), `<div class="crumb">${avatar(p.name, p.team, 22)}<span>${h(p.name)}</span>${I('chevron', 12)}<span>${h(p.role)}</span>${t ? `${I('chevron', 12)}<code>${tid(r, t)}</code>` : ''}<button type="button" class="x" data-close aria-label="Close">${I('x', 16)}</button></div>
    ${ts.length > 1 ? `<div class="btabs">${ts.map(x => `<button type="button" class="${x === t ? 'on' : ''}" data-tab-task="${x.id}"><span class="node sm ${status(r, x)}">${I(ST_ICON[status(r, x)], 10)}</span>${tid(r, x)}</button>`).join('')}</div>` : ''}`);
  const key = p.name + '|' + (t ? t.id : '') + '|' + (r ? r.id : ''); if (b._key !== key) { b._key = key; b.querySelector('.bbody').scrollTop = 0; }
  setHTML(b.querySelector('.bbody'), t ? ticketHTML(r, t, p) : `<div class="emptyp">${avatar(p.name, p.team, 56)}<h3>${h(p.name)}</h3><p>${h(p.role)} · ${h(teamName(p.team))}</p><p class="muted">${h(p.does)}</p><div class="sh">Agents on this workbench</div><div class="chips">${Object.keys(AGENTS).filter(a => roleOf(a) === p.rid).map(a => `<span class="chip">${I('cpu', 11)}${h(AGENTS[a].name)}</span>`).join('')}</div></div>`);
  setHTML(b.querySelector('.bfoot'), t ? footHTML(r, t, p) : '');
}
function bodyHTML(s) {
  const ids = x => h(x).replace(/\b([A-Z]{2,5}-[A-Z0-9]{1,6}(?:-[A-Z0-9]+)?)\b/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let html = '', list = false;
  for (const ln of String(s || '').split('\n')) { const m = ln.match(/^\s*[-•*]\s+(.*)/); if (m) { if (!list) { html += '<ul>'; list = true; } html += `<li>${ids(m[1])}</li>`; } else { if (list) { html += '</ul>'; list = false; } if (ln.trim()) html += (/^#{1,4}\s/.test(ln.trim()) || /:$/.test(ln.trim())) && ln.length < 70 ? `<h4>${ids(ln.replace(/^#+\s*/, ''))}</h4>` : `<p>${ids(ln)}</p>`; } }
  return html + (list ? '</ul>' : '');
}
const VERB = { published: 'Published to shared knowledge', committed: 'Committed to shared memory', pending: 'Proposed for memory', rejected: 'Not stored', blocked: 'Blocked', read: 'Read only', task: 'Kept to this task', proposed: 'Proposed, needs you', flagged: 'Flagged for a number check', approval: 'Needs your approval' };
function ticketHTML(r, t, p) {
  const s = status(r, t), R = roleOfT(t), deps = depsOf(r, t), A = AGENTS[t.agent];
  const Pk = t.packet || (() => { try { return buildPacket(t, r); } catch (e) { return null; } })();
  const byL = {}; (Pk ? Pk.items : []).forEach(i => (byL[i.layer] = byL[i.layer] || []).push(i));
  const reused = Pk ? Pk.items.filter(i => reusedIn(t, i)) : [], total = Pk ? Pk.items.length : 0;
  const out = t.result && t.result.output;
  const tl = [['done', 'inbox', `Assigned by ${HUB}`, `${h(EMPLOYEES[r.requester].name)}’s request · wave ${t.wave}`]];
  if (t.packet) tl.push(['done', 'layers', 'Context attached from the shared foundation', `${t.packet.items.length} items${reused.length ? `, ${reused.length} reused from other teams` : ''}`]);
  (t.calls || []).forEach(c => tl.push([c.error ? 'err' : 'done', 'db', `<span class="sysn" style="--c:${SYS_COL[c.sys] || '#64748b'}">${h(SYS_SHORT[c.sys] || 'Gateway')}</span>${h(callText(c))}`, c.error ? h(c.error) : `${h(gist(c.out))}${c.out && c.out.synthesized ? ' <span class="demo">demo data</span>' : ''}`]));
  if (t.state === 'running') tl.push(['now', 'cpu', !t.packet ? 'Assembling context' : 'Working', '']);
  if (t.result) tl.push(['done', 'sparkles', 'Result produced', h(t.result.says || '')]);
  if (t.verdicts) tl.push(['done', 'shield', 'Gatekeeper checks', t.verdicts.map(v => { const o = v.kind === 'output' && F.outputs.find(y => y.id === v.id), vs = o && o.status === 'Waiting for approval' ? 'approval' : v.status; return `<span class="vd ${vs}">${h(v.kind)} · ${h(VERB[vs] || vs)}${v.id ? ` <code>${h(v.id)}</code>` : ''}</span>`; }).join('')]);
  if (ST.approved.has(t.id)) tl.push(['done', 'arrow', `Reported back; ${HUB} handed it on`, r.tasks.filter(x => x.depends_on.includes(t.id)).map(x => `${tid(r, x)} · ${h(personOf(x))}`).join(', ') || 'Final step']);
  return `<h2 class="ttl">${h(t.title)}</h2>
    <div class="props">${kv('Status', badge2(s))}${kv('Assignee', `${avatar(p.name, p.team, 20)} ${h(p.name)}`)}${kv('Team', `<span class="tdot" style="--c:${TCOL(R.team)}"></span>${h(R.name)} · ${h(teamName(R.team))}`)}${kv('Requested by', `${avatar(EMPLOYEES[r.requester].name, EMPLOYEES[r.requester].team, 20)} ${h(EMPLOYEES[r.requester].name)}`)}${kv('Agent', `<span class="chip strong">${I('cpu', 11)}${h(A.name)}</span>${t.route ? `<code>${h(t.route)}</code>` : ''}`)}${deps.length ? kv('Depends on', deps.map(d => `<span class="dep">${badge2(status(r, d))}<code>${tid(r, d)}</code> ${h(personOf(d))}</span>`).join('')) : ''}</div>
    <div class="blk"><div class="sh">Description</div><p>${h(t.objective)}</p>${t.why ? `<p class="why">${I('branch', 13)} <span><b>Routed to ${h(R.name)}:</b> ${h(t.why)}</span></p>` : ''}</div>
    ${Pk ? `<div class="blk"><div class="sh">Context from the shared foundation <small>${t.packet ? 'attached' : 'preview'}</small></div>
      <div class="lbar">${Object.entries(byL).map(([l, xs]) => `<i style="flex:${xs.length};--c:${LAYER_COL[l] || '#64748b'}" title="${h((LAYERS[l] || {}).name || l)}: ${xs.length}"></i>`).join('')}</div>
      <div class="llg">${Object.entries(byL).map(([l, xs]) => `<span><i style="--c:${LAYER_COL[l] || '#64748b'}"></i>${h((LAYERS[l] || {}).short || l)} ${xs.length}</span>`).join('')}<span class="sum">${total} items${reused.length ? ` · <b>${reused.length} reused</b>` : ''}${Pk.withheld.length ? ` · ${Pk.withheld.length} withheld` : ''}</span></div>
      <div class="items">${Pk.items.filter(i => i.layer !== 'policy').sort((x, y) => reusedIn(t, y) - reusedIn(t, x)).slice(0, 4).map(i => `<div class="it${reusedIn(t, i) ? ' re' : ''}"><i style="--c:${LAYER_COL[i.layer] || '#64748b'}"></i><div><b>${h(i.label)}</b> <code>${h(i.id)}</code>${reusedIn(t, i) ? '<span class="reuse">Reused</span>' : ''}<p>${h(String(i.value).slice(0, 130))}${String(i.value).length > 130 ? '…' : ''}</p><small>${h(i.from || '')}</small></div></div>`).join('')}
      ${Pk.withheld.slice(0, 2).map(w => `<div class="it wh">${I('lock', 13)}<div><b>Withheld</b> <code>${h(w.id)}</code><p>${h(w.why)}</p></div></div>`).join('')}</div></div>` : ''}
    ${s === 'blocked' ? `<div class="callout">${I('clock', 16)}<div>Starts when ${HUB} hands over ${deps.filter(d => !ST.approved.has(d.id)).map(d => `<code>${tid(r, d)}</code> (${h(personOf(d))})`).join(', ')}.</div></div>` : ''}
    <div class="blk"><div class="sh">Activity</div><ol class="act">${tl.map(([st, ic, a, b2]) => `<li class="${st}"><span class="an2">${st === 'now' ? '<span class="spin"></span>' : I(ic, 13)}</span><div><b>${a}</b>${b2 ? `<small>${b2}</small>` : ''}</div></li>`).join('')}</ol></div>
    ${out && out.body ? `<div class="blk"><div class="sh">Result</div><article class="deliv in"><header><div><small>${h(kindName(out.kind))}</small><b>${h(out.title || '')}</b>${t.contract && t.contract.as_of.length ? `<span>As of ${h(t.contract.as_of.join(', '))}</span>` : ''}</div></header><div class="docb">${bodyHTML(out.body)}</div></article></div>` : ''}
    ${s === 'failed' ? `<div class="callout bad">${I('alert', 16)}<div>${h(t.error || 'Failed')}</div></div>` : ''}`;
}
function footHTML(r, t, p) {
  const s = status(r, t), w = waitingOutput(t);
  if (s === 'ready') return `<span>Runs here; watch it live on the canvas</span><button type="button" class="btn primary" data-run="${t.id}">${I('play', 13)} Run agents</button>`;
  if (s === 'running') return `<span class="busy"><span class="spin"></span> Agents working…</span>`;
  if (s === 'review') return `<span>${w ? '<b>Client-facing.</b> Approving signs it off.' : `Approving reports back to ${HUB}, which hands it on.`}</span><button type="button" class="btn subtle" data-back="${t.id}">${I('undo', 13)} Request changes</button><button type="button" class="btn primary" data-approve="${t.id}">${I('check', 13)} Approve and hand off</button>`;
  if (s === 'signoff') return `<span>“${h(w.title)}” waits for your sign-off.</span><button type="button" class="btn primary" data-signoff="${h(w.id)}">${I('check', 13)} Approve</button>`;
  if (s === 'approved') return `<span class="okt">${I('check', 14)} Done and handed off</span>`;
  if (s === 'blocked') return `<span class="busy">${I('clock', 14)} Waiting on an upstream ticket</span>`;
  return '';
}

/* ---------- the pipeline's own signals, shown on the canvas ---------- */
const taskById = id => run() && run().tasks.find(t => t.id === id);
HX.op = o => {
  const t = o.task && taskById(o.task), pid = t ? 't:' + t.id : null;
  if (o.kind === 'call' && o.sys) { ST.flash['s:' + o.sys] = performance.now(); if (pid) { const c = (t.calls || []).slice(-1)[0]; travel(pid, 'sys:' + o.sys, SYS_SHORT[o.sys], 'call', SYS_COL[o.sys]); void c; } }
  if (o.kind === 'read' && pid && o.layer) setTimeout(() => travel('found', pid, (LAYERS[o.layer] || {}).short || o.layer, 'read', LAYER_COL[o.layer]), 120 * (o.lane + 2 || 0));
  if (o.kind === 'write' && pid && o.layer) setTimeout(() => travel(pid, 'found', (LAYERS[o.layer] || {}).short || o.layer, 'write', LAYER_COL[o.layer]), 150 * (o.lane + 2 || 0));
  HX.schedule(); setTimeout(HX.schedule, 1500);
};
HX.flash = (l, cls) => { ST.flash['l:' + l] = { at: performance.now(), cls }; HX.schedule(); setTimeout(HX.schedule, 1500); };

/* ---------- events ---------- */
let tt; HX.toast = m => { const t = el('toast'); t.innerHTML = `${I('check', 14)}<span>${h(m)}</span>`; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3400); };
HX.ai = () => paintTop();
document.addEventListener('click', e => {
  const q = s => e.target.closest(s); let x;
  if (q('[data-menu]')) { ST.menu = !ST.menu; paintTop(); return; }
  if (ST.menu && !q('.menu')) { ST.menu = false; paintTop(); }
  if ((x = q('[data-me]'))) { if (!busyPlanning() && !anyRunning()) { ME = x.dataset.me; UI.requester = ME; UI.run = null; ST.open = null; ST.nokey = null; ST.msgs = []; } ST.menu = false; paintAll(); return; }
  if ((x = q('[data-ask]'))) { ask(x.dataset.ask); return; }
  if ((x = q('[data-answer]'))) { answer(x.dataset.answer); return; }
  if (q('[data-answer-input]')) { answer(q('.qcard').querySelector('.clarIn').value.trim()); return; }
  if (q('[data-runall]')) { ST.open = null; runAll(); return; }
  if (q('[data-stop]')) { ST.auto = false; paintAll(); return; }
  if ((x = q('[data-view]'))) { ST.view = x.dataset.view; if (ST.view !== 'floor') ST.open = null; paintAll(); return; }
  if ((x = q('[data-gnode]'))) { ST.gsel = ST.gsel === x.dataset.gnode ? null : x.dataset.gnode; paintAll(); return; }
  if ((x = q('[data-ftab]'))) { ST.ftab = x.dataset.ftab; paintAll(); return; }
  if ((x = q('[data-signoff]'))) { signOff(F.outputs.find(o => o.id === x.dataset.signoff)); paintAll(); return; }
  if ((x = q('[data-task]'))) { const t = run().tasks.find(y => y.id === x.dataset.task); ST.open = personOf(t); ST.openTask = t.id; paintAll(); return; }
  if ((x = q('.nd.wb'))) { const t = run().tasks.find(y => y.id === x.dataset.task2); if (t) { ST.open = personOf(t); ST.openTask = t.id; paintAll(); } return; }
  if ((x = q('.rp'))) { ST.open = x.dataset.person; const t = run() && run().tasks.find(y => personOf(y) === ST.open); ST.openTask = t ? t.id : null; paintAll(); return; }
  if ((x = q('[data-tab-task]'))) { ST.openTask = x.dataset.tabTask; paintAll(); return; }
  if (q('[data-close]')) { ST.open = null; ST.openTask = null; paintAll(); return; }
  if ((x = q('[data-run]'))) { const t = run().tasks.find(y => y.id === x.dataset.run); ST.open = null; ST.view = 'floor'; startTask(t); return; }
  if ((x = q('[data-approve]'))) { approve(run().tasks.find(y => y.id === x.dataset.approve)); return; }
  if ((x = q('[data-back]'))) { sendBack(run().tasks.find(y => y.id === x.dataset.back)); return; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (ST.menu) ST.menu = false; else if (ST.open) ST.open = null; paintAll(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); el('ask').focus(); }
  if (e.target.classList && e.target.classList.contains('clarIn') && e.key === 'Enter') answer(e.target.value.trim());
});
el('composer').onsubmit = e => { e.preventDefault(); const v = el('ask').value; el('ask').value = ''; ask(v); };
el('newChat').onclick = () => { if (busyPlanning() || anyRunning()) return; UI.run = null; ST.open = null; ST.nokey = null; ST.auto = false; ST.msgs = []; F.session.advisor = null; paintAll(); };

UI.requester = ME; paintAll();
initAI().then(paintAll);
window.HARNESS = { ask, answer, startTask, approve, runAll, ST, status };
})();
