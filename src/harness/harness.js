/* ===== Agent Harness: the orchestration floor =====
   A request goes through the real pipeline (pipeline.js over engine.js): the
   orchestrator plans it from the shared foundation (live AI, or a saved AI run
   replayed), and every step becomes a ticket on a person's workbench. A person
   opens their ticket, runs their agents, reviews what came back and approves
   it, which hands the work to the next team. Nothing here is scripted; this
   file only stages what the pipeline does so a business leader can follow it. */

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
const el = id => document.getElementById(id);
const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const QS = new URLSearchParams(location.search);
if (QS.has('fast')) SLEEP_SCALE = 0.05;
UI.readPause = 0;

/* ---------- design tokens used from script ---------- */
const TEAM = { sales: '#2563eb', product: '#059669', marketing: '#d97706', service: '#7c3aed' };
const TCOL = t => TEAM[t] || '#64748b';
const LAYER_COL = { memory: '#7c3aed', knowledge: '#059669', policy: '#dc2626', models: '#2563eb', feedback: '#b45309', events: '#d97706', graph: '#0891b2' };
const SYS_COL = { sf: '#0b84d8', m365: '#2f5bea', seismic: '#e0482f', fund: '#059669', mstar: '#b91c1c', gen: '#ea580c', mcloud: '#0284c7', aem: '#9333ea', news: '#b45309', exp: '#475569' };
const DRAFTING = { start: 'Reading the request', requester: 'Checking who is asking', entity: 'Resolving the advisor in the graph', intent: 'Classifying the business intent', asks: 'Splitting the request into asks', interpretation: 'Writing the interpretation', missing: 'Checking what the foundation already answers', memory: 'Applying memory rules', reuse: 'Looking for reusable work', controls: 'Setting controls', success: 'Defining done', task: 'Routing tickets to teams', clarify: 'Drafting a question', next: 'Planning' };

/* ---------- icons (stroke, 24px grid) ---------- */
const P = {
  play: 'M7 5l12 7-12 7z', check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z', alert: 'M12 8v5M12 16.5v.5M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  cal: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 10h16M9 3v4M15 3v4', mail: 'M4 6h16v12H4zM4 7l8 6 8-6', doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  task: 'M9 11l2.5 2.5L16 9M5 4h14v16H5z', note: 'M5 4h14v12l-4 4H5zM15 16v4M9 9h6M9 13h4', tool: 'M14.5 6.5a4 4 0 01-5 5L4 17l3 3 5.5-5.5a4 4 0 005-5l-2.5 2.5-2.5-.5-.5-2.5z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', db: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', branch: 'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9',
  arrow: 'M5 12h14M13 6l6 6-6 6', chevron: 'M9 6l6 6-6 6', pause: 'M8 5v14M16 5v14', inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3', users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c0-3.5 3-6 7-6s7 2.5 7 6M16 3.5a4 4 0 010 7.5M18 14.5c2.4.8 4 2.9 4 6.5',
  sparkles: 'M9 4l1.4 4.1L14.5 9.5l-4.1 1.4L9 15l-1.4-4.1L3.5 9.5l4.1-1.4zM17 13l.8 2.2 2.2.8-2.2.8L17 19l-.8-2.2L14 16l2.2-.8z',
  cpu: 'M8 8h8v8H8zM5 5h14v14H5zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3', link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z', target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01'
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
const ST = { approved: new Set(), open: null, openTask: null, auto: false, ops: [], flash: {}, menu: false, shownPlan: null, view: 'floor' };
const run = () => UI.run;
const tid = (r, t) => `CCE-${1000 + parseInt(String(r.id).replace(/\D/g, '') || '0', 10) * 10 + (t.step || 0)}`;
const personOf = t => t.person || (ROLES[t.role] || {}).person || meName();
const roleOfT = t => ROLES[t.role] || { name: AGENTS[t.agent].name, team: AGENTS[t.agent].team };
const depsOf = (r, t) => t.depends_on.map(d => r.tasks.find(x => x.id === d)).filter(Boolean);
const outputsOf = t => (t.verdicts || []).filter(v => v.kind === 'output').map(v => F.outputs.find(o => o.id === v.id)).filter(Boolean);
const waitingOutput = t => outputsOf(t).find(o => o.status === 'Waiting for approval');
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

/* ---------- requests ---------- */
const recordedFor = who => RECORDED.filter(r => r.requester === who || (EMPLOYEES[r.requester] && EMPLOYEES[r.requester].team === EMPLOYEES[who].team));
const suggestions = () => AI.mode === 'live' ? (SUGGESTIONS[EMPLOYEES[ME].team] || []).slice(0, 5) : [...new Set(recordedFor(ME).map(r => r.text))].slice(0, 6);
function ask(text, clarified) {
  text = String(text || '').trim(); if (!text) return;
  if (busyPlanning() || anyRunning()) { toast('Still working on the current request.'); return; }
  const rec = RECORDED.find(r => r.text === text && r.requester === ME) || RECORDED.find(r => r.text === text);
  if (AI.mode !== 'live' && !rec) { ST.nokey = text; UI.run = null; paintAll(); return; }
  Object.assign(ST, { nokey: null, approved: new Set(), open: null, openTask: null, auto: false, shownPlan: null, view: 'floor' });
  if (rec && AI.mode !== 'live' && rec.requester !== ME) ME = rec.requester;
  UI.requester = ME; UI.run = null;
  runRequest(text, AI.mode === 'live' ? null : rec, Object.assign({ planOnly: true }, clarified ? { clarified } : {}));
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
  paintAll();
  try { await runTask(r, t); } catch (e) { t.state = 'failed'; t.error = errText(e); }
  paintAll();
}
function signOff(o, by) { if (o && o.status === 'Waiting for approval') { o.status = 'Approved by ' + (by || meName()); logEvent('approval.granted', o.title, ME, o.adv); flashTile('policy', 'write'); } }
/* hand a finished ticket to the next team; signOutputs also approves its client-facing drafts */
function approve(t, signOutputs = true) {
  const r = run(); if (!r || t.state !== 'done' || ST.approved.has(t.id)) return;
  ST.approved.add(t.id);
  if (signOutputs) outputsOf(t).forEach(o => signOff(o, meName()));
  logEvent('ticket.approved', `${tid(r, t)} ${t.title}`, ME, r.advisor);
  r.tasks.filter(x => x.depends_on.includes(t.id)).forEach((x, k) => setTimeout(() => fly(cardOf(personOf(t)), cardOf(personOf(x)), tid(r, x), roleOfT(x).team, 'handoff'), k * 220));
  if (r.tasks.every(x => ST.approved.has(x.id))) { finishRun(r); ST.view = 'results'; ST.open = null; toast(r.tasks.some(waitingOutput) ? 'Complete. Client-facing items are waiting for your sign-off.' : 'Complete.'); }
  paintAll();
}
function sendBack(t) { if (t.state !== 'done') return; ['result', 'verdicts', 'calls', 'packet', 'contract', 'toolResults', 'error'].forEach(k => delete t[k]); t.state = 'queued'; paintAll(); }
/* run every ticket in dependency order; internal work hands off automatically, client-facing drafts wait for sign-off */
async function runAll() {
  const r = run(); if (!r || !r.tasks.length || ST.auto) return;
  ST.auto = true; ST.open = null; ST.view = 'floor'; paintAll();
  while (ST.auto && run() === r && !r.tasks.every(t => ST.approved.has(t.id))) {
    const ready = r.tasks.filter(t => status(r, t) === 'ready');
    if (ready.length) { await Promise.all(ready.map(startTask)); await sleep(500); ready.filter(t => t.state === 'done').forEach(t => approve(t, false)); continue; }
    const rev = r.tasks.filter(t => status(r, t) === 'review');
    if (rev.length) { rev.forEach(t => approve(t, false)); continue; }
    break;
  }
  ST.auto = false; paintAll();
}

/* ---------- flying tickets ---------- */
const cardOf = name => document.querySelector(`.pc[data-person="${CSS.escape(name)}"]`);
function fly(from, to, label, team, kind = 'assign') {
  if (!from || !to) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), f = document.createElement('div');
  f.className = 'tk ' + kind; f.style.setProperty('--c', TCOL(team)); f.innerHTML = `${I(kind === 'handoff' ? 'arrow' : 'inbox', 12)}${h(label)}`;
  f.style.left = a.left + a.width / 2 + 'px'; f.style.top = a.top + a.height / 2 + 'px';
  el('fly').appendChild(f);
  requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${b.left + 46 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px)`; f.style.opacity = '0'; }));
  setTimeout(() => { f.remove(); to.classList.remove('landed'); void to.offsetWidth; to.classList.add('landed'); }, 900 * Math.max(SLEEP_SCALE, 0.3));
}
function flyAssignments(r) {
  if (ST.shownPlan === r.id || !r.tasks.length || !['planned', 'running'].includes(r.status)) return;
  ST.shownPlan = r.id;
  r.tasks.forEach((t, k) => setTimeout(() => fly(document.querySelector('.orch .omark') || el('orch'), cardOf(personOf(t)), tid(r, t), roleOfT(t).team), 250 + k * 260 * Math.max(SLEEP_SCALE, 0.3)));
}

/* ---------- painting ---------- */
function setHTML(node, html) { if (node && node._h !== html) { node.innerHTML = html; node._h = html; } }
let raf = 0;
HX.schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintAll(); }); };
function paintAll() { paintTop(); paintOrch(); paintFloor(); paintBench(); paintFound(); const r = run(); if (r) flyAssignments(r); }

function paintTop() {
  const E = EMPLOYEES[ME];
  setHTML(el('asker'), `<button type="button" class="askbtn" data-menu title="Asking as ${h(E.name)}">${avatar(E.name, E.team, 24)}<span>${h(E.name.split(' ')[0])}</span>${I('chevron', 12, 'rot')}</button>${ST.menu ? `<div class="menu"><div class="mh">Ask as</div>${Object.entries(EMPLOYEES).map(([id, e]) => `<button type="button" data-me="${id}" class="${id === ME ? 'on' : ''}">${avatar(e.name, e.team, 28)}<span><b>${h(e.name)}</b><small>${h(e.role.split(',')[0])} · ${h(teamName(e.team))}</small></span>${id === ME ? I('check', 14) : ''}</button>`).join('')}</div>` : ''}`);
  el('send').disabled = busyPlanning() || anyRunning();
  const m = el('modeTag'); m.className = 'env ' + (AI.mode === 'live' ? 'live' : AI.mode === 'checking' ? '' : 'replay');
  m.innerHTML = `<i></i>${AI.mode === 'live' ? `Live · ${h(AI.provider || 'AI')}` : AI.mode === 'checking' ? 'Connecting' : 'Replay · saved AI runs'}`;
}

/* left: the orchestrator */
const kv = (k, v) => v ? `<div class="kvr"><span>${h(k)}</span><span>${v}</span></div>` : '';
function paintOrch() {
  const r = run();
  if (!r) {
    setHTML(el('orch'), `<div class="ohead"><span class="omark">${I('branch', 16)}</span><div><b>Orchestrator</b><small>Intelligence and orchestration</small></div></div>
      <div class="intro"><h2>What outcome do you need?</h2><p>The orchestrator checks the shared foundation, plans the work and routes a ticket to every team that owns a piece of it.</p>
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
  else if (r.status === 'done') stat = `<div class="scard ok"><div class="srow">${I('check', 16)}<b>Complete</b></div><small>${r.tasks.length} tickets · ${teams} team${teams > 1 ? 's' : ''} · ${Math.max(1, Math.round(((r.t1 || Date.now()) - r.t0) / 1000))} s${r.tasks.some(waitingOutput) ? ' · sign-off pending' : ''}</small><button type="button" class="btn primary block" data-view="results">View results ${I('arrow', 14)}</button></div>`;
  else if (r.tasks.length) stat = `<div class="scard plan"><div class="srow"><b>${r.status === 'planned' ? 'Plan ready' : ST.auto ? 'Running all agents' : 'In progress'}</b>${ST.auto ? '<span class="spin"></span>' : ''}</div>
      <div class="kpis"><div><b>${r.tasks.length}</b><small>tickets</small></div><div><b>${teams}</b><small>team${teams > 1 ? 's' : ''}</small></div><div><b>${waves.length}</b><small>wave${waves.length > 1 ? 's' : ''}</small></div><div><b>${done}/${r.tasks.length}</b><small>done</small></div></div>
      <div class="prog"><i style="width:${done / r.tasks.length * 100}%"></i></div>
      ${ST.auto ? `<button type="button" class="btn subtle block" data-stop>${I('pause', 14)} Pause</button>` : ready ? `<button type="button" class="btn primary block lg" data-runall>${I('play', 14)} Run all agents</button><small class="note">Teams hand off automatically. Client-facing drafts wait for your sign-off.</small>` : ''}</div>`;
  setHTML(el('orch'), `<div class="ohead"><span class="omark${thinking ? ' pulse' : ''}">${I('branch', 16)}</span><div><b>Orchestrator</b><small>${r.replay ? 'Replaying a saved AI run' : 'Live AI'}</small></div></div>
    <div class="reqq">${avatar(EMPLOYEES[r.requester].name, EMPLOYEES[r.requester].team, 26)}<div><small>${h(EMPLOYEES[r.requester].name)}</small><p>${h(r.text.replace(/ \(clarification:.*\)$/, ''))}</p></div></div>
    ${stat}
    ${r.status === 'clarify' ? clarifyHTML(r) : ''}
    ${thinking && live.length ? `<div class="sh">Reasoning</div><div class="reason">${live.map(d => `<div class="rz"><span class="tag ${d.src === 'code' ? 'rule' : 'ai'}">${d.src === 'code' ? 'Rule' : 'AI'}</span><span>${h(d.title)}</span></div>`).join('')}</div>` : ''}
    ${r.tasks.length && r.status !== 'clarify' ? `<div class="sh">Tickets</div><div class="tl">${waves.map(w => `<div class="wv">Wave ${w}${r.tasks.filter(t => t.wave === w).length > 1 ? ' · parallel' : ''}</div>${r.tasks.filter(t => t.wave === w).map(t => { const s = status(r, t), R = roleOfT(t); return `<button type="button" class="tr ${s}${ST.openTask === t.id ? ' sel' : ''}" data-task="${t.id}"><span class="node ${s}">${s === 'running' ? '<span class="spin"></span>' : I(ST_ICON[s], 12)}</span><span class="trb"><b>${h(t.title)}</b><small><code>${tid(r, t)}</code> · ${h(R.name)} · ${h(personOf(t))}</small></span></button>`; }).join('')}`).join('')}</div>` : ''}
    ${assumed.length || known.length ? `<div class="sh">Answered by the foundation</div><div class="ans">${known.slice(0, 2).concat(assumed).slice(0, 4).map(d => `<div class="an">${I('check', 14)}<div><b>${h(d.title)}</b><small>${h(d.detail || '')}</small></div></div>`).join('')}</div>` : ''}
    ${In ? `<div class="sh">Interpretation</div><div class="kvs">${kv('Intent', In.intent ? `<span class="tag">${h(In.intent)}</span>` : '')}${kv('Subject', h(In.subject && In.subject.label))}${kv('Output', h(In.output))}${kv('Time', h(In.time))}${kv('Authority', r.authority ? `${I('lock', 12)} ${h(AUTHORITY[r.authority].label)}` : '')}</div>` : ''}
    <div class="sh">Grounding</div><div class="kvs">${kv('Graph', h(lookup ? lookup.detail || lookup.title : '…'))}${C.memories != null ? kv('Context', `${C.memories} memories · ${C.content} approved pieces · ${C.funds} funds · ${C.routes} routes`) : ''}</div>
    ${r.status === 'done' ? `<div class="sh">Foundation impact</div><div class="kvs">${kv('Items read', String(r.stats.reads))}${kv('Reused', String(r.stats.reused))}${kv('System calls', String(r.stats.calls))}${kv('Stored back', String(r.stats.committed))}</div>` : ''}`);
}
function clarifyHTML(r) {
  const opts = (r.clarifyOptions || []).length ? r.clarifyOptions : (r.resolution && r.resolution.candidates || []).slice(0, 3).map(c => c.name);
  return `<div class="qcard"><b>${h(r.clarify)}</b>${r.clarifyWhy ? `<p>${h(r.clarifyWhy)}</p>` : ''}${opts.map((o, k) => `<button type="button" class="opt" data-answer="${h(o)}"><kbd>${k + 1}</kbd>${h(o)}</button>`).join('')}<div class="other"><input class="clarIn" placeholder="Type an answer…"><button type="button" class="btn subtle sm" data-answer-input>Answer</button></div><button type="button" class="link" data-answer="Make your best assumption and continue">Proceed with a stated assumption</button></div>`;
}

/* middle: team floor and results */
function paintFloor() {
  const r = run(), box = el('floor');
  if (!box._init) {
    box.innerHTML = `<div class="fh"><div class="seg" id="vtabs"></div><span id="fsub" class="fsub"></span><span id="fcta"></span></div><div class="results" id="results"></div><div class="floorbody" id="floorbody">` +
      TEAM_ORDER.map(tm => `<section class="team" data-team="${tm}" style="--c:${TCOL(tm)}"><header><i></i><b>${h(TEAMS[tm].name)}</b><small class="tc"></small></header><div class="grid">${ROSTER.filter(p => p.team === tm).map(p => `<button type="button" class="pc idle" data-person="${h(p.name)}" style="--c:${TCOL(tm)}"></button>`).join('')}</div></section>`).join('') + '</div>';
    box._init = 1;
  }
  const hasRes = r && r.tasks.some(t => t.result);
  if (!hasRes && ST.view === 'results') ST.view = 'floor';
  setHTML(el('vtabs'), `<button type="button" class="${ST.view === 'floor' ? 'on' : ''}" data-view="floor">${I('users', 14)} Team floor</button><button type="button" class="${ST.view === 'results' ? 'on' : ''}" data-view="results" ${hasRes ? '' : 'disabled'}>${I('doc', 14)} Results${r && r.status === 'done' ? '<i class="dotok"></i>' : ''}</button>`);
  el('fsub').textContent = !r ? 'Everyone who can take a ticket' : r.tasks.length ? `${r.tasks.length} ticket${r.tasks.length > 1 ? 's' : ''} routed by the orchestrator` : r.status === 'thinking' ? 'Waiting for the plan' : '';
  setHTML(el('fcta'), r && r.tasks.length && ['planned', 'running'].includes(r.status) && !ST.auto && r.tasks.some(t => status(r, t) === 'ready') ? `<button type="button" class="btn primary" data-runall>${I('play', 13)} Run all agents</button>` : '');
  el('results').hidden = ST.view !== 'results'; el('floorbody').hidden = ST.view === 'results';
  if (ST.view === 'results' && r) setHTML(el('results'), resultsHTML(r));
  box.querySelectorAll('.team').forEach(sec => { const n = r ? r.tasks.filter(t => roleOfT(t).team === sec.dataset.team).length : 0; sec.querySelector('.tc').textContent = n ? `${n} ticket${n > 1 ? 's' : ''}` : ''; sec.classList.toggle('active', !!n); });
  box.querySelectorAll('.pc').forEach(c => {
    const p = ROSTER.find(x => x.name === c.dataset.person), ts = r ? r.tasks.filter(t => personOf(t) === p.name) : [];
    const ss = ts.map(t => status(r, t)), s = !ts.length ? 'idle' : ['running', 'review', 'signoff', 'ready', 'failed', 'blocked', 'approved'].find(x => ss.includes(x));
    const cur = ts.find(t => status(r, t) === s) || ts[0], doneN = ts.filter(t => ST.approved.has(t.id)).length;
    c.className = `pc ${s}${ST.open === p.name ? ' sel' : ''}${c.classList.contains('landed') ? ' landed' : ''}`;
    setHTML(c, `<div class="pct">${avatar(p.name, p.team, 38, s)}<div class="pcn"><b>${h(p.name)}${p.name === meName() ? '<em>You</em>' : ''}</b><small>${h(p.role)}</small></div>${ts.length ? badge2(s) : ''}</div>
      ${cur ? `<div class="pcb"><span class="pti"><code>${tid(r, cur)}</code>${h(cur.title)}</span><span class="pag">${[...new Set(ts.map(t => t.route || AGENTS[t.agent].name))].slice(0, 2).map(a => `<em>${I('cpu', 11)}${h(a)}</em>`).join('')}${ts.length > 1 ? `<em class="more">${doneN}/${ts.length} done</em>` : ''}</span></div><div class="pbar ${s}"><i style="width:${s === 'approved' ? 100 : s === 'signoff' || s === 'review' ? 85 : s === 'running' ? 50 : 6}%"></i></div>` : ''}`);
  });
}

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
const kindName = k => ({ brief: 'Brief', note: 'Note', email: 'Email draft', comparison: 'Comparison', one_pager: 'One-pager', agenda: 'Agenda', finding: 'Finding', content_pick: 'Content selection', case_note: 'Case note', post: 'Post', answer: 'Answer' }[k] || String(k || 'Output').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()));
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
  return `<section class="hero"><div class="hl"><span class="st ${doneAll ? 'ok' : ''}">${I(doneAll ? 'check' : 'clock', 13)}${doneAll ? 'Complete' : 'In progress'}</span><h1>${h(r.text.replace(/ \(clarification:.*\)$/, ''))}</h1><p>Requested by ${h(E.name)} · ${r.tasks.length} tickets across ${teams.size} team${teams.size > 1 ? 's' : ''} · ${secs} s</p></div>
      <div class="metrics"><div><b>${S.reads}</b><small>Foundation items read</small></div><div><b>${S.reused}</b><small>Reused from other teams</small></div><div><b>${S.calls}</b><small>System calls</small></div><div><b>${S.committed}</b><small>Stored back</small></div></div></section>
    ${waiting.length ? `<section class="signbox"><header>${I('alert', 16)}<div><b>Awaiting your sign-off</b><small>Client-facing. Nothing is sent until you approve.</small></div></header>${waiting.map(({ o, t }) => `<div class="sr">${avatar(personOf(t), roleOfT(t).team, 28)}<div><b>${h(o.title)}</b><small>${h(kindName(o.kind))} · ${h(personOf(t))}, ${h(roleOfT(t).name)}</small></div><a class="btn subtle sm" href="#doc-${t.id}">${I('eye', 13)} Review</a><button type="button" class="btn primary sm" data-signoff="${h(o.id)}">${I('check', 13)} Approve</button></div>`).join('')}</section>` : ''}
    <div class="sh2">Outcomes</div><div class="ots">${tiles.join('') || '<p class="muted">Nothing finished yet.</p>'}</div>
    ${proposed.length ? `<div class="sh2">Follow-ups</div><div class="list">${proposed.map(({ v, t }) => `<div class="li">${I('task', 15)}<div><b>${h(v.title || '')}</b><small>${h(personOf(t))}${v.reason ? ' · ' + h(v.reason) : ''}</small></div><span class="badge ${v.status === 'committed' ? 'approved' : 'review'}">${v.status === 'committed' ? 'Created' : 'Proposed'}</span></div>`).join('')}</div>` : ''}
    <div class="sh2">Deliverables</div>
    ${docs.map(t => { const o = t.result.output, rec = outputsOf(t)[0], R = roleOfT(t); return `<article class="deliv" id="doc-${t.id}"><header>${avatar(personOf(t), R.team, 32)}<div><small>${h(kindName(o.kind))} · <code>${tid(r, t)}</code></small><b>${h(o.title || t.title)}</b><span>${h(personOf(t))} · ${h(R.name)} · ${h(AGENTS[t.agent].name)}${t.contract && t.contract.as_of.length ? ' · as of ' + h(t.contract.as_of.join(', ')) : ''}</span></div>${rec ? `<span class="badge ${rec.status === 'Waiting for approval' ? 'signoff' : 'approved'}">${rec.status === 'Waiting for approval' ? 'Awaiting sign-off' : 'Ready'}</span>` : ''}</header><div class="docb">${bodyHTML(o.body)}</div>${t.contract && t.contract.sources.length ? `<footer>${I('link', 12)} ${t.contract.sources.slice(0, 8).map(x => `<code>${h(x)}</code>`).join('')}</footer>` : ''}</article>`; }).join('') || '<p class="muted">No documents yet.</p>'}
    ${stored.length ? `<div class="sh2">Stored for next time</div><div class="list">${stored.map(({ v, t }) => `<div class="li">${I(v.kind === 'memory' ? 'db' : 'layers', 15)}<div><b>${h(v.title || v.id || '')}</b><small>${v.kind === 'memory' ? 'Shared memory' : 'Shared knowledge'} · ${h(personOf(t))}</small></div>${v.id ? `<code>${h(v.id)}</code>` : ''}</div>`).join('')}</div>` : ''}`;
}

/* right: the ticket */
function paintBench() {
  const r = run(), b = el('bench');
  if (!ST.open) { b.hidden = true; document.body.classList.remove('benched'); return; }
  b.hidden = false; document.body.classList.add('benched');
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
const gist = out => { if (out == null) return ''; if (typeof out !== 'object') return String(out).slice(0, 60); if (Array.isArray(out)) return `${out.length} record${out.length === 1 ? '' : 's'}`; const a = Object.entries(out).find(([, x]) => Array.isArray(x) && x.length); return a ? `${a[1].length} ${a[0].replace(/_/g, ' ')}` : `${Object.keys(out).length} fields`; };
const argText = i => Object.entries(i || {}).filter(([, x]) => x !== '' && x != null).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(', ') : String(x)}`.slice(0, 34)).join(', ');
const reusedIn = (t, i) => { const rec = F.memory.find(m => m.id === i.id) || F.findings.find(k => k.id === i.id); return !!(rec && (rec.origin || rec.by) && (rec.origin || rec.by) !== t.agent); };
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
  const timeline = [];
  timeline.push(['done', 'inbox', 'Assigned by the orchestrator', `${h(EMPLOYEES[r.requester].name)}’s request · wave ${t.wave}`]);
  if (t.packet) timeline.push(['done', 'layers', 'Context attached from the shared foundation', `${t.packet.items.length} items${reused.length ? `, ${reused.length} reused from other teams` : ''}`]);
  (t.calls || []).forEach(c => timeline.push([c.error ? 'err' : 'done', 'db', `<span class="sysn" style="--c:${SYS_COL[c.sys] || '#64748b'}">${h((SYSTEMS[c.sys] || {}).name || c.sys || 'Gateway')}</span><code>${h(c.name)}</code>`, c.error ? h(c.error) : `${h(argText(c.input))}${argText(c.input) ? ' → ' : ''}${h(gist(c.out))}${c.out && c.out.synthesized ? ' <span class="demo">demo data</span>' : ''} · ${h(c.via || '')}`]));
  if (t.state === 'running') timeline.push(['now', 'cpu', !t.packet ? 'Assembling context' : t.calls && t.calls.length ? 'Drafting from context and results' : 'Calling systems only for what the foundation lacks', '']);
  if (t.result) timeline.push(['done', 'sparkles', 'Result produced', h(t.result.says || '')]);
  if (t.verdicts) timeline.push(['done', 'shield', 'Gatekeeper checks', t.verdicts.map(v => { const o = v.kind === 'output' && F.outputs.find(y => y.id === v.id), vs = o && o.status === 'Waiting for approval' ? 'approval' : v.status; return `<span class="vd ${vs}">${h(v.kind)} · ${h(VERB[vs] || vs)}${v.id ? ` <code>${h(v.id)}</code>` : ''}</span>`; }).join('')]);
  if (ST.approved.has(t.id)) timeline.push(['done', 'arrow', 'Handed off', r.tasks.filter(x => x.depends_on.includes(t.id)).map(x => `${tid(r, x)} · ${h(personOf(x))}`).join(', ') || 'Final step']);
  return `<h2 class="ttl">${h(t.title)}</h2>
    <div class="props">
      ${kv('Status', badge2(s))}
      ${kv('Assignee', `${avatar(p.name, p.team, 20)} ${h(p.name)}`)}
      ${kv('Team', `<span class="tdot" style="--c:${TCOL(R.team)}"></span>${h(R.name)} · ${h(teamName(R.team))}`)}
      ${kv('Requested by', `${avatar(EMPLOYEES[r.requester].name, EMPLOYEES[r.requester].team, 20)} ${h(EMPLOYEES[r.requester].name)}`)}
      ${kv('Agent', `<span class="chip strong">${I('cpu', 11)}${h(A.name)}</span>${t.route ? `<code>${h(t.route)}</code>` : ''}`)}
      ${(t.services || []).length ? kv('Reads', t.services.map(x => `<span class="chip">${h(x)}</span>`).join('')) : ''}
      ${deps.length ? kv('Depends on', deps.map(d => `<span class="dep">${badge2(status(r, d))}<code>${tid(r, d)}</code> ${h(personOf(d))}</span>`).join('')) : ''}
    </div>
    <div class="blk"><div class="sh">Description</div><p>${h(t.objective)}</p>${t.why ? `<p class="why">${I('branch', 13)} <span><b>Routed to ${h(R.name)}:</b> ${h(t.why)}</span></p>` : ''}</div>
    ${Pk ? `<div class="blk"><div class="sh">Context from the shared foundation <small>${t.packet ? 'attached' : 'preview'}</small></div>
      <div class="lbar">${Object.entries(byL).map(([l, xs]) => `<i style="flex:${xs.length};--c:${LAYER_COL[l] || '#64748b'}" title="${h((LAYERS[l] || {}).name || l)}: ${xs.length}"></i>`).join('')}</div>
      <div class="llg">${Object.entries(byL).map(([l, xs]) => `<span><i style="--c:${LAYER_COL[l] || '#64748b'}"></i>${h((LAYERS[l] || {}).short || l)} ${xs.length}</span>`).join('')}<span class="sum">${total} items${reused.length ? ` · <b>${reused.length} reused</b>` : ''}${Pk.withheld.length ? ` · ${Pk.withheld.length} withheld` : ''}</span></div>
      <div class="items">${Pk.items.filter(i => i.layer !== 'policy').sort((x, y) => reusedIn(t, y) - reusedIn(t, x)).slice(0, 4).map(i => `<div class="it${reusedIn(t, i) ? ' re' : ''}"><i style="--c:${LAYER_COL[i.layer] || '#64748b'}"></i><div><b>${h(i.label)}</b> <code>${h(i.id)}</code>${reusedIn(t, i) ? '<span class="reuse">Reused</span>' : ''}<p>${h(String(i.value).slice(0, 130))}${String(i.value).length > 130 ? '…' : ''}</p><small>${h(i.from || '')}</small></div></div>`).join('')}
      ${Pk.withheld.slice(0, 2).map(w => `<div class="it wh">${I('lock', 13)}<div><b>Withheld</b> <code>${h(w.id)}</code><p>${h(w.why)}</p></div></div>`).join('')}</div></div>` : ''}
    ${s === 'blocked' ? `<div class="callout">${I('clock', 16)}<div>Starts when ${deps.filter(d => !ST.approved.has(d.id)).map(d => `<code>${tid(r, d)}</code> (${h(personOf(d))})`).join(', ')} is handed off.</div></div>` : ''}
    <div class="blk"><div class="sh">Activity</div><ol class="act">${timeline.map(([st, ic, a, b2]) => `<li class="${st}"><span class="an2">${st === 'now' ? '<span class="spin"></span>' : I(ic, 13)}</span><div><b>${a}</b>${b2 ? `<small>${b2}</small>` : ''}</div></li>`).join('')}</ol></div>
    ${out && out.body ? `<div class="blk"><div class="sh">Result</div><article class="deliv in"><header><div><small>${h(kindName(out.kind))}</small><b>${h(out.title || '')}</b>${t.contract && t.contract.as_of.length ? `<span>As of ${h(t.contract.as_of.join(', '))}</span>` : ''}</div></header><div class="docb">${bodyHTML(out.body)}</div></article></div>` : ''}
    ${s === 'failed' ? `<div class="callout bad">${I('alert', 16)}<div>${h(t.error || 'Failed')}</div></div>` : ''}`;
}
function footHTML(r, t, p) {
  const s = status(r, t), w = waitingOutput(t);
  if (s === 'ready') return `<span>Ready for ${h(p.name.split(' ')[0])}’s agents</span><button type="button" class="btn primary" data-run="${t.id}">${I('play', 13)} Run agents</button>`;
  if (s === 'running') return `<span class="busy"><span class="spin"></span> Agents working…</span>`;
  if (s === 'review') return `<span>${w ? '<b>Client-facing.</b> Approving signs it off.' : 'Approving hands this to the next team.'}</span><button type="button" class="btn subtle" data-back="${t.id}">${I('undo', 13)} Request changes</button><button type="button" class="btn primary" data-approve="${t.id}">${I('check', 13)} Approve and hand off</button>`;
  if (s === 'signoff') return `<span>“${h(w.title)}” waits for your sign-off.</span><button type="button" class="btn primary" data-signoff="${h(w.id)}">${I('check', 13)} Approve</button>`;
  if (s === 'approved') return `<span class="okt">${I('check', 14)} Done and handed off</span>`;
  if (s === 'blocked') return `<span class="busy">${I('clock', 14)} Waiting on an upstream ticket</span>`;
  return '';
}

/* bottom: the shared foundation */
HX.op = o => { ST.ops.push(Object.assign({ at: performance.now() }, o)); if (o.kind === 'call' && o.sys) ST.flash['s:' + o.sys] = performance.now(); HX.schedule(); setTimeout(HX.schedule, 1500); };
HX.flash = (l, cls) => { ST.flash['l:' + l] = { at: performance.now(), cls }; HX.schedule(); setTimeout(HX.schedule, 1500); };
function paintFound() {
  const now = performance.now(), r = run(), hot = k => { const f = ST.flash[k]; if (!f) return ''; const at = typeof f === 'number' ? f : f.at; return now - at < 1400 ? (f.cls || 'hot') : ''; };
  const last = ST.ops.filter(o => ['read', 'call', 'handoff', 'write'].includes(o.kind)).slice(-1)[0], fresh = last && now - last.at < 2500;
  setHTML(el('found'), `<div class="fl">${I('layers', 15)}<b>Shared foundation</b><span class="live${fresh ? ' on' : ''}"><i></i>${fresh ? h(`${{ read: 'Reading', write: 'Writing', call: 'Calling', handoff: 'Handing off' }[last.kind]} ${last.kind === 'call' ? (SYSTEMS[last.sys] || {}).name || '' : last.kind === 'handoff' ? 'via knowledge' : (LAYERS[last.layer] || {}).short || ''}`) : 'Idle'}</span></div>
    <div class="lys">${LAYER_ORDER.map(l => `<span class="ly ${hot('l:' + l)}" style="--c:${LAYER_COL[l]}"><i></i>${h(LAYERS[l].short || LAYERS[l].name)}<b>${layerCount(l)}</b></span>`).join('')}</div>
    <div class="sys">${SYS_ORDER.map(k => { const n = r ? r.tasks.reduce((m, t) => m + (t.calls || []).filter(c => c.sys === k).length, 0) : 0; return `<span class="sy ${hot('s:' + k) ? 'hot' : n ? 'used' : ''}" style="--c:${SYS_COL[k]}" title="${h(SYSTEMS[k].name)}"><i></i>${h(SYSTEMS[k].name.split(/[ &]/)[0])}${n ? `<b>${n}</b>` : ''}</span>`; }).join('')}</div>`);
}

/* ---------- events ---------- */
let tt; HX.toast = m => { const t = el('toast'); t.innerHTML = `${I('check', 14)}<span>${h(m)}</span>`; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3400); };
HX.ai = () => paintTop();
document.addEventListener('click', e => {
  const q = s => e.target.closest(s); let x;
  if (q('[data-menu]')) { ST.menu = !ST.menu; paintTop(); return; }
  if (ST.menu && !q('.menu')) { ST.menu = false; paintTop(); }
  if ((x = q('[data-me]'))) { if (!busyPlanning() && !anyRunning()) { ME = x.dataset.me; UI.requester = ME; UI.run = null; ST.open = null; ST.nokey = null; } ST.menu = false; paintAll(); return; }
  if ((x = q('[data-ask]'))) { ask(x.dataset.ask); return; }
  if ((x = q('[data-answer]'))) { answer(x.dataset.answer); return; }
  if (q('[data-answer-input]')) { answer(q('.qcard').querySelector('.clarIn').value.trim()); return; }
  if (q('[data-runall]')) { runAll(); return; }
  if (q('[data-stop]')) { ST.auto = false; paintAll(); return; }
  if ((x = q('[data-view]'))) { ST.view = x.dataset.view; if (ST.view === 'results') ST.open = null; paintAll(); return; }
  if ((x = q('[data-signoff]'))) { signOff(F.outputs.find(o => o.id === x.dataset.signoff)); paintAll(); return; }
  if ((x = q('[data-task]'))) { const t = run().tasks.find(y => y.id === x.dataset.task); ST.open = personOf(t); ST.openTask = t.id; ST.view = 'floor'; paintAll(); return; }
  if ((x = q('.pc'))) { ST.open = x.dataset.person; const t = run() && run().tasks.find(y => personOf(y) === ST.open); ST.openTask = t ? t.id : null; paintAll(); return; }
  if ((x = q('[data-tab-task]'))) { ST.openTask = x.dataset.tabTask; paintAll(); return; }
  if (q('[data-close]')) { ST.open = null; ST.openTask = null; paintAll(); return; }
  if ((x = q('[data-run]'))) { startTask(run().tasks.find(y => y.id === x.dataset.run)); return; }
  if ((x = q('[data-approve]'))) { approve(run().tasks.find(y => y.id === x.dataset.approve)); return; }
  if ((x = q('[data-back]'))) { sendBack(run().tasks.find(y => y.id === x.dataset.back)); return; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (ST.menu) ST.menu = false; else if (ST.open) ST.open = null; paintAll(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); el('ask').focus(); }
  if (e.target.classList && e.target.classList.contains('clarIn') && e.key === 'Enter') answer(e.target.value.trim());
});
el('composer').onsubmit = e => { e.preventDefault(); const v = el('ask').value; el('ask').value = ''; ask(v); };
el('newChat').onclick = () => { if (busyPlanning() || anyRunning()) return; UI.run = null; ST.open = null; ST.nokey = null; ST.auto = false; F.session.advisor = null; paintAll(); };

UI.requester = ME; paintAll();
initAI().then(paintAll);
window.HARNESS = { ask, answer, startTask, approve, runAll, ST, status };
})();
