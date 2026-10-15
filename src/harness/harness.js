/* ===== Agent Harness: the business user's window onto the real pipeline =====
   Nothing here is scripted. A request goes through the same intelligence,
   orchestration, specialist agents and gatekeeper as the classic view
   (pipeline.js over engine.js). With an AI key the orchestrator and agents are
   the live model; without one, saved AI runs replay through the same tools and
   checks. This file only renders what the pipeline does, as a conversation:
   what the foundation already knew, what was assumed instead of asked, which
   context each specialist received, which systems it called, what it handed
   on and what the gatekeeper wrote back. */

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
UI.readPause = QS.has('fast') ? 0 : 1;
const initials = n => String(n).replace(/,.*$/, '').split(' ').map(x => x[0]).join('').slice(0, 2);
const first = s => String(s).split(/[ ,]/)[0];
const TCOL = t => (TEAMS[t] || {}).color || '#888';
const LAYER_COL = { memory: '#7c5cd6', knowledge: '#11a37f', policy: '#c2410c', models: '#2f6fd6', feedback: '#b7791f', events: '#d4890f', graph: '#0b7d8c' };
const SYS_COL = { sf: '#1b8ef2', m365: '#2f6fd6', seismic: '#e5533c', fund: '#11a37f', mstar: '#c0392b', gen: '#d97706', mcloud: '#0ea5e9', aem: '#9333ea', news: '#d4890f', exp: '#64748b' };
const DRAFTING = { start: 'reading the request', requester: 'checking who is asking', entity: 'resolving the advisor', intent: 'naming the business intent', asks: 'splitting the request into asks', interpretation: 'writing the interpretation', missing: 'deciding what to assume', memory: 'checking memory rules', reuse: 'looking for work to reuse', controls: 'setting controls', success: 'defining done', task: 'assigning a specialist', clarify: 'drafting a question', next: 'thinking' };
const DECISION_NAME = { requester: 'Who is asking', entity: 'Who it’s about', intent: 'Intent', asks: 'What was asked', interpretation: 'Interpretation', missing: 'Assumed instead of asking', memory: 'Memory rule', reuse: 'Reuse', controls: 'Controls', success: 'Done when', authority: 'Authority', registry: 'Registry check', lookup: 'Graph lookup', planfix: 'Plan fix' };

/* ---------- people ---------- */
let ME = 'EMP-PRIYA';
const ST = { runs: new Map(), ops: [], flash: {}, pendingAnswer: null };
const recordedFor = who => RECORDED.filter(r => r.requester === who || (EMPLOYEES[r.requester] && EMPLOYEES[r.requester].team === EMPLOYEES[who].team));
const suggestionsFor = who => AI.mode === 'live' ? (SUGGESTIONS[EMPLOYEES[who].team] || []).slice(0, 6) : [...new Set(recordedFor(who).map(r => r.text))].slice(0, 7);

/* ---------- thread ---------- */
let stick = true;
const wrap = () => document.querySelector('.thread-wrap');
function scrollDown() { if (stick) requestAnimationFrame(() => { const w = wrap(); w.scrollTop = w.scrollHeight; }); }
function addTurn(html, cls = '') { const d = document.createElement('div'); d.className = 'turn ' + cls; d.innerHTML = html; el('thread').appendChild(d); scrollDown(); return d; }
function setHTML(node, html) { if (node && node._h !== html) { node.innerHTML = html; node._h = html; return true; } return false; }
/* keyed children: new keys are appended (and animate in), existing ones update in place */
function patch(box, items) {
  const have = new Map([...box.children].map(c => [c.dataset.k, c]));
  items.forEach(it => { let c = have.get(it.k); if (!c) { c = document.createElement('div'); c.dataset.k = it.k; c.className = it.cls || ''; box.appendChild(c); } else if (it.cls && c.className !== it.cls) c.className = it.cls; setHTML(c, it.html); have.delete(it.k); });
  have.forEach(c => c.remove());
}

function welcome() {
  el('thread').innerHTML = ''; ST.runs.clear();
  const E = EMPLOYEES[ME], live = AI.mode === 'live';
  addTurn(`<div class="hello"><h1>Good morning, ${h(first(E.name))}.</h1>
    <p>Ask for an outcome in your own words. You’ll see what the shared foundation already knows, how the request is planned, which specialists take it on, what each one is given, and what comes back verified.</p>
    <div class="modebar ${live ? 'live' : 'replay'}">${live ? `<b>Live AI</b> · ${h(AI.provider || 'connected')}. The orchestrator plans and the specialists work in real time.` : AI.mode === 'checking' ? '<b>Connecting to the AI…</b>' : `<b>Replay mode.</b> No AI key on this server, so these are real AI runs replayed through the same tools, foundation and checks.`}</div>
    <div class="sugs">${suggestionsFor(ME).map(s => `<button class="sug" type="button" data-ask="${h(s)}">${h(s)}</button>`).join('') || '<p class="muted">No saved runs for this person yet. Try Priya.</p>'}</div></div>`, 'welcome');
  paintRail();
}

/* ---------- ask ---------- */
function ask(text, clarified) {
  text = String(text || '').trim(); if (!text) return;
  if (UI.run && ['thinking', 'running'].includes(UI.run.status)) { toast('Still working on the last request.'); return; }
  const rec = RECORDED.find(r => r.text === text && r.requester === ME) || RECORDED.find(r => r.text === text);
  if (AI.mode !== 'live' && !rec) {
    addTurn(`<div class="bubble">${h(text)}</div>`, 'user');
    addTurn(`<div class="arow"><span class="ava">✦</span><div class="abody"><div class="final"><p>Live AI isn’t connected on this server, so I can’t plan a new request. These saved AI runs replay through the real foundation, tools and checks:</p><div class="sugs">${suggestionsFor(ME).map(s => `<button class="sug" type="button" data-ask="${h(s)}">${h(s)}</button>`).join('')}</div></div></div></div>`, 'asst');
    return;
  }
  document.querySelector('.turn.welcome .sugs')?.remove();
  ST.pendingAnswer = clarified ? clarified.answer : null;
  if (rec && AI.mode !== 'live' && rec.requester !== ME) { ME = rec.requester; renderWho(); }
  UI.requester = ME;
  runRequest(text, AI.mode === 'live' ? null : rec, clarified ? { clarified } : {});
}

/* ---------- render the run ---------- */
let raf = 0;
HX.schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); paintRail(); }); };
function viewFor(r) {
  let v = ST.runs.get(r.id); if (v) return v;
  addTurn(`<div class="bubble">${h(ST.pendingAnswer != null ? ST.pendingAnswer : r.text)}</div>`, 'user');
  const box = addTurn(`<div class="arow"><span class="ava">✦</span><div class="abody runbody"></div></div>`, 'asst run');
  v = { r, box: box.querySelector('.runbody'), blocks: {} }; ST.runs.set(r.id, v); ST.pendingAnswer = null; return v;
}
function block(v, key, cls) { let b = v.blocks[key]; if (!b) { b = document.createElement('div'); b.className = 'blk ' + cls; v.box.appendChild(b); v.blocks[key] = b; scrollDown(); } return b; }
function paint() {
  const r = UI.run; if (!r) return;
  const v = viewFor(r);
  paintIntel(v, r);
  if (r.status === 'clarify') paintClarify(v, r);
  if (r.tasks.length && r.status !== 'clarify') paintPlan(v, r);
  r.tasks.filter(t => t.state && t.state !== 'queued').forEach(t => paintTask(v, r, t));
  if (r.status === 'done' || r.status === 'failed') paintFinal(v, r);
  scrollDown();
}

/* 1. intelligence: what the foundation knew before the model answered, then the model's reasoning */
function paintIntel(v, r) {
  const b = block(v, 'intel', 'intel');
  const B = r.bts || {}, C = B.context || {}, thinking = r.status === 'thinking';
  const lookup = r.decisions.find(d => d.type === 'lookup');
  const decs = r.decisions.filter(d => d.type !== 'lookup' && d.type !== 'interpretation');
  const I = r.interp;
  const head = `<div class="ih"><span class="lbl">Intelligence</span>${thinking ? `<span class="live"><span class="spin"></span>${B.chars ? `Orchestrator is ${h(DRAFTING[B.drafting] || 'thinking')} · ${B.chars.toLocaleString()} characters` : r.replay ? 'Replaying the orchestrator’s saved reasoning' : 'Sending the request and the foundation context to the orchestrator'}</span>` : `<span class="okc">✓ Understood${r.clarify && r.status === 'clarify' ? ', one question' : r.tasks.length ? ` · ${r.tasks.length} steps planned` : ''}</span>`}</div>`;
  const pre = `<div class="pre">
    <div class="prei"><span class="pk">Graph lookup</span><span>${lookup ? h(lookup.detail || lookup.title) : '…'}</span></div>
    <div class="prei"><span class="pk">Foundation in context</span><span>${C.memories != null ? `${C.memories} memories and notes · ${C.content} approved pieces · ${C.funds} funds · ${C.advisors} advisors · ${C.routes} specialist routes · ${C.rules} rules${B.promptChars ? ` <em class="muted">(${Math.round(B.promptChars / 1000)}k characters sent to the orchestrator)</em>` : ''}` : '…'}</span></div>
    ${(B.patterns || []).length ? `<div class="prei"><span class="pk">Similar requests</span><span>${B.patterns.slice(0, 3).map(p => `<em class="chip">#${p.n} ${h(p.intent)}</em>`).join(' ')}</span></div>` : ''}
    ${B.authority ? `<div class="prei"><span class="pk">Authority by rule</span><span>🔒 ${h((AUTHORITY[B.authority.authority] || {}).label || B.authority.authority)} <em class="muted">${h(B.authority.why || '')}</em></span></div>` : ''}
  </div>`;
  const interp = I ? `<div class="interp"><div class="ith">${h(I.title || 'What you want')}${I.intent ? ` <span class="tag">${h(I.intent)}</span>` : ''}</div><div class="kv">
    ${I.subject && I.subject.label ? `<div><small>About</small><span>${h(I.subject.label)}</span></div>` : ''}${I.scope ? `<div><small>Scope</small><span>${h(I.scope)}</span></div>` : ''}${I.time ? `<div><small>Time</small><span>${h(I.time)}</span></div>` : ''}${I.output ? `<div><small>Output</small><span>${h(I.output)}</span></div>` : ''}${I.constraints.length ? `<div><small>Constraints</small><span>${I.constraints.map(c => `<em class="chip">${h(c)}</em>`).join(' ')}</span></div>` : ''}${I.missing.length ? `<div><small>Not in the foundation</small><span>${I.missing.map(c => `<em class="chip warn">${h(c)}</em>`).join(' ')}</span></div>` : ''}
  </div></div>` : '';
  if (!b._init) { b.innerHTML = `<div class="ihead"></div><div class="ipre"></div><div class="idecs"></div><div class="iint"></div>`; b._init = 1; }
  setHTML(b.querySelector('.ihead'), head); setHTML(b.querySelector('.ipre'), pre); setHTML(b.querySelector('.iint'), interp);
  patch(b.querySelector('.idecs'), decs.map((d, k) => ({ k: 'd' + k, cls: 'dec' + (d.type === 'missing' ? ' assume' : ''), html: `<span class="src ${d.src === 'code' ? 'rule' : 'ai'}">${d.src === 'code' ? 'RULE' : 'AI'}</span><span><small>${h(DECISION_NAME[d.type] || d.type)}</small><b>${h(d.title)}</b>${d.detail ? `<em>${h(d.detail)}</em>` : ''}</span>` })));
  b.classList.toggle('settled', !thinking);
}

/* 2. a question, only when the foundation could not settle it */
function paintClarify(v, r) {
  const b = block(v, 'clar', 'clar');
  const opts = (r.clarifyOptions || []).length ? r.clarifyOptions : (r.resolution && r.resolution.candidates || []).slice(0, 3).map(c => c.name);
  setHTML(b, `<div class="qcard"><div class="qhead"><span class="qn">One question</span><span class="qhint">The foundation couldn’t settle this</span></div><div class="qt">${h(r.clarify)}</div>
    ${r.clarifyWhy ? `<p class="qwhy">${h(r.clarifyWhy)}</p>` : ''}
    <div class="opts">${opts.map((o, k) => `<button type="button" class="opt" data-answer="${h(o)}"><span class="key">${k + 1}</span><span class="ol"><b>${h(o)}</b></span><span class="go">→</span></button>`).join('')}
    <div class="other"><input type="text" class="clarIn" placeholder="Type your answer…" aria-label="Your answer"><button type="button" class="ghost sm" data-answer-input>Answer</button></div></div>
    <div class="qfoot"><button type="button" class="ghost sm" data-answer="Make your best assumption and continue">Make your best assumption</button></div></div>`);
}
function answer(v) {
  const r = UI.run; if (!r || r.status !== 'clarify' || !v) return;
  const q = r.clarify, t = r.text.replace(/ \(clarification:.*\)$/, '');
  document.querySelectorAll('.blk.clar .qcard').forEach(c => { c.classList.add('done'); c.innerHTML = `<div class="qsum"><span class="lbl">Answered</span><span class="ans">${h(v)}</span></div>`; c._h = null; });
  UI.run = null; ask(`${t} (clarification: ${v})`, { question: q, answer: v });
}

/* 3. the plan */
function paintPlan(v, r) {
  const b = block(v, 'plan', 'plan');
  const waves = [...new Set(r.tasks.map(t => t.wave))].sort((x, y) => x - y);
  const teams = new Set(r.tasks.map(t => ROLES[t.role] ? ROLES[t.role].team : AGENTS[t.agent].team));
  setHTML(b, `<div class="ph"><span class="lbl">Orchestration</span><span>${r.tasks.length} steps · ${waves.length} wave${waves.length > 1 ? 's' : ''} · ${teams.size} team${teams.size > 1 ? 's' : ''}${r.planOnly ? ' · plan only' : ''}</span>${r.authority ? `<span class="lockc">🔒 ${h(AUTHORITY[r.authority].label)}</span>` : ''}</div>
    <ol>${r.tasks.map(t => { const R = ROLES[t.role], tm = R ? R.team : AGENTS[t.agent].team; return `<li class="${t.state || 'queued'}"><span class="ck"></span><span class="tdot" style="--c:${TCOL(tm)}"></span><span class="pt"><b>${h(R ? R.name : AGENTS[t.agent].name)}</b>${t.person ? ` <small>${h(t.person)}</small>` : ''}<span class="pobj">${h(t.title)}</span></span>${t.route ? `<span class="route">${h(t.route)}</span>` : ''}${(t.services || []).slice(0, 3).map(s => `<span class="svc">[${h(s)}]</span>`).join('')}<span class="pw">W${t.wave}${t.depends_on.length ? ` · after ${t.depends_on.join(', ')}` : ''}</span></li>`; }).join('')}</ol>`);
}

/* 4. each specialist: context from the foundation, systems called, handoffs, output, gatekeeper */
const gist = out => { if (out == null) return ''; if (typeof out !== 'object') return String(out).slice(0, 60); if (Array.isArray(out)) return `${out.length} record${out.length === 1 ? '' : 's'}`; const a = Object.entries(out).find(([, x]) => Array.isArray(x) && x.length); return a ? `${a[1].length} ${a[0].replace(/_/g, ' ')}` : `${Object.keys(out).length} fields`; };
const argText = i => Object.entries(i || {}).filter(([, x]) => x !== '' && x != null).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(', ') : String(x)}`.slice(0, 40)).join(', ');
const reusedIn = (t, i) => { const rec = F.memory.find(m => m.id === i.id) || F.findings.find(k => k.id === i.id); return !!(rec && (rec.origin || rec.by) && (rec.origin || rec.by) !== t.agent); };
function bodyHTML(s) {
  const ids = x => h(x).replace(/\b([A-Z]{2,5}-[A-Z0-9]{1,6}(?:-[A-Z0-9]+)?)\b/g, '<span class="srcid">$1</span>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let html = '', list = false;
  for (const ln of String(s || '').split('\n')) { const m = ln.match(/^\s*[-•*]\s+(.*)/); if (m) { if (!list) { html += '<ul>'; list = true; } html += `<li>${ids(m[1])}</li>`; } else { if (list) { html += '</ul>'; list = false; } if (ln.trim()) html += (/^#{1,4}\s/.test(ln.trim()) || /:$/.test(ln.trim())) && ln.length < 70 ? `<h4>${ids(ln.replace(/^#+\s*/, ''))}</h4>` : `<p>${ids(ln)}</p>`; } }
  return html + (list ? '</ul>' : '');
}
const VERB = { published: 'published to shared knowledge', committed: 'committed to shared memory', pending: 'proposed, needs confirmation', rejected: 'not stored', blocked: 'blocked', read: 'read only', task: 'kept to this task only', proposed: 'proposed, waiting for you', flagged: 'flagged for a number check', approval: 'waiting for your approval' };
const VICON = { published: '↑', committed: '↑', approval: '✋', blocked: '⛔', rejected: '✕', flagged: '!', proposed: '…', pending: '…', task: '·', read: '·' };
function paintTask(v, r, t) {
  const b = block(v, 'task-' + t.id, 'task');
  const R = ROLES[t.role], tm = R ? R.team : AGENTS[t.agent].team, P = t.packet;
  if (!b._init) { b.style.setProperty('--c', TCOL(tm)); b.innerHTML = `<div class="th"></div><div class="tctx"></div><div class="tup"></div><div class="tcl-h"></div><div class="tcl"></div><div class="tout"></div><div class="tgate"></div>`; b._init = 1; }
  const waiting = (t.verdicts || []).some(x => x.kind === 'output' && (F.outputs.find(y => y.id === x.id) || {}).status === 'Waiting for approval');
  const st = t.state === 'running' ? `<span class="st live"><span class="spin"></span>${!P ? 'Assembling context' : t.result ? 'Checking' : 'Working'}</span>` : t.state === 'failed' ? `<span class="st bad">Failed</span>` : waiting ? '<span class="st warn">Waiting for approval</span>' : `<span class="st ok">✓ Done${t.t1 ? ` · ${((t.t1 - t.t0) / 1000).toFixed(0)} s` : ''}</span>`;
  setHTML(b.querySelector('.th'), `<span class="tav" style="background:${TCOL(tm)}">${t.step || ''}</span><span class="tt"><b>${h(R ? R.name : AGENTS[t.agent].name)}</b> <small>${h(TEAMS[tm].short || TEAMS[tm].name)}${t.person ? ' · ' + h(t.person) : ''} · ${h(AGENTS[t.agent].name)}</small><span class="tobj">${t.route ? `<span class="route">${h(t.route)}</span> ` : ''}${h(t.title)}</span></span>${st}`);
  /* the context packet: what the shared foundation handed this specialist */
  if (P) {
    const byL = {}; P.items.forEach(i => (byL[i.layer] = byL[i.layer] || []).push(i));
    const reused = P.items.filter(i => reusedIn(t, i)), det = b.querySelector('.tctx details'), open = det && det.open;
    const top = P.items.filter(i => i.layer !== 'policy').sort((x, y) => reusedIn(t, y) - reusedIn(t, x)).slice(0, 5), topIds = new Set(top.map(i => i.id));
    setHTML(b.querySelector('.tctx'), `<div class="sec"><span class="sk">From the shared foundation</span><span class="sv">${P.items.length} items from ${Object.keys(byL).length} layers${reused.length ? ` · <b class="reuse">${reused.length} reused from other teams</b>` : ''}${P.withheld.length ? ` · ${P.withheld.length} withheld by policy` : ''}</span></div>
      <div class="layers">${Object.entries(byL).map(([l, xs]) => `<span class="lyr" style="--c:${LAYER_COL[l] || '#888'}">${h((LAYERS[l] || {}).short || l)} <b>${xs.length}</b></span>`).join('')}</div>
      <div class="items">${top.map(i => itemHTML(t, i)).join('')}</div>
      ${P.items.length > top.length || P.withheld.length ? `<details${open ? ' open' : ''}><summary>All ${P.items.length} items${P.withheld.length ? ` and ${P.withheld.length} withheld` : ''}</summary><div class="items">${P.items.filter(i => !topIds.has(i.id)).map(i => itemHTML(t, i)).join('')}</div>${P.withheld.map(w => `<div class="item wh"><span class="srcid">${h(w.id)}</span><span>Withheld · ${h(w.why)}</span></div>`).join('')}</details>` : ''}`);
  }
  /* handoffs from earlier steps */
  const ups = t.depends_on.map(d => r.tasks.find(x => x.id === d)).filter(x => x && x.result);
  setHTML(b.querySelector('.tup'), ups.length ? `<div class="sec"><span class="sk">Builds on</span><span class="sv">${ups.map(u => `<span class="hand2" style="--c:${TCOL((ROLES[u.role] || {}).team)}">Step ${u.step} · ${h((ROLES[u.role] || {}).name || u.agent)}: ${h((u.result.output && u.result.output.title) || u.title)}</span>`).join('')}</span></div>` : '');
  /* systems: only what the foundation did not already hold */
  const calls = t.calls || [];
  setHTML(b.querySelector('.tcl-h'), P && (calls.length || t.state === 'running') ? `<div class="sec"><span class="sk">Systems called</span><span class="sv">${calls.length ? `${calls.length} call${calls.length > 1 ? 's' : ''} for what the foundation didn’t already hold` : t.state === 'running' && !t.result ? '<span class="muted">Reading the context; calling systems only for what’s missing…</span>' : 'None needed'}</span></div>` : '');
  patch(b.querySelector('.tcl'), calls.map((c, k) => ({ k: 'c' + k, cls: 'call' + (c.error ? ' err' : ''), html: `<span class="sysb" style="--c:${SYS_COL[c.sys] || '#888'}">${h((SYSTEMS[c.sys] || {}).name || c.sys || 'gateway')}</span><span class="via">${h(c.via || '')}</span><code>${h(c.name)}(${h(argText(c.input))})</code><span class="res">${c.error ? h(c.error) : `${h(gist(c.out))}${c.out && c.out.synthesized ? ' <em class="demo">DEMO</em>' : ''}`}</span>` })));
  /* output */
  const res = t.result, o = res && res.output;
  setHTML(b.querySelector('.tout'), res ? `${res.says ? `<p class="says">“${h(res.says)}”</p>` : ''}${o && o.body ? `<div class="docprev"><div class="dochead"><span class="tplbadge">${h(String(o.kind || 'output').toUpperCase())}</span><div><b>${h(o.title || '')}</b>${t.contract ? `<small>${t.contract.as_of.length ? 'As of ' + h(t.contract.as_of.join(', ')) + ' · ' : ''}${t.contract.sources.length} sources</small>` : ''}</div></div><div class="docbody">${bodyHTML(o.body)}</div>${t.contract && t.contract.unresolved.length ? `<div class="docfoot">Open: ${h(t.contract.unresolved.join(' · '))}</div>` : ''}</div>` : ''}` : t.state === 'failed' ? `<p class="bad">${h(t.error || 'Failed')}</p>` : '');
  /* gatekeeper: what was written back to the foundation */
  setHTML(b.querySelector('.tgate'), t.verdicts ? `<div class="sec"><span class="sk">Gatekeeper</span><span class="sv vds">${t.verdicts.map(x => { const out = x.kind === 'output' && F.outputs.find(y => y.id === x.id); const s = out && out.status === 'Waiting for approval' ? 'approval' : x.status; return `<span class="vd ${s}" title="${h(x.reason || '')}">${VICON[s] || '·'} ${h(x.kind)} ${h(VERB[s] || s)}${x.id ? ` <span class="srcid">${h(x.id)}</span>` : ''}${['rejected', 'blocked', 'flagged'].includes(s) && x.reason ? ` <em>${h(x.reason)}</em>` : ''}</span>`; }).join('')}</span></div>
    ${t.verdicts.filter(x => x.kind === 'output').map(x => { const out = F.outputs.find(y => y.id === x.id); return out && out.status === 'Waiting for approval' ? `<div class="acts"><button class="primary sm" type="button" data-approve="${h(out.id)}">Approve “${h(out.title)}”</button><span class="muted">Nothing is sent until you approve.</span></div>` : out && /Approved/.test(out.status) ? `<div class="note">✓ ${h(out.status)}</div>` : ''; }).join('')}` : '');
}
function itemHTML(t, i) { const re = reusedIn(t, i), val = String(i.value); return `<div class="item${re ? ' re' : ''}"><span class="lyd" style="--c:${LAYER_COL[i.layer] || '#888'}"></span><span class="srcid">${h(i.id)}</span><span><b>${h(i.label)}</b> ${h(val.slice(0, 150))}${val.length > 150 ? '…' : ''} <small>· ${h(i.from || '')}</small>${re ? ' <em class="reuse">reused</em>' : ''}</span></div>`; }

/* 5. wrap-up: what the foundation made possible, and what it kept */
function paintFinal(v, r) {
  const b = block(v, 'final', 'finalblk'), S = r.stats;
  const outs = F.outputs.filter(o => o.run === r.id), wait = outs.filter(o => o.status === 'Waiting for approval');
  setHTML(b, `<div class="final">${r.error ? `<p class="bad">${h(r.error)}</p>` : `<p>${r.tasks.length} specialist${r.tasks.length > 1 ? 's' : ''} worked from <b>${S.reads}</b> foundation items, reused <b>${S.reused}</b> piece${S.reused === 1 ? '' : 's'} of earlier work, made <b>${S.calls}</b> system call${S.calls === 1 ? '' : 's'} (${S.mcp} through MCP) and stored <b>${S.committed}</b> verified result${S.committed === 1 ? '' : 's'} back for the next person.${S.blocked ? ` The gatekeeper stopped <b>${S.blocked}</b>.` : ''}${wait.length ? ` ${wait.length} draft${wait.length > 1 ? 's wait' : ' waits'} for your approval.` : ''}</p>`}
    <div class="srcs"><span>${r.t1 ? Math.round((r.t1 - r.t0) / 1000) + ' s' : ''}${r.replay ? ' · replayed AI run' : ' · live AI'}</span>${[...new Set(r.tasks.flatMap(t => (t.calls || []).map(c => c.sys)).filter(Boolean))].map(k => `<span class="sysb" style="--c:${SYS_COL[k]}">${h(SYSTEMS[k].name)}</span>`).join('')}</div></div>`);
}

/* ---------- right rail: the shared foundation, live ---------- */
HX.op = o => { ST.ops.push(Object.assign({ at: performance.now() }, o)); if (o.kind === 'call' && o.sys) ST.flash['s:' + o.sys] = performance.now(); HX.schedule(); setTimeout(HX.schedule, 1600); };
HX.flash = (l, cls) => { ST.flash['l:' + l] = { at: performance.now(), cls }; HX.schedule(); setTimeout(HX.schedule, 1500); };
function paintRail() {
  const now = performance.now(), r = UI.run, hot = k => { const f = ST.flash[k]; if (!f) return ''; const at = typeof f === 'number' ? f : f.at; return now - at < 1400 ? (f.cls || 'hot') : ''; };
  const S = r ? r.stats : null;
  const recent = ST.ops.filter(o => ['read', 'call', 'handoff', 'write'].includes(o.kind)).slice(-8).reverse();
  setHTML(el('rail'), `<div class="rblock"><div class="rh">Shared foundation <small>${r ? (r.status === 'done' ? 'run complete' : r.status) : 'ready'}</small></div>
      ${LAYER_ORDER.map(l => `<div class="rlyr ${hot('l:' + l)}" style="--c:${LAYER_COL[l] || '#888'}"><i></i><span><b>${h(LAYERS[l].name)}</b></span><em>${layerCount(l)}</em></div>`).join('')}</div>
    ${S ? `<div class="rblock"><div class="rh">This request</div><div class="rstats"><div><b>${S.reads}</b><small>foundation items read</small></div><div><b>${S.reused}</b><small>reused</small></div><div><b>${S.calls}</b><small>system calls</small></div><div><b>${S.committed}</b><small>stored back</small></div></div></div>` : ''}
    <div class="rblock"><div class="rh">Live activity</div>${recent.length ? recent.map(o => `<div class="ract ${o.kind}" style="--c:${o.kind === 'call' ? SYS_COL[o.sys] || '#888' : LAYER_COL[o.layer] || '#888'}"><b>${o.kind === 'read' ? 'Read' : o.kind === 'write' ? 'Wrote' : o.kind === 'call' ? 'Called' : 'Handoff'}</b> ${h(o.kind === 'call' ? (SYSTEMS[o.sys] || {}).name || o.sys : o.kind === 'handoff' ? `${(AGENTS[o.from] || {}).name || o.from} → ${(AGENTS[o.agent] || {}).name || o.agent}` : (LAYERS[o.layer] || {}).name || o.layer)}<small>${h(o.kind === 'handoff' ? 'through the foundation' : (AGENTS[o.agent] || {}).name || '')}</small></div>`).join('') : '<p class="rempty">Reads, calls, handoffs and write-backs appear here as they happen.</p>'}</div>
    <div class="rblock"><div class="rh">Systems</div>${SYS_ORDER.map(k => { const n = r ? r.tasks.reduce((m, t) => m + (t.calls || []).filter(c => c.sys === k).length, 0) : 0; return `<div class="rsys ${hot('s:' + k) ? 'reading' : n ? 'done' : ''}" style="--c:${SYS_COL[k]}"><i>${h(SYSTEMS[k].name.slice(0, 2))}</i><span><b>${h(SYSTEMS[k].name)}</b><small>${h(SYSTEMS[k].sub)}</small></span><em>${n || ''}</em></div>`; }).join('')}</div>
    ${F.session && F.session.advisor ? `<div class="rblock"><div class="rh">Carried in this conversation</div><p class="rctl">${h(ADVISORS[F.session.advisor].name)}. Follow-ups can just say “her” or “them”.</p></div>` : ''}`);
}

/* ---------- chrome ---------- */
let tt; HX.toast = m => { let t = el('hxToast'); if (!t) { t = document.createElement('div'); t.id = 'hxToast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3200); };
HX.ai = () => { el('modeTag').textContent = AI.mode === 'live' ? `Live AI · ${AI.provider || ''}` : AI.mode === 'checking' ? 'Connecting…' : 'Replay mode: saved AI runs'; };
const busy = () => !!(UI.run && ['thinking', 'running'].includes(UI.run.status));
setInterval(() => { el('send').disabled = busy(); document.body.classList.toggle('busy', busy()); }, 300);
function renderWho() { el('who').innerHTML = Object.keys(EMPLOYEES).map(id => { const e = EMPLOYEES[id]; return `<button type="button" class="wchip${id === ME ? ' on' : ''}" data-who="${id}" style="--c:${TEAMS[e.team].color}"><i>${h(initials(e.name))}</i><span>${h(e.name)}</span></button>`; }).join(''); }
document.addEventListener('click', e => {
  const s = e.target.closest('[data-ask]'); if (s) { ask(s.dataset.ask); return; }
  const a = e.target.closest('[data-answer]'); if (a) { answer(a.dataset.answer); return; }
  if (e.target.closest('[data-answer-input]')) { answer(e.target.closest('.qcard').querySelector('.clarIn').value.trim()); return; }
  const ap = e.target.closest('[data-approve]'); if (ap) { const o = F.outputs.find(x => x.id === ap.dataset.approve); if (o) { o.status = 'Approved by ' + EMPLOYEES[ME].name + ' · ready to send'; logEvent('approval.granted', o.title, ME, o.adv); flashTile('policy', 'write'); [...ST.runs.values()].forEach(v => Object.values(v.blocks).forEach(b => { b._h = null; })); HX.schedule(); } return; }
  const w = e.target.closest('[data-who]'); if (w && !busy()) { ME = w.dataset.who; UI.requester = ME; renderWho(); UI.run = null; welcome(); }
});
document.addEventListener('keydown', e => { if (e.target.classList && e.target.classList.contains('clarIn') && e.key === 'Enter') { e.preventDefault(); answer(e.target.value.trim()); } else if (/^[1-4]$/.test(e.key) && !/TEXTAREA|INPUT/.test(document.activeElement.tagName)) { const o = document.querySelectorAll('.blk.clar .qcard:not(.done) .opt')[+e.key - 1]; if (o) answer(o.dataset.answer); } });
el('newChat').onclick = () => { if (!busy()) { UI.run = null; F.session.advisor = null; welcome(); } };
el('composer').onsubmit = e => { e.preventDefault(); const v = el('ask').value; el('ask').value = ''; autosize(); ask(v); };
const autosize = () => { const t = el('ask'); t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; };
el('ask').addEventListener('input', autosize);
el('ask').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el('composer').requestSubmit(); } });
wrap().addEventListener('scroll', () => { const w = wrap(); stick = w.scrollHeight - w.scrollTop - w.clientHeight < 140; });

UI.requester = ME; renderWho(); welcome(); HX.ai();
initAI().then(() => { HX.ai(); welcome(); });
window.HARNESS = { ask, answer, ST };
})();
