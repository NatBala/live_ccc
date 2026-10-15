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
const TCOL = t => (TEAMS[t] || {}).color || '#999';
const LAYER_COL = { memory: '#8b6cf0', knowledge: '#1fb486', policy: '#e2643a', models: '#3b82f6', feedback: '#c6902f', events: '#e0a21b', graph: '#16a2b8' };
const SYS_COL = { sf: '#1b8ef2', m365: '#2f6fd6', seismic: '#e5533c', fund: '#11a37f', mstar: '#c0392b', gen: '#d97706', mcloud: '#0ea5e9', aem: '#9333ea', news: '#d4890f', exp: '#64748b' };
const DRAFTING = { start: 'Reading your request', requester: 'Checking who is asking', entity: 'Resolving the advisor in the graph', intent: 'Naming the business intent', asks: 'Splitting the request into asks', interpretation: 'Writing the interpretation', missing: 'Deciding what the foundation already answers', memory: 'Checking memory rules', reuse: 'Looking for work to reuse', controls: 'Setting controls', success: 'Defining done', task: 'Assigning tickets to teams', clarify: 'Drafting a question', next: 'Thinking' };

/* ---------- people and avatars ---------- */
const ROSTER = Object.entries(ROLES).map(([rid, r]) => ({ rid, team: r.team, role: r.name, name: r.person, does: r.does }));
function avatar(name, color, size = 64) {
  const n = [...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const skin = ['#f6d3b8', '#eab48e', '#cf9268', '#a86c4a', '#7b4b32', '#f2c8a2'][n % 6], hair = ['#2b1d16', '#4b2f22', '#1d1d1f', '#7b4a2a', '#b37a3e', '#3b2a20', '#6b6b6b'][(n >> 3) % 7], style = (n >> 6) % 4, shirt = color;
  const H = [
    `<path d="M21 27C19.5 14 27 9.5 32.5 9.5 41 9.5 45 16 43 27 41 20 37 18 32 18 27 18 23 21 21 27Z" fill="${hair}"/>`,
    `<path d="M19.5 30C17 12 27 8.5 32 8.5 40.5 8.5 47 13 44.5 30L46 46C41.5 41 42 33 42 27 38 20 26 20 22 27 22 33 22.5 41 18 46Z" fill="${hair}"/>`,
    `<path d="M21 27C19.5 14 27 9.5 32.5 9.5 41 9.5 45 16 43 27 41 20 37 18 32 18 27 18 23 21 21 27Z" fill="${hair}"/><circle cx="32" cy="8" r="5.5" fill="${hair}"/>`,
    `<path d="M21 28C19 13 30 8.5 35.5 10.5 42.5 12 45.5 18 43 28 40.5 19.5 30 22.5 24.5 20 22.5 22 21.5 24.5 21 28Z" fill="${hair}"/>`][style];
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="c${n}"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#c${n})"><rect width="64" height="64" fill="${color}" opacity=".22"/><path d="M8 66C10 50 20 45 32 45S54 50 56 66Z" fill="${shirt}"/><path d="M27 45L32 52 37 45Z" fill="#fff" opacity=".85"/><rect x="28" y="36" width="8" height="10" rx="3" fill="${skin}"/><ellipse cx="32" cy="27" rx="11" ry="13" fill="${skin}"/>${H}<circle cx="28" cy="28" r="1.3" fill="#2b2b2b"/><circle cx="36" cy="28" r="1.3" fill="#2b2b2b"/><path d="M29 33.2Q32 35.6 35 33.2" stroke="#7a3b2a" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></svg>`;
}
let ME = 'EMP-PRIYA';
const meName = () => EMPLOYEES[ME].name;

/* ---------- state ---------- */
const ST = { approved: new Set(), flown: new Set(), open: null, openTask: null, auto: false, ops: [], flash: {}, menu: false, shownPlan: null };
const run = () => UI.run;
const tid = (r, t) => `CCE-${1000 + parseInt(String(r.id).replace(/\D/g, '') || '0', 10) * 10 + (t.step || 0)}`;
const personOf = t => t.person || (ROLES[t.role] || {}).person || meName();
const roleOfT = t => ROLES[t.role] || { name: AGENTS[t.agent].name, team: AGENTS[t.agent].team };
const depsOf = (r, t) => t.depends_on.map(d => r.tasks.find(x => x.id === d)).filter(Boolean);
function status(r, t) {
  if (t.state === 'running') return 'running';
  if (t.state === 'failed') return 'failed';
  if (t.state === 'done') return ST.approved.has(t.id) ? 'approved' : 'review';
  return depsOf(r, t).every(d => ST.approved.has(d.id)) ? 'ready' : 'blocked';
}
const ST_LABEL = { ready: 'New ticket', blocked: 'Waiting on handoff', running: 'Agents working', review: 'Waiting for approval', approved: 'Approved', failed: 'Failed', idle: 'No tickets' };
const busyPlanning = () => !!(run() && run().status === 'thinking');
const anyRunning = () => !!(run() && run().tasks.some(t => t.state === 'running'));

/* ---------- requests ---------- */
const recordedFor = who => RECORDED.filter(r => r.requester === who || (EMPLOYEES[r.requester] && EMPLOYEES[r.requester].team === EMPLOYEES[who].team));
const suggestions = () => AI.mode === 'live' ? (SUGGESTIONS[EMPLOYEES[ME].team] || []).slice(0, 5) : [...new Set(recordedFor(ME).map(r => r.text))].slice(0, 6);
function ask(text, clarified) {
  text = String(text || '').trim(); if (!text) return;
  if (busyPlanning() || anyRunning()) { toast('Still working on the current request.'); return; }
  const rec = RECORDED.find(r => r.text === text && r.requester === ME) || RECORDED.find(r => r.text === text);
  if (AI.mode !== 'live' && !rec) { ST.nokey = text; UI.run = null; paintAll(); return; }
  ST.nokey = null; ST.approved = new Set(); ST.flown = new Set(); ST.open = null; ST.openTask = null; ST.auto = false; ST.shownPlan = null;
  if (rec && AI.mode !== 'live' && rec.requester !== ME) { ME = rec.requester; }
  UI.requester = ME; UI.run = null;
  runRequest(text, AI.mode === 'live' ? null : rec, Object.assign({ planOnly: true }, clarified ? { clarified } : {}));
}
function answer(v) {
  const r = run(); if (!r || r.status !== 'clarify' || !v) return;
  const q = r.clarify, t = r.text.replace(/ \(clarification:.*\)$/, '');
  ask(`${t} (clarification: ${v})`, { question: q, answer: v });
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
function approve(t) {
  const r = run(); if (!r || t.state !== 'done') return;
  ST.approved.add(t.id);
  (t.verdicts || []).filter(v => v.kind === 'output').forEach(v => { const o = F.outputs.find(x => x.id === v.id); if (o && o.status === 'Waiting for approval') { o.status = 'Approved by ' + personOf(t); logEvent('approval.granted', o.title, ME, o.adv); flashTile('policy', 'write'); } });
  logEvent('ticket.approved', `${tid(r, t)} ${t.title}`, ME, r.advisor);
  r.tasks.filter(x => x.depends_on.includes(t.id)).forEach((x, k) => setTimeout(() => fly(cardOf(personOf(t)), cardOf(personOf(x)), tid(r, x), TCOL(roleOfT(x).team), 'handoff'), k * 220));
  if (r.tasks.every(x => ST.approved.has(x.id))) { finishRun(r); toast('Delivered. Every ticket approved.'); }
  paintAll();
}
function sendBack(t) { if (t.state !== 'done') return; ['result', 'verdicts', 'calls', 'packet', 'contract', 'toolResults', 'error'].forEach(k => delete t[k]); t.state = 'queued'; paintAll(); }
async function autopilot() {
  const r = run(); if (!r || !r.tasks.length) return;
  ST.auto = true; paintAll();
  while (ST.auto && run() === r && !r.tasks.every(t => ST.approved.has(t.id))) {
    const ready = r.tasks.filter(t => status(r, t) === 'ready');
    if (ready.length) { ST.open = personOf(ready[0]); ST.openTask = ready[0].id; await Promise.all(ready.map(startTask)); continue; }
    const rev = r.tasks.filter(t => status(r, t) === 'review');
    const needsYou = rev.find(t => (t.verdicts || []).some(v => v.kind === 'output' && (F.outputs.find(o => o.id === v.id) || {}).status === 'Waiting for approval'));
    if (needsYou) { ST.auto = false; ST.open = personOf(needsYou); ST.openTask = needsYou.id; toast(`${personOf(needsYou)} needs your approval before this goes anywhere.`); break; }
    if (rev.length) { for (const t of rev) { await sleep(700); approve(t); } continue; }
    break;
  }
  ST.auto = false; paintAll();
}

/* ---------- flying tickets ---------- */
const cardOf = name => document.querySelector(`.pcard[data-person="${CSS.escape(name)}"]`);
function fly(from, to, label, color, kind = 'assign') {
  if (!from || !to) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), f = document.createElement('div');
  f.className = 'tk ' + kind; f.style.setProperty('--c', color); f.textContent = label;
  f.style.left = a.left + a.width / 2 + 'px'; f.style.top = a.top + a.height / 2 + 'px';
  el('fly').appendChild(f);
  requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(.9)`; f.style.opacity = '0.15'; }));
  setTimeout(() => { f.remove(); to.classList.remove('landed'); void to.offsetWidth; to.classList.add('landed'); }, 900 * Math.max(SLEEP_SCALE, 0.3));
}
function flyAssignments(r) {
  if (ST.shownPlan === r.id || !r.tasks.length || !['planned', 'running'].includes(r.status)) return;
  ST.shownPlan = r.id;
  r.tasks.forEach((t, k) => setTimeout(() => fly(document.querySelector('.orch .obadge') || el('orch'), cardOf(personOf(t)), tid(r, t), TCOL(roleOfT(t).team)), 250 + k * 280 * Math.max(SLEEP_SCALE, 0.3)));
}

/* ---------- painting ---------- */
function setHTML(node, html) { if (node && node._h !== html) { node.innerHTML = html; node._h = html; } }
let raf = 0;
HX.schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintAll(); }); };
function paintAll() { paintTop(); paintOrch(); paintFloor(); paintBench(); paintFound(); const r = run(); if (r) flyAssignments(r); }

function paintTop() {
  const E = EMPLOYEES[ME];
  setHTML(el('asker'), `<button type="button" class="askbtn" data-menu>${avatar(E.name, TCOL(E.team), 28)}<span>${h(E.name.split(' ')[0])}</span><i>▾</i></button>${ST.menu ? `<div class="menu">${Object.entries(EMPLOYEES).map(([id, e]) => `<button type="button" data-me="${id}">${avatar(e.name, TCOL(e.team), 26)}<span><b>${h(e.name)}</b><small>${h(TEAMS[e.team].short || TEAMS[e.team].name)}</small></span></button>`).join('')}</div>` : ''}`);
  el('send').disabled = busyPlanning() || anyRunning();
  el('modeTag').className = 'mode ' + (AI.mode === 'live' ? 'live' : 'replay');
  el('modeTag').textContent = AI.mode === 'live' ? `Live AI · ${AI.provider || ''}` : AI.mode === 'checking' ? 'Connecting…' : 'Replay · saved AI runs';
}

/* left: the orchestrator */
function paintOrch() {
  const r = run();
  if (!r) {
    setHTML(el('orch'), `<div class="oh"><span class="obadge">${icoOrch()}</span><div><b>Orchestrator</b><small>Intelligence and orchestration</small></div></div>
      <p class="olead">Ask for an outcome. The orchestrator reads what the shared foundation already knows, plans the work, and sends a ticket to each team that owns a piece of it.</p>
      ${ST.nokey ? `<div class="warnbox"><b>No AI key on this server</b>, so “${h(ST.nokey)}” can’t be planned live. Pick a saved AI run, which replays through the real foundation, tools and checks, or add an OpenAI or Azure OpenAI key.</div>` : ''}
      <div class="olbl">${AI.mode === 'live' ? 'Try' : 'Saved AI runs'}</div><div class="sugs">${suggestions().map(s => `<button type="button" class="sug" data-ask="${h(s)}">${h(s)}</button>`).join('')}</div>`);
    return;
  }
  const B = r.bts || {}, C = B.context || {}, I = r.interp, thinking = r.status === 'thinking';
  const lookup = r.decisions.find(d => d.type === 'lookup');
  const assumed = r.decisions.filter(d => d.type === 'missing');
  const known = r.decisions.filter(d => ['entity', 'known', 'reuse', 'memory'].includes(d.type) && d.src !== 'code');
  const live = r.decisions.filter(d => d.type !== 'lookup').slice(-4);
  const waves = [...new Set(r.tasks.map(t => t.wave))].sort((a, b) => a - b);
  const done = r.tasks.filter(t => ST.approved.has(t.id)).length;
  const head = thinking ? `<div class="ostat think"><span class="spin"></span><span><b>${h(DRAFTING[B.drafting] || 'Planning')}</b><small>${r.replay ? 'Replaying the orchestrator’s saved reasoning' : B.chars ? `${B.chars.toLocaleString()} characters from the model` : 'Sending the request and foundation context'}</small></span></div>`
    : r.status === 'clarify' ? `<div class="ostat ask"><b>One question</b><small>The foundation couldn’t settle this</small></div>`
    : r.status === 'done' ? `<div class="ostat ok"><b>Delivered</b><small>${r.tasks.length} tickets approved · ${Math.round(((r.t1 || Date.now()) - r.t0) / 1000)} s</small></div>`
    : r.tasks.length ? `<div class="ostat plan"><b>${r.tasks.length} tickets · ${new Set(r.tasks.map(t => roleOfT(t).team)).size} teams</b><small>${done} of ${r.tasks.length} approved</small><span class="obar"><i style="width:${done / r.tasks.length * 100}%"></i></span></div>` : '';
  setHTML(el('orch'), `<div class="oh"><span class="obadge${thinking ? ' pulse' : ''}">${icoOrch()}</span><div><b>Orchestrator</b><small>${r.replay ? 'Replaying a saved AI run' : 'Live AI'}</small></div></div>
    <div class="req">${avatar(EMPLOYEES[r.requester].name, TCOL(EMPLOYEES[r.requester].team), 30)}<span><small>${h(EMPLOYEES[r.requester].name)} asked</small>“${h(r.text.replace(/ \(clarification:.*\)$/, ''))}”</span></div>
    ${head}
    ${r.status === 'clarify' ? clarifyHTML(r) : ''}
    ${r.tasks.length && r.status !== 'clarify' ? `<div class="osec"><div class="olbl">Tickets${r.status !== 'done' ? `<button type="button" class="auto${ST.auto ? ' on' : ''}" data-auto>${ST.auto ? '■ Stop auto-pilot' : '▶ Auto-pilot'}</button>` : ''}</div>
      ${waves.map(w => `<div class="wv"><span>Wave ${w}</span>${r.tasks.filter(t => t.wave === w).length > 1 ? 'in parallel' : ''}</div>${r.tasks.filter(t => t.wave === w).map(t => { const s = status(r, t), R = roleOfT(t); return `<button type="button" class="trow ${s}${ST.openTask === t.id ? ' sel' : ''}" data-task="${t.id}">${avatar(personOf(t), TCOL(R.team), 26)}<span><small>${tid(r, t)} · ${h(R.name)}</small><b>${h(t.title)}</b></span><em class="pill ${s}">${h(ST_LABEL[s])}</em></button>`; }).join('')}`).join('')}
      <p class="hint">Click a person on the floor to open their ticket.</p></div>` : ''}
    ${r.status === 'done' || r.status === 'failed' ? finalHTML(r) : ''}
    <div class="osec"><div class="olbl">Checked the foundation first</div>
      <div class="fact"><span>Graph</span>${h(lookup ? lookup.detail || lookup.title : '…')}</div>
      ${C.memories != null ? `<div class="fact"><span>Context</span>${C.memories} memories · ${C.content} approved pieces · ${C.funds} funds · ${C.routes} specialist routes</div>` : ''}
      ${B.authority ? `<div class="fact"><span>Authority</span>🔒 ${h((AUTHORITY[r.authority || B.authority.authority] || {}).label || '')}</div>` : ''}
    </div>
    ${I ? `<div class="osec"><div class="olbl">Understood</div><div class="und"><b>${h(I.title || '')}</b><div class="chips">${I.intent ? `<em class="chip acc">${h(I.intent)}</em>` : ''}${I.subject && I.subject.label ? `<em class="chip">${h(I.subject.label)}</em>` : ''}${I.output ? `<em class="chip">${h(I.output)}</em>` : ''}${I.time ? `<em class="chip">${h(I.time)}</em>` : ''}</div></div></div>` : ''}
    ${thinking && live.length ? `<div class="osec"><div class="olbl">Reasoning</div>${live.map(d => `<div class="lr"><span class="src ${d.src === 'code' ? 'rule' : 'ai'}">${d.src === 'code' ? 'RULE' : 'AI'}</span><span>${h(d.title)}</span></div>`).join('')}</div>` : ''}
    ${assumed.length || known.length ? `<div class="osec"><div class="olbl">Answered from the foundation, not asked</div>${known.slice(0, 2).concat(assumed).slice(0, 4).map(d => `<div class="ans2"><b>${h(d.title)}</b><small>${h(d.detail || '')}</small></div>`).join('')}</div>` : ''}
`);
}
function clarifyHTML(r) {
  const opts = (r.clarifyOptions || []).length ? r.clarifyOptions : (r.resolution && r.resolution.candidates || []).slice(0, 3).map(c => c.name);
  return `<div class="qcard"><div class="qt">${h(r.clarify)}</div>${r.clarifyWhy ? `<p class="qwhy">${h(r.clarifyWhy)}</p>` : ''}${opts.map(o => `<button type="button" class="opt" data-answer="${h(o)}">${h(o)}</button>`).join('')}<div class="other"><input class="clarIn" placeholder="Or type an answer…"><button type="button" class="ghost sm" data-answer-input>Answer</button></div><button type="button" class="linkbtn" data-answer="Make your best assumption and continue">Make your best assumption</button></div>`;
}
function finalHTML(r) {
  const S = r.stats;
  return r.error ? `<div class="warnbox">${h(r.error)}</div>` : `<div class="osec"><div class="olbl">What the foundation saved</div><div class="stats"><div><b>${S.reads}</b><small>items read</small></div><div><b>${S.reused}</b><small>reused</small></div><div><b>${S.calls}</b><small>system calls</small></div><div><b>${S.committed}</b><small>stored back</small></div></div></div>`;
}
const icoOrch = () => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v4.3M12 11.5l-5.6 5.6M12 11.5l5.6 5.6"/></svg>';

/* middle: the team floor */
function paintFloor() {
  const r = run(), box = el('floor');
  if (!box._init) {
    box.innerHTML = `<div class="fh"><div><b>Team floor</b><small id="fsub"></small></div><div class="legend">${['ready', 'running', 'review', 'approved'].map(s => `<span><i class="dot ${s}"></i>${ST_LABEL[s]}</span>`).join('')}</div></div>` +
      TEAM_ORDER.map(tm => `<div class="team" style="--c:${TCOL(tm)}"><div class="teamh"><i></i>${h(TEAMS[tm].name)}</div><div class="cards">${ROSTER.filter(p => p.team === tm).map(p => `<button type="button" class="pcard idle" data-person="${h(p.name)}" style="--c:${TCOL(tm)}"></button>`).join('')}</div></div>`).join('');
    box._init = 1;
  }
  el('fsub').textContent = !r ? 'Everyone who can take a ticket' : r.tasks.length ? `${r.tasks.length} tickets routed by the orchestrator` : r.status === 'thinking' ? 'Waiting for the plan…' : '';
  box.querySelectorAll('.pcard').forEach(c => {
    const p = ROSTER.find(x => x.name === c.dataset.person), ts = r ? r.tasks.filter(t => personOf(t) === p.name) : [];
    const ss = ts.map(t => status(r, t)), s = !ts.length ? 'idle' : ['running', 'review', 'ready', 'failed', 'blocked', 'approved'].find(x => ss.includes(x));
    const agents = [...new Set(ts.map(t => t.route || AGENTS[t.agent].name))];
    c.className = `pcard ${s}${ST.open === p.name ? ' sel' : ''}${c.classList.contains('landed') ? ' landed' : ''}`;
    setHTML(c, `<span class="av">${avatar(p.name, TCOL(p.team), 58)}${s === 'running' ? '<span class="ring"></span>' : ''}${ts.length ? `<span class="cnt">${ts.length}</span>` : ''}</span>
      <span class="pn"><b>${h(p.name)}${p.name === meName() ? ' <em>you</em>' : ''}</b><small>${h(p.role)}</small></span>
      ${ts.length ? `<span class="pst ${s}">${h(ST_LABEL[s])}</span><span class="pag">${agents.slice(0, 2).map(a => `<em>${h(a)}</em>`).join('')}</span>` : `<span class="pdo">${h(p.does)}</span>`}`);
  });
}

/* right: the workbench for one person */
function paintBench() {
  const r = run(), b = el('bench');
  if (!ST.open) { b.hidden = true; document.body.classList.remove('benched'); return; }
  b.hidden = false; document.body.classList.add('benched');
  const p = ROSTER.find(x => x.name === ST.open) || { name: ST.open, team: 'sales', role: '', does: '' };
  const ts = r ? r.tasks.filter(t => personOf(t) === p.name) : [];
  const t = ts.find(x => x.id === ST.openTask) || ts[0];
  if (!b._init) { b.innerHTML = `<div class="bh"></div><div class="bbody"></div>`; b._init = 1; }
  setHTML(b.querySelector('.bh'), `<div class="bperson" style="--c:${TCOL(p.team)}">${avatar(p.name, TCOL(p.team), 52)}<span><b>${h(p.name)}</b><small>${h(p.role)} · ${h(TEAMS[p.team].short || TEAMS[p.team].name)} workbench</small></span><button type="button" class="x" data-close aria-label="Close">✕</button></div>
    ${ts.length > 1 ? `<div class="btabs">${ts.map(x => `<button type="button" class="${x === t ? 'on' : ''}" data-tab-task="${x.id}">${tid(r, x)}</button>`).join('')}</div>` : ''}`);
  const key = p.name + '|' + (t ? t.id : '') + '|' + (r ? r.id : ''); if (b._key !== key) { b._key = key; b.querySelector('.bbody').scrollTop = 0; }
  setHTML(b.querySelector('.bbody'), t ? ticketHTML(r, t, p) : `<div class="empty"><p><b>No tickets for ${h(p.name.split(' ')[0])}</b> in this request.</p><p class="muted">${h(p.does)}</p><div class="olbl">Agents on this workbench</div><div class="chips">${Object.keys(AGENTS).filter(a => roleOf(a) === p.rid).map(a => `<em class="chip">${h(AGENTS[a].name)}</em>`).join('')}</div></div>`);
}
const gist = out => { if (out == null) return ''; if (typeof out !== 'object') return String(out).slice(0, 60); if (Array.isArray(out)) return `${out.length} record${out.length === 1 ? '' : 's'}`; const a = Object.entries(out).find(([, x]) => Array.isArray(x) && x.length); return a ? `${a[1].length} ${a[0].replace(/_/g, ' ')}` : `${Object.keys(out).length} fields`; };
const argText = i => Object.entries(i || {}).filter(([, x]) => x !== '' && x != null).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(', ') : String(x)}`.slice(0, 36)).join(', ');
const reusedIn = (t, i) => { const rec = F.memory.find(m => m.id === i.id) || F.findings.find(k => k.id === i.id); return !!(rec && (rec.origin || rec.by) && (rec.origin || rec.by) !== t.agent); };
function bodyHTML(s) {
  const ids = x => h(x).replace(/\b([A-Z]{2,5}-[A-Z0-9]{1,6}(?:-[A-Z0-9]+)?)\b/g, '<span class="sid">$1</span>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let html = '', list = false;
  for (const ln of String(s || '').split('\n')) { const m = ln.match(/^\s*[-•*]\s+(.*)/); if (m) { if (!list) { html += '<ul>'; list = true; } html += `<li>${ids(m[1])}</li>`; } else { if (list) { html += '</ul>'; list = false; } if (ln.trim()) html += (/^#{1,4}\s/.test(ln.trim()) || /:$/.test(ln.trim())) && ln.length < 70 ? `<h5>${ids(ln.replace(/^#+\s*/, ''))}</h5>` : `<p>${ids(ln)}</p>`; } }
  return html + (list ? '</ul>' : '');
}
const VERB = { published: 'Published to shared knowledge', committed: 'Committed to shared memory', pending: 'Proposed for memory', rejected: 'Not stored', blocked: 'Blocked', read: 'Read only', task: 'Kept to this task', proposed: 'Proposed, needs you', flagged: 'Flagged for a number check', approval: 'Needs your approval' };
function ticketHTML(r, t, p) {
  const s = status(r, t), R = roleOfT(t), deps = depsOf(r, t), A = AGENTS[t.agent];
  const P = t.packet || (r.tasks.length ? (() => { try { return buildPacket(t, r); } catch (e) { return null; } })() : null);
  const byL = {}; (P ? P.items : []).forEach(i => (byL[i.layer] = byL[i.layer] || []).push(i));
  const reused = P ? P.items.filter(i => reusedIn(t, i)) : [];
  const steps = ['Assigned', 'Agents working', 'Review', 'Approved'], at = { ready: 0, blocked: 0, running: 1, failed: 1, review: 2, approved: 3 }[s];
  const out = t.result && t.result.output;
  const waitOut = (t.verdicts || []).map(v => v.kind === 'output' && F.outputs.find(o => o.id === v.id)).find(o => o && o.status === 'Waiting for approval');
  return `<div class="tkhead"><span class="tkid">${tid(r, t)}</span><em class="pill ${s}">${h(ST_LABEL[s])}</em><span class="muted">from Orchestrator for ${h(EMPLOYEES[r.requester].name)} · wave ${t.wave}</span></div>
    <div class="stepper">${steps.map((x, k) => `<span class="${k < at || s === 'approved' ? 'done' : k === at ? 'now' : ''}">${h(x)}</span>`).join('')}</div>
    <div class="card"><div class="olbl">Request</div><h3>${h(t.title)}</h3><p>${h(t.objective)}</p>${t.why ? `<p class="why"><b>Why ${h(R.name)}:</b> ${h(t.why)}</p>` : ''}</div>
    <div class="card"><div class="olbl">Agents on this ticket</div><div class="agentrow"><span class="agentb">${h(A.name)}</span>${t.route ? `<span class="route">${h(t.route)}</span>` : ''}${(t.services || []).map(x => `<span class="svc">[${h(x)}]</span>`).join('')}</div><p class="muted">${h(A.does)}</p></div>
    ${deps.length ? `<div class="card"><div class="olbl">Builds on</div>${deps.map(d => `<div class="dep ${status(r, d)}">${avatar(personOf(d), TCOL(roleOfT(d).team), 24)}<span><b>${tid(r, d)} · ${h(personOf(d))}</b><small>${h(d.result && d.result.output ? d.result.output.title : d.title)}</small></span><em class="pill ${status(r, d)}">${h(ST_LABEL[status(r, d)])}</em></div>`).join('')}</div>` : ''}
    ${P ? `<div class="card"><div class="olbl">Context from the shared foundation <span class="muted">${t.packet ? 'attached' : 'will be attached'}</span></div>
      <div class="ctxsum"><b>${P.items.length}</b> items from <b>${Object.keys(byL).length}</b> layers${reused.length ? ` · <b class="reuse">${reused.length} reused from other teams</b>` : ''}${P.withheld.length ? ` · ${P.withheld.length} withheld by policy` : ''}</div>
      <div class="lyrs">${Object.entries(byL).map(([l, xs]) => `<span style="--c:${LAYER_COL[l] || '#888'}">${h((LAYERS[l] || {}).short || l)} <b>${xs.length}</b></span>`).join('')}</div>
      ${P.items.filter(i => i.layer !== 'policy').sort((x, y) => reusedIn(t, y) - reusedIn(t, x)).slice(0, 4).map(i => `<div class="item${reusedIn(t, i) ? ' re' : ''}"><span class="sid">${h(i.id)}</span><span><b>${h(i.label)}</b> ${h(String(i.value).slice(0, 110))}${String(i.value).length > 110 ? '…' : ''}<small> · ${h(i.from || '')}${reusedIn(t, i) ? ' · reused' : ''}</small></span></div>`).join('')}
      ${P.withheld.slice(0, 2).map(w => `<div class="item wh"><span class="sid">${h(w.id)}</span><span>Withheld · ${h(w.why)}</span></div>`).join('')}</div>` : ''}
    ${s === 'ready' ? `<button type="button" class="run" data-run="${t.id}">▶ Run agents</button>` : s === 'blocked' ? `<div class="waitbox">Waiting for ${deps.filter(d => !ST.approved.has(d.id)).map(d => `${tid(r, d)} (${h(personOf(d))})`).join(', ')} to be approved.</div>` : ''}
    ${t.state === 'running' || t.calls ? `<div class="card live"><div class="olbl">${t.state === 'running' ? '<span class="spin"></span> Agents working' : 'What the agents did'}</div>
      <div class="act ${t.packet ? 'ok' : 'now'}">${t.packet ? '✓' : '…'} Context assembled from the foundation</div>
      ${(t.calls || []).map(c => `<div class="act call${c.error ? ' err' : ''}"><span class="sysb" style="--c:${SYS_COL[c.sys] || '#888'}">${h((SYSTEMS[c.sys] || {}).name || c.sys || 'gateway')}</span><span class="via">${h(c.via || '')}</span><code>${h(c.name)}(${h(argText(c.input))})</code><span class="res">${c.error ? h(c.error) : h(gist(c.out)) + (c.out && c.out.synthesized ? ' <em class="demo">DEMO</em>' : '')}</span></div>`).join('')}
      ${t.state === 'running' ? `<div class="act now"><span class="spin"></span> ${t.packet ? (t.calls || []).length ? 'Drafting from the context and results' : 'Calling systems only for what the foundation doesn’t hold' : 'Reading the foundation'}</div>` : `<div class="act ok">✓ ${t.calls && t.calls.length ? `${t.calls.length} system call${t.calls.length > 1 ? 's' : ''}; everything else came from the foundation` : 'No system calls needed; the foundation had it'}</div>`}</div>` : ''}
    ${t.result ? `<div class="card"><div class="olbl">Result</div>${t.result.says ? `<p class="says">“${h(t.result.says)}”</p>` : ''}${out && out.body ? `<div class="doc"><div class="dh"><span class="kind">${h(String(out.kind || 'output').toUpperCase())}</span><b>${h(out.title || '')}</b>${t.contract && t.contract.as_of.length ? `<small>As of ${h(t.contract.as_of.join(', '))}</small>` : ''}</div><div class="db">${bodyHTML(out.body)}</div></div>` : ''}</div>` : ''}
    ${t.verdicts ? `<div class="card"><div class="olbl">Gatekeeper</div><div class="vds">${t.verdicts.map(v => { const o = v.kind === 'output' && F.outputs.find(y => y.id === v.id), vs = o && o.status === 'Waiting for approval' ? 'approval' : v.status; return `<span class="vd ${vs}" title="${h(v.reason || '')}">${h(v.kind)}: ${h(VERB[vs] || vs)}${v.id ? ` <span class="sid">${h(v.id)}</span>` : ''}${['rejected', 'blocked', 'flagged'].includes(vs) && v.reason ? ` <em>${h(v.reason)}</em>` : ''}</span>`; }).join('')}</div></div>` : ''}
    ${s === 'review' ? `<div class="approvebar"><span>${waitOut ? `<b>Client-facing.</b> Nothing goes out until you approve “${h(waitOut.title)}”.` : `<b>Review ${h(p.name.split(' ')[0])}’s work.</b> Approving hands it to the next team.`}</span><button type="button" class="ghost" data-back="${t.id}">Request changes</button><button type="button" class="primary" data-approve="${t.id}">✓ Approve and hand off</button></div>` : ''}
    ${s === 'failed' ? `<div class="warnbox">${h(t.error || 'Failed')}</div>` : ''}`;
}

/* bottom: the shared foundation */
HX.op = o => { ST.ops.push(Object.assign({ at: performance.now() }, o)); if (o.kind === 'call' && o.sys) ST.flash['s:' + o.sys] = performance.now(); HX.schedule(); setTimeout(HX.schedule, 1500); };
HX.flash = (l, cls) => { ST.flash['l:' + l] = { at: performance.now(), cls }; HX.schedule(); setTimeout(HX.schedule, 1500); };
function paintFound() {
  const now = performance.now(), r = run(), hot = k => { const f = ST.flash[k]; if (!f) return ''; const at = typeof f === 'number' ? f : f.at; return now - at < 1400 ? (f.cls || 'hot') : ''; };
  const last = ST.ops.filter(o => ['read', 'call', 'handoff', 'write'].includes(o.kind)).slice(-1)[0];
  setHTML(el('found'), `<div class="fl"><b>Shared foundation</b><small>${last && now - last.at < 2500 ? h(`${last.kind === 'read' ? 'Reading' : last.kind === 'write' ? 'Writing' : last.kind === 'call' ? 'Calling' : 'Handing off'} · ${last.kind === 'call' ? (SYSTEMS[last.sys] || {}).name || '' : last.kind === 'handoff' ? 'through knowledge' : (LAYERS[last.layer] || {}).name || ''}`) : 'Every team reads and writes here'}</small></div>
    <div class="layers">${LAYER_ORDER.map(l => `<div class="ly ${hot('l:' + l)}" style="--c:${LAYER_COL[l]}"><b>${layerCount(l)}</b><span>${h(LAYERS[l].short || LAYERS[l].name)}</span></div>`).join('')}</div>
    <div class="syss">${SYS_ORDER.map(k => { const n = r ? r.tasks.reduce((m, t) => m + (t.calls || []).filter(c => c.sys === k).length, 0) : 0; return `<span class="sy ${hot('s:' + k) ? 'hot' : n ? 'used' : ''}" style="--c:${SYS_COL[k]}" title="${h(SYSTEMS[k].name)}">${h(SYSTEMS[k].name.split(/[ &]/)[0])}${n ? `<b>${n}</b>` : ''}</span>`; }).join('')}</div>`);
}

/* ---------- events ---------- */
let tt; HX.toast = m => { const t = el('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3400); };
HX.ai = () => paintTop();
document.addEventListener('click', e => {
  const q = s => e.target.closest(s);
  if (q('[data-menu]')) { ST.menu = !ST.menu; paintTop(); return; }
  if (ST.menu && !q('.menu')) { ST.menu = false; paintTop(); }
  let x;
  if ((x = q('[data-me]'))) { if (!busyPlanning() && !anyRunning()) { ME = x.dataset.me; UI.requester = ME; UI.run = null; ST.open = null; ST.nokey = null; } ST.menu = false; paintAll(); return; }
  if ((x = q('[data-ask]'))) { ask(x.dataset.ask); return; }
  if ((x = q('[data-answer]'))) { answer(x.dataset.answer); return; }
  if (q('[data-answer-input]')) { answer(q('.qcard').querySelector('.clarIn').value.trim()); return; }
  if (q('[data-auto]')) { if (ST.auto) { ST.auto = false; paintAll(); } else autopilot(); return; }
  if ((x = q('[data-task]'))) { const t = run().tasks.find(y => y.id === x.dataset.task); ST.open = personOf(t); ST.openTask = t.id; paintAll(); return; }
  if ((x = q('.pcard'))) { ST.open = x.dataset.person; const t = run() && run().tasks.find(y => personOf(y) === ST.open); ST.openTask = t ? t.id : null; paintAll(); return; }
  if ((x = q('[data-tab-task]'))) { ST.openTask = x.dataset.tabTask; paintAll(); return; }
  if (q('[data-close]')) { ST.open = null; ST.openTask = null; paintAll(); return; }
  if ((x = q('[data-run]'))) { startTask(run().tasks.find(y => y.id === x.dataset.run)); return; }
  if ((x = q('[data-approve]'))) { approve(run().tasks.find(y => y.id === x.dataset.approve)); return; }
  if ((x = q('[data-back]'))) { sendBack(run().tasks.find(y => y.id === x.dataset.back)); return; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.open) { ST.open = null; paintAll(); } if (e.target.classList && e.target.classList.contains('clarIn') && e.key === 'Enter') answer(e.target.value.trim()); });
el('composer').onsubmit = e => { e.preventDefault(); const v = el('ask').value; el('ask').value = ''; ask(v); };
el('newChat').onclick = () => { if (busyPlanning() || anyRunning()) return; UI.run = null; ST.open = null; ST.nokey = null; ST.auto = false; F.session.advisor = null; paintAll(); };

UI.requester = ME; paintAll();
initAI().then(paintAll);
window.HARNESS = { ask, answer, startTask, approve, autopilot, ST, status };
})();
