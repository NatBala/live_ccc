/* ===== Run pipeline: intelligence, orchestration and specialist execution =====
   Shared by the classic workbench (ui.js) and the Agent Harness. It drives the
   orchestrator (AI or recorded), turns its stream into a plan, runs each step
   with a context packet from the shared foundation, calls tools through the
   gateway and passes every result through the gatekeeper. Each view supplies
   the hooks it calls: $, renderAll, addOp, flashTile, toast, setTab, badge,
   buildStaticWho, setAIStatus, updateStream. */
let SLEEP_SCALE = 1; /* a view can speed up presentation pauses (tests use ?fast=1) */
const sleep = ms => new Promise(r => setTimeout(r, ms * SLEEP_SCALE));
const UI = { requester: 'EMP-PRIYA', tab: 'updates', view: 'live', memAdv: null, ops: [], raf: 0, run: null, ctl: null, recordings: [], totals: { runs: 0, reused: 0, committed: 0, pending: 0, blocked: 0, calls: 0, mcp: 0 } };

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
  flashTile('graph', 'read');
  /* what has already happened before the model answers, shown while it thinks */
  const pats = cataloguePatterns(text);
  run.bts = { t0: Date.now(), lookup: bits, patterns: pats.map(c => ({ n: c.n, intent: c.intent, ask: c.ask })), authority: authorityFromText(text, EMPLOYEES[requester].team), replay: !!replay, chars: 0, firstAt: null, drafting: 'start',
    routes: [...new Set(pats.flatMap(c => parseRoute(c.exec).stages.flat().filter(i => i.kind === 'agent').map(i => i.route)))].slice(0, 8),
    context: { advisors: Object.keys(ADVISORS).length, memories: F.memory.length + F.episodes.length, content: CONTENT.length, funds: Object.keys(FUNDS).length, routes: Object.values(SUBAGENTS).reduce((t, A) => t + Object.keys(A.subs).length, 0), services: Object.keys(SERVICES).length, rules: POLICIES.length } };
  run.bts.promptChars = orchestratorPrompt(run).length;
  const ticker = setInterval(() => { if (UI.run === run && run.status === 'thinking') renderAll(); else clearInterval(ticker); }, 500);
  renderAll();
  /* 1. orchestrator */
  const onObj = o => handleOrch(run, o);
  try {
    if (replay) {
      for (const line of replay.orch.split('\n')) { if (UI.ctl.signal.aborted) throw { code: 'cancelled' }; await sleep(JSON.parse(line).k === 'task' ? 450 : 650); run.orchText += line + '\n'; run.bts.firstAt = run.bts.firstAt || Date.now(); run.bts.chars = run.orchText.length; run.bts.drafting = draftingOf(run.orchText); onObj(JSON.parse(line)); renderAll(); }
    } else {
      /* decisions stream in faster than anyone can read; release them at a readable pace */
      const queue = []; let pumping = null;
      const pump = async () => { while (queue.length) { const o = queue.shift(); onObj(o); renderAll(); if (o.k !== 'end') await sleep(o.k === 'task' ? 450 : 750); } pumping = null; };
      const feed = streamParser(o => { queue.push(o); if (!pumping) pumping = pump(); });
      run.stats.ai++;
      const { text: full } = await AI.sample(orchestratorPrompt(run), { modelTier: 'default', cache: false, signal: UI.ctl.signal, onText: ({ text: t }) => { run.orchText = t; run.bts.firstAt = run.bts.firstAt || Date.now(); run.bts.chars = t.length; run.bts.drafting = draftingOf(t); feed(t); updateStream(); } });
      run.orchText = full; run.bts.done = true; feed(full);
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
  const pause = UI.readPause ?? READ_PAUSE_S; if (!pause) return;
  run.presentationPause = { wave, of, seconds: pause };
  for (let left = pause; left > 0 && !UI.ctl.signal.aborted; left--) {
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
    t.role = rr && roleOf(t.agent) && ROLES[rr].team === AGENTS[t.agent]?.team && !(AGENT_ROLE[t.agent] && AGENTS[t.agent].team !== 'sales') ? rr : roleOf(t.agent); /* Product and Marketing agents belong to one sub-team */
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
    if (t.route && !t.services.length && SUB_USES[t.route]) t.services = [...SUB_USES[t.route]]; /* the sub-agent's usual data when the plan names none */
    /* a shared service a step reads brings its tools, when the step's agent may use them */
    t.services.forEach(k => (SERVICES[k] ? SERVICES[k].tools : []).forEach(n => { if (toolAllowed(t.agent, n) && !t.tools.includes(n)) t.tools.push(n); }));
    const bad = t.tools.filter(x => !toolAllowed(t.agent, x));
    if (bad.length) { t.tools = t.tools.filter(x => toolAllowed(t.agent, x)); run.decisions.push({ type: 'registry', src: 'code', title: `${AGENTS[t.agent].name}: ${bad.length} tool${bad.length > 1 ? 's' : ''} removed`, detail: `${bad.join(', ')} ${bad.length > 1 ? 'are' : 'is'} not on this agent’s allow-list at the gateway.` }); UI.totals.blocked++; }
    t.depends_on = t.depends_on.filter(d => run.tasks.some(x => x.id === d));
    t.state = 'queued'; run.tasks.push(t);
  } else if (o.k === 'clarify') {
    if (run.clarified) run.decisions.push({ type: 'missing', src: 'code', title: 'Proceeding on your earlier answer', detail: `Orchestration wanted to ask “${o.question}” again; the app lets it ask only once, so it continues with stated assumptions.` });
    else run.clarify = String(o.question || 'Which advisor do you mean?');
    if (!run.clarified) { run.clarifyOptions = (Array.isArray(o.options) ? o.options : []).map(String).filter(Boolean).slice(0, 4); run.clarifyWhy = String(o.why || ''); }
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
    input = input && typeof input === 'object' ? input : {};
    if (name === 'evidence.synthesize' && !input.advisor_id && run.advisor) input.advisor_id = run.advisor;
    let out; try { out = capResult(T.run(input)); } catch (e) { t.calls.push({ name, input, error: e.message }); renderAll(); throw e; }
    /* demo evidence: an empty result (or an explicit request) is filled from the business context; the AI writes it when no generator fits */
    const live = AI.mode === 'live' && !(run.replay && !run.replay.orchOnly), aiGen = async () => { try { const g = await AI.sample.json(synthesisPrompt(name, input, run, t), { modelTier: 'quick', signal: sig }); return g && typeof g === 'object' ? g : null; } catch (e) { return null; } };
    if (name === 'evidence.synthesize' || (isThin(out) && !SYNTH_EXCLUDE.has(name) && T.rw !== 'write')) {
      let g = name === 'evidence.synthesize' ? (live ? await aiGen() : null) || out : synthesizeEvidence(name, input, run);
      if (!g && live) g = await aiGen();
      if (g && !isThin(g)) out = capResult(Object.assign(Array.isArray(g) ? { records: g } : g, { synthesized: true, synthesized_note: 'Demo evidence generated from the business context; no system held this data.' }));
    }
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
      for (const n of t.tools) { if (n === 'evidence.synthesize') continue; try { t.prefetched[n] = await onCall(n, defaultArgs(n, run, t)); } catch (e) { } }
      if (!Object.values(t.prefetched).some(v => v && !isThin(v))) { try { t.prefetched['evidence.synthesize'] = await onCall('evidence.synthesize', { need: t.objective + ' ' + run.text, advisor_id: run.advisor || '' }); } catch (e) { } }
    }
    if (!useTools && !t.tools.length) { t.prefetched = {}; try { t.prefetched['evidence.synthesize'] = await onCall('evidence.synthesize', { need: t.objective + ' ' + run.text, advisor_id: run.advisor || '' }); } catch (e) { } }
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
  const plan = Object.keys(PLANS).find(k => PLANS[k].adv === run.advisor) || '', lastEp = run.advisor && F.episodes.find(e => e.adv === run.advisor);
  return { since: lastEp ? lastEp.date : '', category: /fixed income|bond/i.test(run.text) ? 'fixed income' : /growth/i.test(run.text) ? 'large growth' : 'equity', wholesaler: run.requester, month: 'October 2026', meeting_type: 'advisor meeting', model: /moderate/i.test(run.text) ? 'Moderate Growth' : 'Growth', asset_id: (run.text.match(/SEIS-\d+/) || ['SEIS-117'])[0], claim: run.text, program: '', term: /etf/i.test(run.text) ? 'etfs' : 'equity funds', topics: run.text, plan_id: plan, topic: /fee|cost|expense/i.test(run.text) ? 'fees' : /link|access|open/i.test(run.text) ? 'access' : t.objective, case_id: (F.cases.find(c => c.adv === run.advisor && c.status === 'Open') || {}).id || '', note: '', status: '', advisor_id: run.advisor || '', ticker: tick[0] || 'GFFFX', tickers: tick.length ? tick : ['GFFFX'], name: tick[0] || '', amount_usd: 1000000, query: t.objective, weights: tick.length > 1 ? { [tick[0]]: 50, [tick[1]]: 50 } : { VIGAX: 70, GFFFX: 30 }, category: tick[0] || 'Large Growth', territory: run.territory || 'LA', content_type: /linkedin|post/i.test(run.text) ? 'linkedin post' : /committee/i.test(run.text) ? 'committee pack' : 'advisor email', to: run.advisor ? ADVISORS[run.advisor].name : people[0] || '', subject: t.objective.slice(0, 60), attendees: [run.advisor, ...people].filter(Boolean), when, title: t.objective.slice(0, 60), time: '' };
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


function draftingOf(text) {
  const objs = jsonObjects(text), last = objs[objs.length - 1], tail = last ? text.slice(text.lastIndexOf(last) + last.length) : text;
  if (/"k"\s*:\s*"task"/.test(tail)) return 'task';
  if (/"k"\s*:\s*"clarify"/.test(tail)) return 'clarify';
  const m = tail.match(/"type"\s*:\s*"(\w+)"/); return m ? m[1] : objs.length ? 'next' : 'start';
}
