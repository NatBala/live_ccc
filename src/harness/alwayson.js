/* ---------- Always-on: Intelligence listens to advisor activity and decides ----------
   The engine is signals.js. This view plays the event stream on a simulated
   clock: each event lands in the activity feed and updates that advisor's
   profile on the radar. When one calls for a decision, the decision card shows
   how Intelligence weighed the options (Sales Alpha, Digital Alpha, capacity,
   guardrails). A decision that needs work becomes a work order, and in the demo
   it runs on its own, visibly, through the same orchestration canvas. */
const AO = { playing: false, speed: 1, auto: true, feed: [], cur: null, phase: 0, active: null, peek: false, done: false, count: 0, wait: null, started: false, base: SLEEP_SCALE, flash: {} };
ST.mode = ['ask', 'advisors'].includes(QS.get('mode')) ? QS.get('mode') : 'always';
const inAO = () => ST.mode === 'always' || ST.mode === 'advisors';
const SGS = SIGNALS.S;
SIGNALS.reset();
const ACT = { visit: ['users', 'In-person visit'], call: ['msg', 'Internal call'], campaign: ['mail', 'Digital follow-up'], journey: ['send', 'Digital journey'], service: ['tool', 'Fix first'], hold: ['pause', 'Hold'],
  explain: ['doc', 'Product explanation'], platform: ['layers', 'Platform availability check'], flows: ['chart', 'Flow diagnosis'], changed: ['clock', 'What changed since we last met'], social: ['globe', 'Social post'], trends: ['pulse', 'Territory trends'] };
const WO_ST = { decided: ['ready', 'Decided'], waiting: ['review', 'Waiting for owner'], running: ['running', 'Running'], done: ['approved', 'Done'], held: ['blocked', 'Held'], enrolled: ['approved', 'Enrolled'], 'needs-ai': ['signoff', 'Needs live AI'], dismissed: ['blocked', 'Dismissed'], failed: ['failed', 'Failed'] };
const SIG_ICON = { aem: 'eye', mcloud: 'mail', seismic: 'doc', sf: 'users', gen: 'bell', fund: 'chart', news: 'globe' };
const advShort = a => a ? ADVISORS[a].name.replace(/,.*$/, '') : 'All advisors';
const simDay = t => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const simTime = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace('AM', 'a.m.').replace('PM', 'p.m.');
const pace = ms => new Promise(r => setTimeout(r, ms / AO.speed * (AO.base < 1 ? 0.15 : 1)));
const boardShown = () => inAO() && (!AO.active || AO.peek) && !AO.viewing;
const firmShort = f => FIRMS[f].name.replace(/ Wealth Management| Advisors| \(RIA\)/, '');
const ownerName = wo => wo.owner ? EMPLOYEES[wo.owner].name : 'Intelligence';

/* ---- the loop ---- */
async function play() {
  if (AO.playing) return; if (AO.done) resetAO();
  AO.playing = true; AO.started = true; paintAll();
  while (AO.playing) {
    if (AO.active || AO.wait) { await pace(300); continue; }
    const r = SIGNALS.step();
    if (!r) { AO.playing = false; AO.done = true; toast('Caught up: every event to today has been handled.'); break; }
    AO.feed.unshift(r); AO.feed = AO.feed.slice(0, 60);
    if (r.e.adv) AO.flash[r.e.adv] = performance.now();
    logEvent('signal.' + r.e.type, `${advShort(r.e.adv)}: ${r.e.what}`, 'always-on', r.e.adv);
    flashTile('events', 'read');
    paintAll();
    if (r.wo) await handle(r.wo);
    await pace(r.e.adv ? 1500 : 900);
  }
  paintAll();
}
function pause() { AO.playing = false; paintAll(); }
function resetAO() {
  if (AO.active) return;
  SIGNALS.reset(); Object.assign(AO, { playing: false, feed: [], cur: null, phase: 0, done: false, count: 0, wait: null, started: false, flash: {}, viewing: null });
  paintAll();
}
/* how Intelligence reached it, one step at a time, then what happens next */
async function handle(wo) {
  AO.cur = wo; AO.phase = 0; paintAll();
  for (let k = 1; k <= 5; k++) { await pace(420); if (AO.cur !== wo) return; AO.phase = k; paintAll(); }
  logEvent('nba.decided', `${wo.id} ${SIGNALS.actName(wo.action)} for ${advShort(wo.adv)}`, 'always-on', wo.adv);
  if (wo.action === 'hold') { wo.status = 'held'; paintAll(); await pace(2600); return; }
  if (wo.action === 'journey') { wo.status = 'enrolled'; wo.outcome = `Enrolled in the ${(wo.I.topics[0] || { name: 'general' }).name.toLowerCase()} nurture track (pre-approved)`; paintAll(); await pace(2800); return; }
  if (!AO.auto) {
    wo.status = 'waiting'; paintAll();
    const ok = await new Promise(res => { AO.wait = { wo, res }; });
    AO.wait = null;
    if (!ok) { wo.status = 'dismissed'; SIGNALS.release(wo); logEvent('nba.dismissed', `${wo.id} dismissed by ${ownerName(wo)}`, 'always-on', wo.adv); paintAll(); await pace(900); return; }
  } else {
    for (AO.count = 3; AO.count > 0; AO.count--) { paintAll(); await pace(1000); if (AO.cur !== wo) break; }
    AO.count = 0;
  }
  await runWO(wo);
}
const until = async (f, ms = 180000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise(r => setTimeout(r, 150)); } return true; };
async function runWO(wo) {
  const live = AI.mode === 'live', rp = live ? null : wo.replay;
  if (!live && !rp) { wo.status = 'needs-ai'; wo.outcome = 'Work order ready. Running it needs live AI: there is no saved AI run for this one.'; paintAll(); await pace(3200); SIGNALS.after(wo, SGS.now); return; }
  const r = await execWO(wo, true);
  wo.run = r; wo.status = r && r.status === 'done' ? 'done' : 'failed';
  wo.outcome = r ? outcomeOf(r) : 'Did not start';
  if (r && r.status === 'done') { ST.view = 'results'; ST.open = null; paintAll(); await pace(5200); }
  ST.view = 'floor'; AO.active = null; paintAll();
  const next = SIGNALS.after(wo, SGS.now + 20 * 60000);
  if (next) { AO.feed.unshift({ e: null, outcome: 'decision', wo: next, note: `Looked again after ${wo.id}` }); paintAll(); await handle(next); }
}
/* hand a work order to Intelligence: plan it, run every ticket, wait for the result */
async function execWO(wo, autoSign) {
  const live = AI.mode === 'live', rp = live ? null : wo.replay;
  wo.status = 'running'; AO.active = wo; AO.peek = false; AO.viewing = null;
  ME = rp ? rp.requester : wo.owner;
  ask(rp ? rp.text : wo.text, null, wo);
  let r = null;
  await until(() => (r = run()) && ['planned', 'clarify', 'failed', 'done'].includes(r.status), 120000);
  if (r && r.status === 'clarify' && live) { answer('Make your best assumption and continue'); await until(() => (r = run()) && ['planned', 'failed', 'done'].includes(r.status), 120000); }
  if (r && r.status === 'planned') {
    await sleep(1800);
    await runAll();
    if (autoSign) r.tasks.forEach(t => outputsOf(t).filter(o => o.status === 'Waiting for approval').forEach(o => signOff(o, `${EMPLOYEES[ME].name}, auto-approved under the demo policy`)));
    await until(() => r.status === 'done' || r.status === 'failed', 30000);
  }
  return r;
}
function outcomeOf(r) {
  const acts = r.tasks.flatMap(t => (t.calls || []).filter(c => c.rw === 'write' && !c.error).map(c => actionTile(c, t))).filter(Boolean);
  const docs = r.tasks.filter(t => t.result && t.result.output && t.result.output.title).map(t => t.result.output.title);
  const bits = acts.slice(0, 2).map(a => a.kind + (a.big ? ': ' + a.big : '')).concat(docs.slice(0, 2));
  return bits.length ? bits.join(' · ') : `${r.tasks.length} tickets complete`;
}

/* ---- painting ---- */
function paintAO() {
  document.body.classList.toggle('aon', inAO());
  document.body.classList.toggle('aoboard', boardShown());
  el('composer').hidden = inAO();
  setHTML(el('modes'), [['always', 'pulse', 'Live signals'], ['advisors', 'users', 'Advisors'], ['ask', 'send', 'Ask']].map(([m, ic, l]) => `<button type="button" class="${ST.mode === m ? 'on' : ''}" data-mode="${m}">${I(ic, 14)} ${l}</button>`).join(''));
  el('newChat').hidden = inAO();
  paintCtl();
  const show = boardShown();
  el('sig').hidden = !(show && ST.mode === 'always'); el('advx').hidden = !(show && ST.mode === 'advisors'); el('orch').hidden = show; el('floor').hidden = show;
  if (!show) return false;
  el('bench').hidden = true;
  if (ST.mode === 'always') paintBoard(); else paintAdvisors();
  return true;
}
function paintCtl() {
  const box = el('aoctl'); box.hidden = !inAO(); if (box.hidden) return;
  const n = SGS.events.length - SGS.history, at = Math.max(0, SGS.cursor - SGS.history), wo = AO.active || AO.viewing;
  if (wo && !AO.peek) {
    const A = wo.adv && ADVISORS[wo.adv], [ic, nm] = ACT[wo.action], back = wo.explorer ? (A ? advShort(wo.adv) : 'Advisors') : 'Signals board';
    setHTML(box, `<div class="aostrip"><span class="aobolt">${I(wo.explorer ? 'users' : 'pulse', 14)}</span><span class="aoct"><small>${AO.viewing ? 'Work order · done' : wo.explorer ? 'Running an advisor action' : 'Running a work order from Always-on'}</small><b><code>${wo.id}</code> ${I(ic, 13)} ${h(nm)} · ${A ? `${h(advShort(wo.adv))} <span class="muted">(${h(firmShort(A.firm))})</span>` : 'Southern California'}</b></span>${wo.replay && AI.mode !== 'live' ? `<span class="aorp" title="No live AI here, so the saved AI run of an equivalent request plays">${I('play', 11)} Saved run: “${h(wo.replay.text.slice(0, 48))}${wo.replay.text.length > 48 ? '…' : ''}”</span>` : ''}<button type="button" class="btn sm" data-aoboard>${I(wo.explorer ? 'arrow' : 'target', 13)} ${wo.explorer ? 'Back to ' + h(back) : h(back)}</button></div>`);
    return;
  }
  if (ST.mode === 'advisors') { setHTML(box, `<div class="aoclock"><span class="aolive">${I('users', 12)} Advisor view</span><b>As of ${h(simDay(AOX().S.now))}</b><span>${h(AOX().S.events.filter(e => e.adv).length)} events since Jul 1 from ${new Set(AOX().S.events.map(e => SIG_TYPES[e.type].sys)).size} sources</span></div>`); return; }
  setHTML(box, `<div class="aoclock"><span class="aolive${AO.playing ? ' on' : ''}"><i></i>${AO.playing ? 'Listening' : AO.done ? 'Caught up' : 'Paused'}</span><b>${h(simDay(SGS.now))}</b><span>${h(simTime(SGS.now))}</span><span class="aoprog"><i style="width:${n ? at / n * 100 : 0}%"></i></span><small>${at}/${n} events</small></div>
    <div class="aobtns">${AO.playing ? `<button type="button" class="btn sm" data-aopause>${I('pause', 13)} Pause</button>` : `<button type="button" class="btn primary sm" data-aoplay>${I('play', 13)} ${AO.done ? 'Replay' : AO.started ? 'Resume' : 'Start listening'}</button>`}
      <div class="seg sm">${[1, 2, 4].map(x => `<button type="button" class="${AO.speed === x ? 'on' : ''}" data-aospeed="${x}">${x}×</button>`).join('')}</div>
      <button type="button" class="tgl${AO.auto ? ' on' : ''}" data-aoauto title="On: work orders run on their own and you watch (demo). Off: each decision waits for its owner to accept (production)."><i></i>Auto-run</button>
      ${AO.active && AO.peek ? `<button type="button" class="btn sm" data-aorun>${I('branch', 13)} Watch ${AO.active.id}</button>` : ''}
      <button type="button" class="btn subtle sm" data-aoreset title="Start the stream again" ${AO.active ? 'disabled' : ''}>${I('undo', 13)}</button></div>`);
}
function paintBoard() {
  const sig = el('sig');
  if (!sig._init) {
    sig.innerHTML = `<section class="sgcol sgfeed"><div class="sgh">${I('pulse', 14)}<b>Live advisor activity</b><small id="sgn"></small></div><div class="evl" id="evl"></div></section>
      <section class="sgmid"><div class="radar" id="radar"></div><section class="dec" id="dec"><div class="dc-main"></div><div class="dc-foot"></div></section></section>
      <section class="sgcol sgside"><div id="cap"></div><div class="sgh">${I('inbox', 14)}<b>Work orders</b><small id="won"></small></div><div class="wol" id="wol"></div><div id="lis"></div></section>`;
    sig._init = 1;
  }
  paintFeedAO(); paintRadar(); paintDecision(); paintSide();
}
function evIcon(e) { return SIG_ICON[SIG_TYPES[e.type].sys] || 'db'; }
const OUT_TAG = { profile: ['', 'Profile updated'], decision: ['od', 'Decision'], held: ['oh', 'Held'], covered: ['oc', 'Already covered'] };
function paintFeedAO() {
  const items = AO.feed.slice(0, 18);
  el('sgn').textContent = AO.feed.length ? `${AO.feed.length} events` : '';
  setHTML(el('evl'), items.length ? items.map((r, i) => {
    if (!r.e) return `<div class="ev re${i === 0 ? ' new' : ''}"><span class="evs" style="--c:var(--pri)">${I('branch', 13)}</span><div><div class="evh"><b>${h(HUB)}</b><span>Re-evaluated</span></div><p>${h(advShort(r.wo.adv))}: ${h(r.note)}</p><small><span class="otag od">${I('arrow', 10)} ${h(r.wo.id)} · ${h(SIGNALS.actName(r.wo.action))}</span></small></div></div>`;
    const e = r.e, T = SIG_TYPES[e.type], [cls, lbl] = OUT_TAG[r.outcome] || OUT_TAG.profile;
    return `<div class="ev ${T.strength}${i === 0 ? ' new' : ''}"><span class="evs" style="--c:${SYS_COL[T.sys] || '#64748b'}">${I(evIcon(e), 13)}</span><div><div class="evh"><b>${h(advShort(e.adv))}</b><span>${h(T.label)}</span><time>${h(simDay(e.t).replace(/^\w+, /, ''))} · ${h(simTime(e.t))}</time></div><p>${h(e.what)}</p><small><span class="src">${h(e.src)}</span><span class="str ${T.strength}">${h(T.strength === 'info' ? 'context' : T.strength)}</span>${r.wo ? `<span class="otag ${cls}">${I('arrow', 10)} ${h(r.wo.id)} · ${h(SIGNALS.actName(r.wo.action))}</span>` : `<span class="otag ${cls}">${h(r.outcome === 'covered' ? r.note : r.note || lbl)}</span>`}</small></div></div>`;
  }).join('') : `<div class="evempty">${I('pulse', 22)}<b>Waiting for activity</b><span>Events from ${new Set(Object.values(SIG_TYPES).map(t => t.sys)).size} connected systems stream in here: web visits, email, content views, calls, service contacts, daily transactions, dealer platforms and news.</span></div>`);
}
const lastWO = adv => SGS.wos.filter(w => w.adv === adv).slice(-1)[0];
function advState(adv) {
  const w = lastWO(adv), I0 = SIGNALS.intentOf(SGS.prof[adv], SGS.now);
  if (w && w.status === 'running') return ['running', 'Running ' + w.id];
  if (w && AO.cur === w && !['done', 'held', 'enrolled', 'dismissed', 'needs-ai', 'failed'].includes(w.status)) return ['review', 'Deciding'];
  if (w && w.status === 'held') return ['blocked', 'Held'];
  if (w && ['done', 'enrolled', 'needs-ai', 'waiting', 'decided'].includes(w.status)) return [w.status === 'needs-ai' ? 'signoff' : 'approved', ACT[w.action][1]];
  if (I0.total >= 3) return ['ready', 'Warming'];
  return ['idle', 'Watching'];
}
function paintRadar() {
  const box = el('radar');
  if (!box._init) {
    box.innerHTML = `<div class="rh"><span>Advisor</span><span title="Weighted signals; each halves every 14 days. A decision is considered at 5.">Interest <small>threshold 5</small></span><span title="Sales Alpha: incremental sales from one in-person visit">Sales α/visit</span><span title="Digital Alpha: incremental sales from one digital engagement">Digital α</span><span>Last contact</span><span>State</span></div>` +
      Object.keys(ADVISORS).map(a => `<div class="rrow" data-adv="${a}" title="Open ${h(advShort(a))}’s full picture"><span class="rname">${avatar(ADVISORS[a].name, 'sales', 28)}<span class="rnt"><b>${h(advShort(a))}</b><small>${h(firmShort(ADVISORS[a].firm))} · ${h(TERRITORIES[ADVISORS[a].territory].name)}</small></span></span><span class="rint"><span class="ibar"><i class="fill"></i><i class="thr"></i></span><span class="rtps"></span></span><span class="rsa"></span><span class="rda"></span><span class="rlt"></span><span class="rsb"></span></div>`).join('');
    box._init = 1;
    /* a finished highlight must not replay when the board is shown again */
    box.addEventListener('animationend', e => e.target.classList.remove('ping'));
  }
  const now = performance.now();
  Object.keys(ADVISORS).forEach(a => {
    const row = box.querySelector(`[data-adv="${a}"]`), p = SGS.prof[a], I0 = SIGNALS.intentOf(p, SGS.now), al = VISIT_ALPHA[a], [sc, sl] = advState(a);
    row.querySelector('.fill').style.width = Math.min(100, I0.total / 10 * 100) + '%';
    row.querySelector('.fill').className = 'fill' + (I0.total >= 5 ? ' hot' : I0.total >= 3 ? ' warm' : '');
    setHTML(row.querySelector('.rtps'), I0.topics.slice(0, 2).map(x => `<span>${h(x.name)}</span>`).join('') + `<b>${I0.total.toFixed(1)}</b>`);
    setHTML(row.querySelector('.rsa'), `<b>${SIGNALS.fmtK(al.sales)}</b>`);
    setHTML(row.querySelector('.rda'), `${SIGNALS.fmtK(al.digital)}`);
    setHTML(row.querySelector('.rlt'), p.touch ? `${Math.max(0, Math.floor((SGS.now - p.touch.t) / SIGNALS.DAY))}d${p.touch.by ? ' · ' + h(first(EMPLOYEES[p.touch.by].name)) : ''}` : '<span class="muted">–</span>');
    setHTML(row.querySelector('.rsb'), `<span class="badge ${sc}">${h(sl)}</span>`);
    row.classList.toggle('cur', !!(AO.cur && AO.cur.adv === a));
    const f = AO.flash[a]; if (f && now - f < 120) { row.classList.remove('ping'); void row.offsetWidth; row.classList.add('ping'); }
  });
}
const STEPS = ['Profile', 'Trigger', 'Options', 'Guardrails', 'Decision'];
function paintDecision() {
  const box = el('dec'), main = box.querySelector('.dc-main'), foot = box.querySelector('.dc-foot'), wo = AO.cur;
  if (!wo) {
    box.className = 'dec empty';
    setHTML(main, `<div class="dempty"><span class="dorb">${I('branch', 22)}</span><h3>${h(HUB)} is ${AO.playing ? 'listening' : 'ready to listen'}</h3><p>Every event updates an advisor’s profile. Most stop there. A strong signal, or enough weaker ones together, asks ${h(HUB)} for the next best action.</p>
      <div class="dlegend"><div><b>Sales Alpha</b><span>incremental sales from one in-person visit</span></div><div><b>Digital Alpha</b><span>incremental sales from one digital engagement</span></div><div><b>Capacity</b><span>200 visits a quarter; a new visit has to beat the least valuable one booked</span></div><div><b>Guardrails</b><span>fix friction first, contact cool-off, planned follow-ups, firm rules, approved content</span></div></div>
      ${!AO.started ? `<button type="button" class="btn primary lg" data-aoplay>${I('play', 15)} Start listening</button>` : ''}</div>`);
    setHTML(foot, ''); return;
  }
  const A = ADVISORS[wo.adv], [ic, nm] = ACT[wo.action], ph = AO.phase, max = Math.max(1, ...wo.options.map(o => o.value || 0));
  box.className = `dec a-${wo.action} ph${ph}`;
  const ev = wo.evidence.slice(0, 4);
  setHTML(main, `<header class="dch"><span class="dci">${I(ic, 20)}</span><div class="dct"><small><code>${h(wo.id)}</code> · ${h(simDay(wo.at))}, ${h(simTime(wo.at))}${wo.followsUp ? ` · after ${h(wo.followsUp)}` : ''}</small><h3>${ph >= 5 ? h(nm) : 'Deciding…'} <span>· ${h(advShort(wo.adv))}</span></h3><p>${ph >= 5 ? h(wo.why) : `${h(A.title)}, ${h(FIRMS[A.firm].name)}`}</p></div>
      <ol class="steps">${STEPS.map((s, i) => `<li class="${ph > i ? 'ok' : ph === i ? 'now' : ''}"><i>${ph > i ? I('check', 10) : ph === i ? '<span class="spin"></span>' : ''}</i>${h(s)}</li>`).join('')}</ol></header>
    <div class="dcb">
      <div class="dwhy"><div class="sh">Why now</div>${ev.map(e => `<div class="dwy"><span class="evs sm" style="--c:${SYS_COL[SIG_TYPES[e.type].sys] || '#64748b'}">${I(evIcon(e), 11)}</span><div><b>${h(SIG_TYPES[e.type].label)}</b> <time>${h(SIGNALS.dstr(e.t))}</time><p>${h(e.what)}</p></div></div>`).join('')}
        <div class="dctx">${wo.options.some(o => o.action === 'hold' && !o.chosen) ? '<span class="tag rule">Hold: $0, also weighed</span>' : ''}<span class="tag">${h(wo.U.why)}</span>${wo.I.topics.slice(0, 2).map(x => `<span class="tag rule">${h(x.name)} ${x.v.toFixed(1)}</span>`).join('')}</div></div>
      <div class="opts${ph >= 3 ? ' on' : ''}${ph === 3 ? ' grow' : ''}"><div class="sh">Options weighed <small>incremental sales, $K</small></div>${wo.options.filter(o => o.action !== 'hold' || o.chosen).map(o => `<div class="op${o.chosen && ph >= 5 ? ' win' : ''}${o.ok ? '' : ' no'}"><div class="oph"><b>${I(ACT[o.action][0], 12)} ${h(o.label)}</b><span>${o.value == null ? '' : SIGNALS.fmtK(o.value)}</span></div><div class="obar"><i style="width:${o.value == null ? 100 : Math.max(2, o.value / max * 100)}%"></i>${o.action === 'visit' && o.cutoff != null && o.cutoff <= max ? `<em style="left:${o.cutoff / max * 100}%" title="Capacity cut-off ${SIGNALS.fmtK(o.cutoff)}: the least valuable booked visit"></em>` : ''}</div><small>${h(o.note)}</small>${o.formula && o.chosen && ph >= 5 ? `<small class="fx">${h(o.formula)}</small>` : ''}</div>`).join('')}</div>
    </div>
    <div class="grd${ph >= 4 ? ' on' : ''}">${wo.guards.map(g => `<span class="gd ${g.ok ? 'ok' : 'no'}" title="${h(g.note)}">${I(g.ok ? 'check' : 'x', 11)}<b>${h(g.k)}</b><small>${h(g.note)}</small></span>`).join('')}</div>`);
  /* the footer changes every second during the countdown, so it is painted on its own */
  let f = '';
  if (ph < 5) f = `<span class="busy"><span class="spin"></span> ${h(STEPS[Math.min(ph, 4)])}…</span>`;
  else if (wo.status === 'held') f = `<span class="fo held">${I('pause', 14)}<b>Held.</b> ${h(HUB)} keeps watching ${h(advShort(wo.adv))}; the next strong signal is looked at again.</span>`;
  else if (wo.status === 'enrolled') f = `<span class="fo ok">${I('check', 14)}<b>Done.</b> ${h(wo.outcome)}. No agents needed.</span>`;
  else if (wo.status === 'needs-ai') f = `<span class="fo warn">${I('alert', 14)}<b>${h(wo.outcome)}</b></span>${woOwner(wo)}`;
  else if (wo.status === 'waiting') f = `${woOwner(wo)}<span class="wtxt">${h(wo.text)}</span><button type="button" class="btn subtle" data-aodismiss>${I('x', 13)} Dismiss</button><button type="button" class="btn primary" data-aoaccept>${I('check', 13)} Accept and run</button>`;
  else if (wo.status === 'running') f = `${woOwner(wo)}<span class="busy"><span class="spin"></span> Running on the orchestration canvas</span><button type="button" class="btn primary sm" data-aorun>${I('branch', 13)} Watch</button>`;
  else if (wo.status === 'done' || wo.status === 'failed') f = `${woOwner(wo)}<span class="fo ${wo.status === 'done' ? 'ok' : 'warn'}">${I(wo.status === 'done' ? 'check' : 'alert', 14)}${h(wo.outcome)}</span>${wo.run ? `<button type="button" class="btn sm" data-aoview="${h(wo.id)}">${I('doc', 13)} Results</button>` : ''}`;
  else if (wo.needsWork && AO.count) f = `${woOwner(wo)}<span class="wtxt">${h(wo.text)}</span><span class="cd"><i style="animation-duration:${3 / AO.speed}s"></i><b>Auto-run in ${AO.count}</b><small>demo policy</small></span>`;
  else f = woOwner(wo);
  foot.className = 'dc-foot' + (ph >= 5 ? ' on' : '');
  setHTML(foot, f);
}
function woOwner(wo) {
  if (!wo.owner) return '';
  const E = EMPLOYEES[wo.owner];
  return `<span class="own">${avatar(E.name, E.team, 26)}<span class="ownt"><small>Owner · by ${h(SIGNALS.dstr(wo.due))}</small><b>${h(E.name)}</b></span></span>`;
}
function paintSide() {
  const c = SGS.cap['EMP-PRIYA'], open = c.slots - c.booked, mine = SGS.wos.filter(w => w.action === 'visit' && !['dismissed'].includes(w.status));
  const segs = Array.from({ length: c.slots }, (_, i) => i < c.slots - (open + mine.filter(w => !w.bumped).length) ? 'b' : i < c.slots - open ? 'n' : 'o');
  const sam = SGS.cap['EMP-SAM'];
  setHTML(el('cap'), `<div class="capc"><div class="caph">${avatar('Priya Shah', 'sales', 26)}<div><b>Priya Shah · visits</b><small>${c.perQuarter} a quarter ≈ ${c.perWeek} a week · ${h(c.window)}</small></div><span class="capn"><b>${open}</b><small>open</small></span></div>
      <div class="slots">${segs.map(x => `<i class="${x}"></i>`).join('')}</div>
      <div class="capl"><span><i class="b"></i>Booked</span><span><i class="n"></i>Booked by ${h(HUB)}</span><span><i class="o"></i>Open</span></div>
      <p class="cut">${open > 0 ? `${open} slot${open > 1 ? 's' : ''} left. When full, a new visit must beat <b>${SIGNALS.fmtK(c.bookedLow[0].value)}</b>, the least valuable booked visit.` : `Full. Cut-off now <b>${SIGNALS.fmtK(c.bookedLow[0] ? c.bookedLow[0].value : 0)}</b>${mine.some(w => w.bumped) ? `; ${mine.filter(w => w.bumped).map(w => `${h(w.bumped.what)} moved to digital`).join(', ')}` : ''}.`}</p></div>
    <div class="capc sm"><div class="caph">${avatar('Sam Lee', 'sales', 22)}<div><b>Sam Lee · internal desk</b><small>${sam.perWeek - sam.booked} call slots this week · no internal model yet, so a call is valued at 35% of a visit</small></div></div></div>`);
  el('won').textContent = SGS.wos.length ? `${SGS.wos.filter(w => w.action !== 'hold').length} decided · ${SGS.wos.filter(w => w.action === 'hold').length} held` : '';
  setHTML(el('wol'), SGS.wos.length ? SGS.wos.slice().reverse().map(w => { const [ic, nm] = ACT[w.action], [bc, bl] = WO_ST[w.status] || WO_ST.decided; return `<button type="button" class="wo${AO.cur === w ? ' sel' : ''}" data-aowo="${h(w.id)}"><span class="woi a-${w.action}">${I(ic, 13)}</span><span class="wob"><b>${h(nm)} · ${h(advShort(w.adv))}</b><small><code>${h(w.id)}</code> ${w.owner ? h(first(EMPLOYEES[w.owner].name)) : h(HUB)}${w.value ? ' · ' + SIGNALS.fmtK(w.value) : ''}${w.outcome && ['done', 'enrolled'].includes(w.status) ? ' · ' + h(w.outcome.slice(0, 46)) + (w.outcome.length > 46 ? '…' : '') : ''}</small></span><span class="badge ${bc}">${h(bl)}</span></button>`; }).join('') : `<p class="muted sm">Decisions that need work become work orders here: an owner, a deadline, and the request ${h(HUB)} plans and runs.</p>`);
  const cnt = {}; AO.feed.forEach(r => { if (r.e) { const k = SIG_TYPES[r.e.type].sys; cnt[k] = (cnt[k] || 0) + 1; } });
  const sys = ['aem', 'mcloud', 'seismic', 'sf', 'gen', 'fund', 'news'];
  setHTML(el('lis'), `<div class="sgh">${I('db', 14)}<b>Listening to</b></div><div class="lis">${sys.map(k => `<span style="--c:${SYS_COL[k]}"><i></i>${h(k === 'fund' ? 'Transactions & models' : k === 'aem' ? 'Website' : SYS_SHORT[k])}<b>${cnt[k] || 0}</b></span>`).join('')}</div>`);
}
setInterval(() => { if (boardShown() && AO.started) paintRadar(); }, 400);

/* ---- controls ---- */
document.addEventListener('click', e => {
  const q = s => e.target.closest(s); let x;
  if ((x = q('[data-mode]'))) { if (AO.active && x.dataset.mode !== ST.mode) { toast('A work order is running; switch when it finishes.'); return; } ST.mode = x.dataset.mode; AO.viewing = null; if (ST.mode !== 'always') pause(); if (ST.mode === 'ask' && !AO.active) { UI.run = null; ST.msgs = []; } paintAll(); return; }
  if ((x = q('.rrow[data-adv]'))) { pause(); ST.mode = 'advisors'; AX.sel = x.dataset.adv; AX.filter = null; paintAll(); return; }
  if ((x = q('[data-axsel]'))) { AX.sel = x.dataset.axsel; AX.filter = null; paintAll(); return; }
  if ((x = q('[data-axch]'))) { AX.filter = AX.filter === x.dataset.axch ? null : x.dataset.axch; paintAll(); return; }
  if ((x = q('[data-axrun]'))) { const a = axActions(AX.sel).find(y => y.id === x.dataset.axrun); if (a) runAction(a); return; }
  if ((x = q('[data-axres]'))) { const a = axActions(AX.sel).find(y => y.id === x.dataset.axres); if (a && a.run && !AO.active) { UI.run = a.run; ST.view = 'results'; AO.viewing = a; ST.msgs = []; ST.approved = new Set(a.run.tasks.map(t => t.id)); paintAll(); } return; }
  if (q('[data-aoplay]')) { play(); return; }
  if (q('[data-aopause]')) { pause(); return; }
  if (q('[data-aoreset]')) { resetAO(); return; }
  if ((x = q('[data-aospeed]'))) { AO.speed = +x.dataset.aospeed; SLEEP_SCALE = AO.base / AO.speed; paintAll(); return; }
  if (q('[data-aoauto]')) { AO.auto = !AO.auto; paintAll(); return; }
  if (q('[data-aoboard]')) { if (AO.active) AO.peek = true; AO.viewing = null; ST.open = null; paintAll(); return; }
  if (q('[data-aorun]')) { AO.peek = false; AO.viewing = null; paintAll(); return; }
  if (q('[data-aoaccept]')) { if (AO.wait) AO.wait.res(true); return; }
  if (q('[data-aodismiss]')) { if (AO.wait) AO.wait.res(false); return; }
  if ((x = q('[data-aoview]'))) { const w = SGS.wos.find(y => y.id === x.dataset.aoview); if (w && w.run && !AO.active) { UI.run = w.run; ST.view = 'results'; AO.viewing = w; ST.msgs = []; ST.approved = new Set(w.run.tasks.map(t => t.id)); paintAll(); } return; }
  if ((x = q('[data-aowo]'))) { const w = SGS.wos.find(y => y.id === x.dataset.aowo); if (w && !AO.wait && !AO.count && (!AO.cur || AO.phase >= 5)) { AO.cur = w; AO.phase = 5; paintAll(); } return; }
});

/* ---------- Advisors: pick one, see every event, the takeaway, and what we are doing ---------- */
const AX = { sel: QS.get('adv') || 'ADV-104', filter: null, X: null, acts: {}, ter: null };
/* a separate engine run to today, so this view never consumes the live stream */
function AOX() { if (!AX.X) { AX.X = makeSignals(); AX.X.runToToday(); } return AX.X; }
function axActions(sel) {
  if (sel === 'territory') { AX.ter = AX.ter || AOX().territory(); return AX.ter.actions; }
  return (AX.acts[sel] = AX.acts[sel] || AOX().actionsFor(sel));
}
const CH = SIG_CHANNELS.map(([k, label, icon]) => ({ k, label, icon }));
const CH_COL = { digital: '#9333ea', email: '#0284c7', social: '#0a66c2', content: '#e0482f', people: '#2563eb', service: '#ea580c', tx: '#059669', practice: '#b45309' };
const ACT_COL = { visit: '#2f5bea', call: '#7c3aed', campaign: '#d97706', journey: '#0d9488', service: '#ea580c', hold: '#94a3b8', explain: '#059669', platform: '#0891b2', flows: '#16a34a', changed: '#64748b', social: '#0a66c2', trends: '#b45309' };
function paintAdvisors() {
  const box = el('advx'), X = AOX(), sel = AX.sel;
  if (!box._init) { box.innerHTML = `<section class="sgcol axlist" id="axl"></section><section class="axmain"><div class="axhead" id="axh"></div><div class="axch" id="axc"></div><section class="sgcol axtl" id="axt"></section></section><section class="axside" id="axs"></section>`; box._init = 1; }
  const all = X.S.events.filter(e => e.adv), evs = sel === 'territory' ? all : all.filter(e => e.adv === sel);
  /* list */
  setHTML(el('axl'), `<div class="sgh">${I('users', 14)}<b>Advisors</b><small>pick one</small></div><div class="axll">` + ['territory'].concat(Object.keys(ADVISORS)).map(a => {
    if (a === 'territory') { const n = axActions('territory').length; return `<button type="button" class="axi ter${sel === a ? ' on' : ''}" data-axsel="territory"><span class="axt">${I('globe', 16)}</span><span class="axn"><b>Southern California</b><small>Territory overview · ${all.length} events</small></span><span class="axa">${n}</span></button>`; }
    const T = X.takeaway(a), acts = axActions(a), m = acts[0];
    return `<button type="button" class="axi${sel === a ? ' on' : ''}" data-axsel="${a}">${avatar(ADVISORS[a].name, 'sales', 30)}<span class="axn"><b>${h(advShort(a))}</b><small>${h(T.style)} · ${h(T.momentum.toLowerCase())}</small></span>${m ? `<span class="axk" style="--c:${ACT_COL[m.action]}" title="${h(ACT[m.action][1])}">${I(ACT[m.action][0], 13)}</span>` : ''}${acts.length > 1 ? `<span class="axa">${acts.length}</span>` : ''}</button>`;
  }).join('') + `</div>`);
  /* header */
  if (sel === 'territory') {
    const c = X.S.cap['EMP-PRIYA'];
    setHTML(el('axh'), `<div class="axid"><span class="axt big">${I('globe', 22)}</span><div><small>Territory</small><h2>Southern California</h2><p>Los Angeles, Orange County and San Diego · ${Object.keys(ADVISORS).length} advisors · Priya Shah (external) and Sam Lee (internal)</p></div></div>
      <div class="axk2"><div><b>${all.length}</b><small>events since Jul 1</small></div><div><b>${X.S.wos.filter(w => w.action !== 'hold').length}</b><small>decisions</small></div><div><b>${c.slots - c.booked}/${c.slots}</b><small>visit slots open</small></div><div><b>+${Math.round((SERVICE_INSIGHTS.fees.contacts_this_quarter / SERVICE_INSIGHTS.fees.contacts_last_quarter - 1) * 100)}%</b><small>fee questions</small></div></div>`);
  } else {
    const A = ADVISORS[sel], p = X.S.prof[sel], al = VISIT_ALPHA[sel], I0 = X.intentOf(p, X.S.now), cov = EMPLOYEES['EMP-PRIYA'].covers.includes(sel) ? 'Priya Shah and Sam Lee' : 'Sam Lee (internal only)';
    setHTML(el('axh'), `<div class="axid">${avatar(A.name, 'sales', 46)}<div><small>${h(firmShort(A.firm))} · ${h(A.office)}</small><h2>${h(A.name)}</h2><p>${h(A.title)} · ${h(A.practice)}</p></div></div>
      <div class="axk2"><div title="Incremental sales from one in-person visit"><b>${SIGNALS.fmtK(al.sales)}</b><small>Sales α / visit</small></div><div title="Incremental sales from one digital engagement"><b>${SIGNALS.fmtK(al.digital)}</b><small>Digital α</small></div><div><b>${I0.total.toFixed(1)}</b><small>interest now</small></div><div><b>${p.touch ? simDay(p.touch.t).replace(/^\w+, /, '') : '–'}</b><small>last contact${p.touch && p.touch.by ? ' · ' + h(first(EMPLOYEES[p.touch.by].name)) : ''}</small></div><div><b class="sm">${h(cov)}</b><small>coverage</small></div></div>`);
  }
  /* channels, with a weekly bar for each of the 13 weeks since Jul 1 */
  const t0 = X.ts('Jul 1, 2026', '0:00'), wk = e => Math.min(12, Math.floor((e.t - t0) / (7 * X.DAY)));
  setHTML(el('axc'), CH.map(c => { const xs = evs.filter(e => channelOf(e.type) === c.k), bars = Array(13).fill(0); xs.forEach(e => bars[wk(e)]++); const mx = Math.max(1, ...bars), last = xs[xs.length - 1];
    return `<button type="button" class="chn${AX.filter === c.k ? ' on' : ''}${xs.length ? '' : ' none'}" data-axch="${c.k}" style="--c:${CH_COL[c.k]}"><span class="chh">${I(c.icon, 13)}<span>${h(c.label)}</span></span><b>${xs.length}</b><span class="spk">${bars.map(n => `<i style="height:${n ? 18 + n / mx * 82 : 6}%"${n ? '' : ' class="z"'}></i>`).join('')}</span><small>${last ? 'Last ' + h(SIGNALS.dstr(last.t)) : 'No activity'}</small></button>`; }).join(''));
  /* timeline: what happened, and what it led to */
  const res = new Map(); X.S.log.forEach(r => { if (r.e) res.set(r.e.id, r); });
  const list = evs.filter(e => !AX.filter || channelOf(e.type) === AX.filter).slice().reverse();
  let day = '';
  setHTML(el('axt'), `<div class="sgh">${I('clock', 14)}<b>Activity</b><small>${list.length} event${list.length === 1 ? '' : 's'}${AX.filter ? ` · ${h(CH.find(c => c.k === AX.filter).label)} <button type="button" class="link" data-axch="${AX.filter}">clear</button>` : ' · newest first'}</small></div><div class="tll">${list.map(e => {
    const T = SIG_TYPES[e.type], c = channelOf(e.type), r = res.get(e.id), d = simDay(e.t), head = d !== day ? `<div class="tld">${h(d)}</div>` : ''; day = d;
    const led = r && r.wo ? `<span class="otag od">${I('arrow', 10)} ${h(r.wo.id)} · ${h(SIGNALS.actName(r.wo.action))}</span>` : r && r.outcome === 'covered' ? `<span class="otag oc">${h(r.note)}</span>` : '';
    return `${head}<div class="tle"><time>${h(simTime(e.t))}</time><span class="evs sm" style="--c:${CH_COL[c] || '#64748b'}">${I((CH.find(x => x.k === c) || { icon: 'db' }).icon, 11)}</span><div><div class="evh">${sel === 'territory' ? `<b>${h(advShort(e.adv))}</b>` : ''}<span class="tlt">${h(T.label)}</span><span class="src">${h(e.src)}</span>${e.topic && !['general', 'access'].includes(e.topic) ? `<span class="tpc">${h(TOPIC_NAME[e.topic])}</span>` : ''}</div><p>${h(e.what)}</p>${led || T.strength === 'strong' ? `<small><span class="str ${T.strength}">${h(T.strength === 'info' ? 'context' : T.strength)}</span>${led}</small>` : ''}</div></div>`;
  }).join('') || '<p class="muted sm">No events in this channel.</p>'}</div>`);
  /* takeaway and actions */
  const TK = sel === 'territory' ? (AX.ter = AX.ter || X.territory()) : X.takeaway(sel), acts = axActions(sel);
  setHTML(el('axs'), `<section class="sgcol axtk"><div class="sgh">${I('sparkles', 14)}<b>Takeaway</b>${TK.style ? `<span class="tag rule">${h(TK.style)}</span><span class="tag ${TK.momentum === 'Rising' ? '' : 'rule'}">${h(TK.momentum)}</span>` : ''}</div><div class="tkb"><p class="tkh">${h(TK.headline)}</p>${TK.bullets.map(([k, v]) => `<div class="tkr"><span>${h(k)}</span><p>${h(v)}</p></div>`).join('')}</div></section>
    <section class="sgcol axac"><div class="sgh">${I('target', 14)}<b>What we’re doing</b><small>${acts.length} action${acts.length === 1 ? '' : 's'}</small></div><div class="acl">${acts.map(a => actionCard(a)).join('') || '<p class="muted sm">Nothing to do yet: Intelligence keeps watching.</p>'}</div></section>`);
}
function actionCard(a) {
  const [ic, nm] = ACT[a.action], E = a.owner && EMPLOYEES[a.owner], live = AI.mode === 'live';
  const over = a.options ? a.options.filter(o => !o.chosen && o.value != null && o.action !== 'hold').map(o => `${o.label.replace('Personalized digital follow-up', 'Digital')} ${SIGNALS.fmtK(o.value)}`).join(' · ') : '';
  const ev = (a.evidence || []).slice(0, 3);
  let foot;
  if (a.status === 'enrolled') foot = `<span class="fo ok">${I('check', 13)} Enrolled automatically: pre-approved journey, no agents needed</span>`;
  else if (a.status === 'running') foot = `<span class="busy"><span class="spin"></span> Running in orchestration</span>`;
  else if (a.status === 'done' || a.status === 'failed') foot = `<span class="fo ${a.status === 'done' ? 'ok' : 'warn'}">${I(a.status === 'done' ? 'check' : 'alert', 13)} ${h(a.outcome || 'Done')}</span>${a.run ? `<button type="button" class="btn sm" data-axres="${h(a.id)}">${I('doc', 12)} Results</button>` : ''}`;
  else if (!live && !a.replay && a.needsWork) foot = `<span class="fo warn" title="Without an AI key, only actions with a saved AI run can play">${I('alert', 13)} Needs live AI to run</span>`;
  else if (a.needsWork) foot = `<span class="acn">${E ? `${avatar(E.name, E.team, 20)} ${h(E.name)} · ${h(teamName(E.team))}${a.due && a.primary ? ' · by ' + h(SIGNALS.dstr(a.due)) : ''}` : ''}</span><button type="button" class="btn primary sm" data-axrun="${h(a.id)}">${I('play', 12)} Run in orchestration</button>`;
  else foot = '';
  return `<article class="acc${a.primary ? ' pri' : ''}" style="--c:${ACT_COL[a.action]}"><header><span class="aci">${I(ic, 15)}</span><div><small>${a.primary ? `Next best action · <code>${h(a.id)}</code>` : 'Also recommended'}${a.at && a.primary ? ' · ' + h(SIGNALS.dstr(a.at)) : ''}</small><b>${h(nm)}</b></div>${a.value ? `<span class="acv">${SIGNALS.fmtK(a.value)}</span>` : ''}</header>
    <p>${h(a.primary ? primaryWhy(a) : a.why)}</p>${over ? `<p class="over">Chosen over ${h(over)}</p>` : ''}
    ${ev.length ? `<div class="ace">${ev.map(e => `<span title="${h(e.what)}"><i style="background:${CH_COL[channelOf(e.type)] || '#64748b'}"></i>${h(SIGNALS.dstr(e.t))} · ${h(SIG_TYPES[e.type].label)}</span>`).join('')}</div>` : ''}
    <footer>${foot}</footer></article>`;
}
/* a decision, said through what triggered it rather than the rule's name */
function primaryWhy(a) {
  const X = AOX(), e = a.trigger && X.S.events.find(x => x.id === a.trigger);
  const lead = e ? `${SIG_TYPES[e.type].label} on ${SIGNALS.dstr(e.t)}: ${e.what.length > 110 ? e.what.slice(0, 108) + '…' : e.what}.` : a.followsUp ? `After ${a.followsUp} cleared the access problem.` : '';
  return [lead, a.U && a.U.x > 1 ? a.U.why + '.' : '', a.why.replace(/^[^:]+: /, '').replace(/^./, c => c.toUpperCase()) + '.'].filter(Boolean).join(' ');
}
async function runAction(a) {
  if (AO.active || busyPlanning() || anyRunning()) { toast('Something is already running.'); return; }
  if (AI.mode !== 'live' && !a.replay) { toast('This one needs live AI: there is no saved AI run for it.'); return; }
  a.explorer = true;
  const r = await execWO(a, false);
  a.run = r; a.status = r && r.status === 'done' ? 'done' : 'failed'; a.outcome = r ? outcomeOf(r) : 'Did not start';
  AO.active = null; if (r) { AO.viewing = a; ST.view = r.status === 'done' ? 'results' : 'floor'; }
  paintAll();
}
