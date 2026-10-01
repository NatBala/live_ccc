/* ===== The shared AI foundation (deterministic) + AI runtime ===== */
const clone = o => JSON.parse(JSON.stringify(o));
const TODAY = 'Tuesday, September 29, 2026';
const nowStamp = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/* ---------- Foundation state ---------- */
function freshFoundation() {
  const F = {
    memory: clone(MEMORY), episodes: clone(EPISODES), commitments: clone(COMMITMENTS), cases: clone(CASES),
    findings: clone(FINDINGS), outputs: [], events: [], feedback: [], pending: [], changes: [],
    session: { advisor: null, unit: null, requests: [], requirements: [] },
    graph: { nodes: [], edges: [] }, seq: 0, runs: []
  };
  const N = (id, label, type) => F.graph.nodes.push({ id, label, type, run: null });
  const E = (a, b, l) => F.graph.edges.push({ from: a, to: b, label: l, run: null });
  for (const [id, f] of Object.entries(FIRMS)) N(id, f.name, 'firm');
  for (const [id, e] of Object.entries(EMPLOYEES)) N(id, e.name, 'employee');
  for (const [id, a] of Object.entries(ADVISORS)) {
    N(id, a.name, 'advisor'); E(id, a.firm, 'works at');
    for (const [u, l] of Object.entries(a.units)) { N(u, l, 'unit'); E(id, u, 'member of'); }
    a.coverage.forEach(c => E(c, id, 'covers'));
  }
  F.memory.forEach(m => { N(m.id, m.attr, 'memory'); E(m.adv, m.id, 'has'); });
  F.findings.forEach(k => { N(k.id, k.label, 'finding'); k.evidence.forEach(ev => E(k.id, ev, 'cites')); });
  N('GFFFX', 'Growth Fund of America', 'fund'); E('ADV-101', 'GFFFX', 'holds ~$38M');
  return F;
}
let F = freshFoundation();
const layerCount = l => ({
  memory: F.memory.length + F.episodes.length, knowledge: F.findings.length + CONTENT.length + Object.keys(FUNDS).length, policy: POLICIES.length + F.pending.length,
  models: 4, feedback: F.feedback.length, events: F.events.length, graph: F.graph.nodes.length
}[l]);

function logEvent(type, detail, by, adv) {
  const ev = { id: 'EVT-' + (++F.seq), type, detail, by, adv: adv || F.session.advisor, at: nowStamp(), subscribers: SUBSCRIPTIONS[type] || [] };
  F.events.push(ev); return ev;
}

/* ---------- Deterministic entity resolution (graph lookup) ---------- */
function resolveEntities(text) {
  const t = ' ' + text.toLowerCase().replace(/[^a-z0-9’' ]/g, ' ') + ' ';
  const cands = [];
  for (const [id, a] of Object.entries(ADVISORS)) {
    const first = a.short.toLowerCase(), last = a.name.split(' ')[1].replace(/,/, '').toLowerCase();
    let score = 0;
    if (t.includes(' ' + first + ' ') || t.includes(' ' + first + '’s ') || t.includes(' ' + first + "'s ")) score += 2;
    if (t.includes(' ' + last + ' ')) score += 2;
    if (score) cands.push({ advisor: id, name: a.name, firm: FIRMS[a.firm].name, score });
  }
  if (!cands.length && F.session.advisor) cands.push({ advisor: F.session.advisor, name: ADVISORS[F.session.advisor].name, firm: FIRMS[ADVISORS[F.session.advisor].firm].name, score: 1, fromSession: true });
  cands.sort((a, b) => b.score - a.score);
  const unitHints = [];
  for (const c of cands) for (const [u, l] of Object.entries(ADVISORS[c.advisor].units)) {
    const words = l.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
    const hit = words.filter(w => t.includes(w)).length + (/(retire|committee|401)/.test(t) && /retire|committee|401/.test(l.toLowerCase()) ? 2 : 0) + (/wealth/.test(t) && /wealth/.test(l.toLowerCase()) ? 2 : 0);
    unitHints.push({ unit: u, label: l, advisor: c.advisor, hits: hit });
  }
  const people = Object.entries(EMPLOYEES).filter(([, x]) => t.includes(' ' + x.name.split(' ')[0].toLowerCase() + ' ')).map(([id, x]) => ({ id, name: x.name, team: TEAMS[x.team].name, note: 'Capital Group colleague, not an advisor' }));
  const territories = Object.entries(TERRITORIES).filter(([, x]) => x.aliases.some(a => t.includes(' ' + a + ' '))).map(([id, x]) => ({ id, name: x.name, advisors: x.advisors.map(a => ADVISORS[a].name) }));
  const funds = fundsIn(text).map(k => ({ ticker: k, name: FUNDS[k].name }));
  return { candidates: cands.filter(c => !people.some(p => p.name.split(' ')[0] === c.name.split(' ')[0])), units: unitHints.sort((a, b) => b.hits - a.hits), people, territories, funds };
}
function fundsIn(text) {
  const t = ' ' + text.toLowerCase().replace(/[^a-z0-9. ]/g, ' ') + ' ', out = [];
  for (const [alias, tk] of Object.entries(FUND_ALIASES)) if (t.includes(' ' + alias + ' ') && !out.includes(tk)) out.push(tk);
  for (const tk of Object.keys(FUNDS)) if (t.includes(' ' + tk.toLowerCase() + ' ') && !out.includes(tk)) out.push(tk);
  return out;
}
const tickerOf = x => { const s = String(x || '').trim(), u = s.toUpperCase(); return FUNDS[u] ? u : FUND_ALIASES[s.toLowerCase()] || null; };

/* ---------- Enterprise tools (reached through the MCP or API gateway) ---------- */
const S = v => String(v ?? '').trim();
const adv = id => { const a = ADVISORS[S(id)] || Object.entries(ADVISORS).find(([k, x]) => x.short.toLowerCase() === S(id).toLowerCase() || x.name.toLowerCase().includes(S(id).toLowerCase()))?.[1]; if (!a) throw new Error('Unknown advisor id. Use ids like ADV-101.'); return a; };
const advId = id => ADVISORS[S(id)] ? S(id) : Object.keys(ADVISORS).find(k => ADVISORS[k].short.toLowerCase() === S(id).toLowerCase() || ADVISORS[k].name.toLowerCase().includes(S(id).toLowerCase()));
const TOOLS = {
  'crm.get_contact': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce: advisor contact, firm, team, buying units and coverage.', props: { advisor_id: 'string' },
    run: a => { const x = adv(a.advisor_id); return { name: x.name, title: x.title, firm: FIRMS[x.firm].name, office: x.office, team: x.team, units: x.units, coverage: x.coverage.map(c => EMPLOYEES[c].name) }; } },
  'crm.get_call_notes': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce: recorded call transcripts and emails for an advisor, newest first (ids like CALL-0922).', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id); return F.episodes.filter(e => e.adv === id).slice(0, 3).map(e => ({ id: e.id, date: e.date, kind: e.kind, scope: e.scope, text: e.text })); } },
  'crm.get_opportunities': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce: open opportunities for an advisor.', props: { advisor_id: 'string' },
    run: a => OPPORTUNITIES.filter(o => o.adv === advId(a.advisor_id)) },
  'crm.log_activity': { sys: 'sf', via: 'MCP', rw: 'write', desc: 'Salesforce: log an activity summary against the advisor. Returns the activity id.', props: { advisor_id: 'string', summary: 'string' },
    run: a => ({ activity_id: 'ACT-' + (1000 + F.seq), logged: S(a.summary).slice(0, 140) }) },
  'crm.create_task': { sys: 'sf', via: 'MCP', rw: 'write', desc: 'Salesforce: create a follow-up task with an owner and due date.', props: { title: 'string', owner: 'string', due: 'string' },
    run: a => ({ task_id: 'SF-TASK-' + (700 + F.seq), title: S(a.title), owner: S(a.owner), due: S(a.due) }) },
  'service.get_cases': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Service Cloud: service cases for an advisor.', props: { advisor_id: 'string' },
    run: a => F.cases.filter(c => c.adv === advId(a.advisor_id)) },
  'service.update_case': { sys: 'sf', via: 'MCP', rw: 'write', desc: 'Service Cloud: add a resolution note or status to a case (or open a new one).', props: { case_id: 'string', note: 'string' },
    run: a => ({ case_id: S(a.case_id) || 'CASE-00' + (600 + F.seq), note: S(a.note).slice(0, 140), status: 'Updated' }) },
  'calendar.find_times': { sys: 'm365', via: 'MCP', rw: 'read', desc: 'Outlook calendar: open slots. attendees = advisor ids or colleague names; when = e.g. "tomorrow", "next week", "next month".', props: { attendees: 'array', when: 'string' },
    run: a => { const at = (Array.isArray(a.attendees) ? a.attendees : [a.attendees || a.advisor_id]).map(S).filter(Boolean), w = S(a.when).toLowerCase();
      const isAlex = at.some(x => advId(x) === 'ADV-101');
      const slots = isAlex ? ['Thu Oct 1, 7:30 a.m. PT (before his committee)', 'Tue Oct 6, 7:30 a.m. PT', 'Thu Oct 8, 7:30 a.m. PT']
        : /month/.test(w) ? ['Tue Oct 6, 10:00 a.m. PT', 'Wed Oct 14, 2:00 p.m. PT', 'Thu Oct 22, 11:00 a.m. PT'] : /week/.test(w) ? ['Mon Oct 5, 1:00 p.m. PT', 'Wed Oct 7, 9:30 a.m. PT', 'Fri Oct 9, 3:00 p.m. PT'] : ['Wed Sep 30, 2:00 p.m. PT', 'Thu Oct 1, 10:00 a.m. PT', 'Fri Oct 2, 3:30 p.m. PT'];
      return { attendees: at.map(x => ADVISORS[advId(x)] ? ADVISORS[advId(x)].name : x), slots, note: isAlex ? 'Alex books through Jamie Cho, Tue/Thu 7:30 a.m. PT' : 'All attendees free' }; } },
  'calendar.create_event': { sys: 'm365', via: 'MCP', rw: 'write', desc: 'Outlook calendar: place a meeting. Colleagues get an invite; for an advisor it is a tentative hold until a person approves the invite.', props: { title: 'string', attendees: 'array', time: 'string' },
    run: a => { const at = (Array.isArray(a.attendees) ? a.attendees : [a.attendees]).map(S).filter(Boolean), ext = at.some(x => advId(x));
      return { event_id: 'EVT-CAL-' + (200 + F.seq), title: S(a.title), time: S(a.time), attendees: at.map(x => ADVISORS[advId(x)] ? ADVISORS[advId(x)].name : x), status: ext ? 'Tentative hold; advisor invite goes out after approval' : 'Invite sent to colleagues' }; } },
  'mail.draft': { sys: 'm365', via: 'MCP', rw: 'write', desc: 'Outlook: save an email draft (never sends). Returns the draft id.', props: { to: 'string', subject: 'string' },
    run: a => ({ draft_id: 'DRAFT-' + (400 + F.seq), to: S(a.to), subject: S(a.subject), status: 'Draft saved; sending needs human approval' }) },
  'sharepoint.get_disclosures': { sys: 'm365', via: 'API', rw: 'read', desc: 'SharePoint compliance library: required disclosures for a content type.', props: { content_type: 'string' },
    run: () => ['Past results are not predictive of results in future periods.', 'Expense ratios are as of each fund’s prospectus.', 'Indexes are unmanaged; investors cannot invest directly in an index.', 'For financial professional use only.'] },
  'seismic.search_content': { sys: 'seismic', via: 'MCP', rw: 'read', desc: 'Seismic: search approved content by keywords and audience. Returns ids, titles, audience, format.', props: { query: 'string' },
    run: a => { const q = S(a.query).toLowerCase().split(/\W+/).filter(w => w.length > 2); return CONTENT.map(c => ({ c, s: q.filter(w => (c.tags + ' ' + c.title.toLowerCase()).includes(w)).length })).filter(x => x.s).sort((x, y) => y.s - x.s).slice(0, 4).map(x => ({ id: x.c.id, title: x.c.title, audience: x.c.audience, format: x.c.format, status: x.c.status })); } },
  'seismic.export_pdf': { sys: 'seismic', via: 'API', rw: 'read', desc: 'Seismic: export an approved asset as a PDF attachment (same version).', props: { asset_id: 'string' },
    run: a => ({ asset: S(a.asset_id), file: S(a.asset_id) + '.pdf', version: 'unchanged' }) },
  'fund.get_facts': { sys: 'fund', via: 'API', rw: 'read', desc: 'Fund data platform: verified facts for a ticker (GFFFX, AGTHX, VWUAX, VIGAX, AWSHX, ABALX, AMECX). Expense ratios in percent.', props: { ticker: 'string' },
    run: a => { const k = tickerOf(a.ticker); if (!k) throw new Error('Unknown fund. Try fund.lookup first. Known: ' + Object.keys(FUNDS).join(', ')); return Object.assign({ ticker: k }, FUNDS[k]); } },
  'fund.lookup': { sys: 'fund', via: 'API', rw: 'read', desc: 'Fund data platform: resolve a fund nickname or name (GFA, BFA, AMBAL, WMIF, IFA) to tickers and share classes.', props: { name: 'string' },
    run: a => { const k = tickerOf(a.name) || fundsIn(S(a.name))[0]; if (!k) return { match: null, note: 'No match. Known nicknames: GFA, BFA, AMBAL, WMIF, IFA' }; const base = FUNDS[k].name.split(',')[0]; return { match: k, fund: base, share_classes: Object.entries(FUNDS).filter(([, f]) => f.name.startsWith(base)).map(([t, f]) => ({ ticker: t, class: f.name.split(', ')[1] || '', expense_ratio_pct: f.er })) }; } },
  'fund.get_performance': { sys: 'fund', via: 'API', rw: 'read', desc: 'Fund data platform: standardized returns. Returned as a placeholder that is filled in at approval, never as numbers for drafting.', props: { ticker: 'string' },
    run: a => ({ ticker: S(a.ticker).toUpperCase(), standardized_returns: 'Inserted from the fund data platform at approval (1, 5, 10 years). Do not write return figures.' }) },
  'models.cost_on_assets': { sys: 'fund', via: 'API', rw: 'read', desc: 'Model platform: annual cost in dollars of each fund’s expense ratio on an amount. Use for any dollar fee figure.', props: { tickers: 'array', amount_usd: 'number' },
    run: a => { const amt = Number(a.amount_usd) || 0, tk = (Array.isArray(a.tickers) ? a.tickers : S(a.tickers).split(/[ ,]+/)).map(x => S(x).toUpperCase()).filter(Boolean);
      return { amount_usd: amt, costs: tk.map(x => tickerOf(x) || x).map(t => FUNDS[t] && FUNDS[t].er != null ? { ticker: t, expense_ratio_pct: FUNDS[t].er, annual_cost_usd: Math.round(amt * FUNDS[t].er / 100) } : { ticker: t, annual_cost_usd: null, note: 'Expense ratio not available' }) }; } },
  'models.portfolio_construction': { sys: 'fund', via: 'API', rw: 'read', desc: 'Model platform: blended expense ratio for a mix, e.g. {"VIGAX":70,"GFFFX":30}.', props: { weights: 'object' },
    run: a => { const w = a.weights && typeof a.weights === 'object' ? a.weights : {}; let tot = 0, er = 0; const miss = [];
      for (const [k, v] of Object.entries(w)) { const f = FUNDS[tickerOf(k)]; if (!f || f.er == null) { miss.push(k); continue; } er += f.er * Number(v); tot += Number(v); }
      return { weights: w, blended_expense_ratio_pct: tot ? Math.round(er / tot * 1000) / 1000 : null, missing: miss }; } },
  'models.territory_trends': { sys: 'fund', via: 'API', rw: 'read', desc: 'Model platform: what is growing in a territory (LA, OC, SD) this quarter vs. last, computed from recorded advisor conversations, priorities and opportunities. Returns counts of advisors per topic with evidence ids.', props: { territory: 'string' },
    run: a => { const key = Object.keys(TERRITORIES).find(k => k.toLowerCase() === S(a.territory).toLowerCase() || TERRITORIES[k].aliases.includes(S(a.territory).toLowerCase()) || TERRITORIES[k].name.toLowerCase() === S(a.territory).toLowerCase());
      if (!key) throw new Error('Unknown territory. Use LA, OC or SD.');
      const T = TERRITORIES[key], rows = [];
      for (const [topic, kws] of Object.entries(TREND_TOPICS)) {
        const ev = [], who = new Set();
        for (const adv of T.advisors) {
          const texts = [...F.episodes.filter(x => x.adv === adv).map(x => [x.id, x.text]), ...F.memory.filter(m => m.adv === adv && m.access === 'shared').map(m => [m.id, m.value]), ...OPPORTUNITIES.filter(o => o.adv === adv).map(o => [o.id, o.note])];
          for (const [id, tx] of texts) if (kws.some(k => tx.toLowerCase().includes(k))) { ev.push(id); who.add(ADVISORS[adv].name); }
        }
        const now = who.size, last = TREND_BASELINE[key][topic] || 0;
        rows.push({ topic: TREND_NAMES[topic], advisors_this_quarter: now, advisors_last_quarter: last, change: now - last, advisors: [...who], evidence: [...new Set(ev)].slice(0, 5) });
      }
      rows.sort((x, y) => y.change - x.change || y.advisors_this_quarter - x.advisors_this_quarter);
      return { territory: T.name, advisors_covered: T.advisors.length, model: 'Territory trends v2', basis: 'Recorded conversations, stated priorities and open opportunities. A signal, not market data.', trends: rows };
    } },
  'models.sales_alpha': { sys: 'fund', via: 'API', rw: 'read', desc: 'Model platform: Sales Alpha opportunity score for an advisor (a signal, not intent).', props: { advisor_id: 'string' },
    run: a => Object.assign({ advisor: advId(a.advisor_id), model: 'Sales Alpha v4' }, ALPHA[advId(a.advisor_id)] || {}) },
  'mstar.get_peers': { sys: 'mstar', via: 'API', rw: 'read', desc: 'Morningstar licensed data: category median expense ratio and peers. Pass a category (Large Growth, Moderate Allocation, Intermediate Core Bond) or a ticker.', props: { category: 'string' },
    run: a => { const tk = tickerOf(a.category); const cat = tk && FUNDS[tk].category ? FUNDS[tk].category : Object.keys(PEERS).find(c => c.toLowerCase().includes(S(a.category).toLowerCase().split(' ')[0])) || 'Large Growth';
      return { category: cat, peers: PEERS[cat].peers, median_expense_ratio_pct: PEERS[cat].medianEr, note: PEERS[cat].note, categories_available: Object.keys(PEERS) }; } }
};
const toolAllowed = (agent, tool) => (AGENTS[agent]?.tools || []).includes(tool);

/* ---------- Context packets: what the foundation sends each agent ---------- */
function mentionsFunds(text) {
  const out = new Set(fundsIn(text)), t = text.toLowerCase();
  if (/vanguard/.test(t)) { out.add('VWUAX'); out.add('VIGAX'); }
  return [...out];
}
function buildPacket(task, run) {
  const a = AGENTS[task.agent], team = a.team, advId = run.advisor, unit = run.unit, items = [], withheld = [];
  const reads = new Set(task.reads && task.reads.length ? task.reads : ['memory', 'knowledge', 'policy']);
  const push = (layer, id, label, value, from, scope) => items.push({ layer, id, label, value, from, scope });
  if (advId) {
    const A = ADVISORS[advId];
    push('graph', advId, 'Resolved advisor', `${A.name} · ${A.title} · ${FIRMS[A.firm].name} · ${Object.entries(A.units).map(([k, v]) => k + ' ' + v).join('; ')}`, 'Graph', 'advisor');
    if (reads.has('memory')) {
      for (const m of F.memory.filter(m => m.adv === advId && m.status !== 'superseded')) {
        const inScope = m.scope === 'advisor' || m.scope === A.firm || !unit || m.scope === unit;
        if (!inScope) { withheld.push({ id: m.id, why: `Scoped to ${m.scope}, not the active ${unit}` }); continue; }
        if (m.access === 'relationship' && team !== 'sales') { withheld.push({ id: m.id, why: 'Personal note: relationship team only' }); continue; }
        if (m.access.startsWith('owner:') && !(m.access === 'owner:' + run.requester && (task.agent === 'sales.coach' || task.agent === 'sales.prep'))) { withheld.push({ id: m.id, why: 'Private coaching: owner only' }); continue; }
        push('memory', m.id, m.attr, m.value, m.origin ? AGENTS[m.origin]?.name || m.origin : `${m.basis} (${m.src})`, m.scope);
      }
      (UNKNOWNS[advId] || []).forEach((u, k) => push('memory', 'UNK-' + advId.slice(4) + k, 'Not known', u, 'Foundation', 'advisor'));
      for (const e of F.episodes.filter(e => e.adv === advId && (!unit || e.scope === unit || e.scope === 'advisor')).slice(0, 2)) push('memory', e.id, `${e.kind}, ${e.date}`, e.text, 'Salesforce', e.scope);
      for (const c of F.commitments.filter(c => c.adv === advId && c.status === 'Open')) push('memory', c.id, 'Open commitment', `${c.title} · ${c.owner} · due ${c.due}`, 'Workflow', c.scope);
    }
    if (reads.has('events')) F.events.filter(e => e.adv === advId).slice(-3).forEach(e => push('events', e.id, e.type, e.detail, AGENTS[e.by]?.name || e.by, 'advisor'));
    if (reads.has('feedback')) F.feedback.filter(f => f.adv === advId).slice(-3).forEach(f => push('feedback', f.id, 'Feedback', f.text, AGENTS[f.by]?.name || f.by, f.scope));
    if ((team === 'sales' || team === 'marketing') && (reads.has('models') || task.agent === 'sales.lead')) push('models', 'MOD-ALPHA', 'Sales Alpha signal', `${ALPHA[advId].score}/100: ${ALPHA[advId].note}. A signal, not intent.`, 'Model platform', 'advisor');
  } else if (run.territory && TERRITORIES[run.territory]) {
    const T = TERRITORIES[run.territory];
    push('graph', run.territory, 'Territory', `${T.name}: ${T.advisors.map(a => ADVISORS[a].name + ' (' + FIRMS[ADVISORS[a].firm].name + ')').join('; ')}. Wholesaler ${T.wholesaler}.`, 'Graph', 'territory');
    if (reads.has('memory') || team === 'sales' || team === 'marketing') for (const adv of T.advisors) {
      F.memory.filter(m => m.adv === adv && m.access === 'shared' && m.status !== 'superseded' && m.cat === 'priority').forEach(m => push('memory', m.id, `${ADVISORS[adv].short}: ${m.attr}`, m.value, `${m.basis} (${m.src})`, m.scope));
      F.memory.filter(m => m.adv === adv && m.access !== 'shared').forEach(m => withheld.push({ id: m.id, why: 'Personal or private note, not needed for a territory view' }));
    }
  } else withheld.push({ id: 'advisor context', why: 'No advisor or territory in this request' });
  (run.resolution && run.resolution.people || []).forEach(p => push('graph', p.id, 'Colleague', `${p.name}, ${p.team} (Capital Group). Internal attendee, not an advisor.`, 'Graph', 'internal'));
  if (reads.has('knowledge') || team === 'product') {
    const tx = run.text + ' ' + task.objective;
    F.findings.forEach(k => { if (!k.adv || k.adv === advId) push('knowledge', k.id, k.label, k.value, AGENTS[k.by]?.name || 'QAR', k.adv ? (k.scope || 'advisor') : 'reusable'); });
    mentionsFunds(tx).forEach(t => { const f = FUNDS[t]; push('knowledge', t, f.name, `Expense ratio ${f.er == null ? 'not in reference data' : f.er + '%'}; benchmark ${f.bench}; ${f.category ? 'category ' + f.category + '; ' : ''}${f.approach}${f.asOf ? '; as of ' + f.asOf : ''}; source ${f.src}`, 'Fund data platform', 'reusable'); const c = f.category && PEERS[f.category]; if (c) push('knowledge', 'PEER-' + f.category.replace(/\W/g, ''), f.category + ' category', `Median expense ratio ${c.medianEr}% (${c.note})`, 'Morningstar', 'reusable'); });
    if (team === 'marketing' || team === 'sales' || team === 'product') CONTENT.filter(c => c.tags.split(' ').some(w => w.length > 3 && tx.toLowerCase().includes(w))).slice(0, 3).forEach(c => push('knowledge', c.id, c.title, `${c.audience} · ${c.format} · ${c.status}`, 'Seismic', 'reusable'));
  }
  if (reads.has('policy') || team === 'marketing') POLICIES.filter(p => ['POL-1', 'POL-2', 'POL-4', 'POL-6', 'POL-7'].includes(p.id) || (team === 'marketing' && p.id === 'POL-8')).forEach(p => push('policy', p.id, 'Rule', p.text, 'Compliance', 'all'));
  const seen = new Set();
  const out = items.filter(i => seen.has(i.id) ? false : seen.add(i.id)).slice(0, 45).map(i => Object.assign(i, { value: String(i.value).slice(0, 420) }));
  return { items: out, withheld: withheld.slice(0, 12) };
}

/* ---------- The gatekeeper: deterministic rules on every contribution ---------- */
function numbersIn(s) {
  return (String(s).match(/(?<![\w-])\$?\d[\d,]*(?:\.\d+)?\s?(?:%|[mMkKbB](?:illion)?\b)?/g) || [])
    .map(x => x.trim()).filter(x => /[.%$]/.test(x) || x.replace(/\D/g, '').length >= 3).filter(x => !/^(19|20)\d\d$/.test(x.replace(/\D/g, '')));
}
const normNum = x => x.replace(/[$,\s%]/g, '').replace(/million|m$/i, '').replace(/k$/i, '');
function traceable(value, corpus) {
  const missing = [];
  for (const n of numbersIn(value)) {
    const v = normNum(n), alt = String(parseFloat(v));
    if (!(corpus.includes(v) || corpus.includes(alt) || corpus.includes(v.replace(/\.0+$/, '')))) missing.push(n);
  }
  return missing;
}
function gatekeep(task, res, ctx) {
  const verdicts = [], run = ctx.run, a = AGENTS[task.agent];
  const known = new Set([...ctx.packet.items.map(i => i.id), ...ctx.toolIds, ...ctx.upstreamIds]);
  const corpus = (JSON.stringify(ctx.packet.items) + JSON.stringify(ctx.toolResults) + JSON.stringify(ctx.upstream)).replace(/,/g, '');
  const V = (kind, status, title, reason, extra) => verdicts.push(Object.assign({ kind, status, title, reason }, extra || {}));
  /* knowledge */
  for (const k of (res.knowledge || []).slice(0, 3)) {
    const ev = (k.evidence || []).filter(x => known.has(x));
    const miss = traceable(k.value, corpus);
    if (!ev.length) { V('knowledge', 'blocked', k.label, 'No cited evidence the foundation can verify'); continue; }
    if (miss.length) { V('knowledge', 'blocked', k.label, `Number not traceable to a system of record: ${miss.join(', ')}`); continue; }
    const id = 'K-' + (300 + (++F.seq));
    F.findings.push({ id, label: k.label, value: k.value, by: task.agent, evidence: ev, date: 'Sep 29, 2026', run: run.id, adv: /advisor|alex|maya|sofia|jordan/i.test(k.label) ? run.advisor : null });
    F.graph.nodes.push({ id, label: k.label, type: 'finding', run: run.id }); ev.forEach(e => F.graph.edges.push({ from: id, to: e, label: 'cites', run: run.id }));
    const evt = logEvent('knowledge.published', k.label, task.agent, run.advisor);
    V('knowledge', 'published', k.label, `Evidence ${ev.join(', ')}; every number traced`, { id, event: evt });
  }
  /* memory */
  for (const m of (res.memory || []).slice(0, 3)) {
    const A = ADVISORS[run.advisor];
    if (!A) { V('memory', 'rejected', m.attribute, 'No advisor resolved, so there is no subject to remember this about'); continue; }
    if (/personal|hobby|family/i.test(m.category || '') && a.team !== 'sales') { V('memory', 'blocked', m.attribute, 'Personal information may only be recorded by the relationship team'); continue; }
    let scope = m.scope === 'advisor' || m.scope === A.firm || (m.scope && A.units[m.scope]) ? m.scope : (run.unit || 'advisor');
    const scoped = scope !== m.scope ? ` Scope set to ${scope}.` : '';
    const basis = m.basis;
    if (basis === 'inference') { V('memory', 'rejected', m.attribute, 'Not stored: inferred, not stated by the advisor (POL-6)'); continue; }
    if (basis === 'employee_request' || basis === 'task_requirement') {
      F.session.requirements.push({ text: `${m.attribute}: ${m.value}`, by: task.agent, run: run.id });
      V('memory', 'task', m.attribute, `Kept with this task only. ${basis === 'employee_request' ? 'An employee’s request is not an advisor preference (POL-6).' : 'A one-time requirement, not a lasting preference.'}`); continue;
    }
    const epi = (m.evidence || []).find(x => F.episodes.some(e => e.id === x && e.adv === run.advisor));
    if (!epi) {
      const pid = 'PEND-' + (++F.seq);
      F.pending.push({ id: pid, adv: run.advisor, attr: m.attribute, value: m.value, scope, by: task.agent, reason: 'Reported, not in the advisor’s own recorded words. Confirm with the advisor.', run: run.id });
      logEvent('memory.pending', `${m.attribute} (${scope})`, task.agent, run.advisor);
      V('memory', 'pending', m.attribute, 'Pending validation: no recorded statement from the advisor supports it yet.' + scoped, { id: pid }); continue;
    }
    const prev = F.memory.find(x => x.adv === run.advisor && x.scope === scope && x.attr.toLowerCase() === S(m.attribute).toLowerCase() && x.status !== 'superseded');
    if (prev && prev.value.trim().toLowerCase() === S(m.value).toLowerCase()) { V('memory', 'read', m.attribute, `Already known (${prev.id}). Nothing new to store.`); continue; }
    const id = prev ? prev.id : 'MEM-' + (500 + (++F.seq));
    const rec = { id, adv: run.advisor, cat: m.category || 'content_pref', scope, attr: S(m.attribute), value: S(m.value), src: epi, speaker: A.name, basis: 'Direct advisor statement', rev: prev ? prev.rev + 1 : 1, access: 'shared', origin: task.agent, run: run.id };
    if (prev) { prev.status = 'superseded'; }
    F.memory.push(rec);
    F.changes.push({ id, adv: run.advisor, before: prev ? prev.value : 'Not recorded', after: rec.value, scope, src: epi, by: task.agent, run: run.id, attr: rec.attr, rev: rec.rev });
    if (!prev) { F.graph.nodes.push({ id, label: rec.attr, type: 'memory', run: run.id }); F.graph.edges.push({ from: run.advisor, to: id, label: 'has', run: run.id }); }
    F.graph.edges.push({ from: id, to: epi, label: 'supported by', run: run.id });
    const evt = logEvent('memory.committed', `${rec.attr} (${scope}) rev ${rec.rev}`, task.agent, run.advisor);
    V('memory', 'committed', m.attribute, `${prev ? 'New revision ' + rec.rev + ' supersedes the old value.' : 'New scoped memory.'} Source ${epi}, the advisor’s own words.${scoped}`, { id, event: evt });
  }
  /* commitments */
  for (const c of (res.commitments || []).slice(0, 2)) {
    const id = 'TASK-' + (400 + (++F.seq));
    F.commitments.push({ id, adv: run.advisor, scope: run.unit || 'advisor', title: S(c.title), owner: S(c.owner) || EMPLOYEES[run.requester].name, due: S(c.due) || 'TBD', status: 'Open', run: run.id });
    F.graph.edges.push({ from: run.advisor || run.requester, to: id, label: 'owed', run: run.id }); F.graph.nodes.push({ id, label: S(c.title), type: 'task', run: run.id });
    const evt = logEvent('commitment.created', S(c.title), task.agent, run.advisor);
    V('commitment', 'committed', S(c.title), `Durable task, owner ${S(c.owner) || EMPLOYEES[run.requester].name}`, { id, event: evt });
  }
  /* output */
  if (res.output && res.output.body) {
    const clientFacing = /email|post|content/.test(res.output.kind || '');
    const personal = F.memory.filter(m => m.access !== 'shared' && m.adv === run.advisor).some(m => clientFacing && m.value.split(/\W+/).filter(w => w.length > 6).some(w => res.output.body.includes(w)));
    const miss = traceable(res.output.body, corpus);
    if (personal) V('output', 'blocked', res.output.title, 'Client-facing draft contains a personal note (POL-4)');
    else if (miss.length && clientFacing) V('output', 'blocked', res.output.title, `Client-facing draft has numbers not traceable to a system of record: ${miss.slice(0, 3).join(', ')}`);
    else {
      const id = 'OUT-' + (++F.seq), needs = !!res.needs_approval || /email|post/.test(res.output.kind || '');
      F.outputs.push({ id, task: task.id, agent: task.agent, run: run.id, adv: run.advisor, kind: res.output.kind, title: res.output.title, body: res.output.body, status: needs ? 'Waiting for approval' : miss.length ? 'Needs number check' : 'Ready', flagged: miss, used: res.used || [] });
      if (miss.length) V('output', 'flagged', res.output.title, `Internal only. Numbers not traceable to a system of record are marked for checking: ${miss.slice(0, 3).join(', ')}`);
      F.graph.nodes.push({ id, label: res.output.title, type: 'output', run: run.id }); if (run.advisor) F.graph.edges.push({ from: id, to: run.advisor, label: 'for', run: run.id });
      const evt = logEvent(needs ? 'approval.requested' : 'content.drafted', res.output.title, task.agent, run.advisor);
      if (!miss.length) V('output', needs ? 'approval' : 'published', res.output.title, needs ? 'Stored as a draft. Nothing is sent without human approval (POL-1).' : 'Stored and linked to the advisor in the graph', { id, event: evt });
    }
  }
  return verdicts;
}

/* ---------- Normalizing whatever the model returns ---------- */
function resolveAgentId(x) {
  const s = String(x || '').trim(); if (AGENTS[s]) return s;
  const d = s.replace(/_/g, '.').toLowerCase(); if (AGENTS[d]) return d;
  const flat = v => v.toLowerCase().replace(/[^a-z]/g, '');
  return Object.keys(AGENTS).find(k => flat(AGENTS[k].name) === flat(s) || flat(k) === flat(s)) || null;
}
function resolveToolName(x) {
  const s = String(x || '').trim(); if (TOOLS[s]) return s;
  const d = s.replace('_', '.'); if (TOOLS[d]) return d;
  return Object.keys(TOOLS).find(k => k.endsWith('.' + s) || k.replace('.', '_') === s) || null;
}
function sanitizeResult(r) {
  if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = { says: '', output: { kind: 'note', title: 'Result', body: r } }; } }
  if (Array.isArray(r)) r = r.find(x => x && typeof x === 'object' && !Array.isArray(x)) || { output: r.filter(x => typeof x === 'string').join('\n') };
  if (!r || typeof r !== 'object') r = {};
  const arr = x => Array.isArray(x) ? x : (x ? [x] : []), str = (x, n) => String(x ?? '').slice(0, n);
  const o = r.output && typeof r.output === 'object' ? r.output : typeof r.output === 'string' ? { kind: 'note', title: 'Result', body: r.output } : null;
  return {
    says: str(r.says || r.summary || '', 600),
    output: o && (o.body || o.content || o.text) ? { kind: str(o.kind || 'note', 30).toLowerCase(), title: str(o.title || 'Result', 160), body: str(o.body || o.content || o.text, 3000) } : null,
    used: arr(r.used).map(x => str(x, 40)),
    knowledge: arr(r.knowledge).filter(k => k && k.label && k.value).map(k => ({ label: str(k.label, 160), value: str(k.value, 600), evidence: arr(k.evidence).map(x => str(x, 60)) })),
    memory: arr(r.memory).filter(m => m && m.attribute && m.value).map(m => ({ attribute: str(m.attribute, 80), value: str(m.value, 300), scope: str(m.scope || '', 20), category: str(m.category || 'content_pref', 30), basis: str(m.basis || 'inference', 30), evidence: arr(m.evidence).map(x => str(x, 40)) })),
    commitments: arr(r.commitments).filter(c => c && c.title).map(c => ({ title: str(c.title, 160), owner: str(c.owner, 60), due: str(c.due, 40) })),
    needs_approval: !!r.needs_approval, open_questions: arr(r.open_questions).map(x => str(x, 240))
  };
}
function capResult(out) {
  let s = JSON.stringify(out ?? null);
  if (s.length <= 7000) return out;
  if (Array.isArray(out)) return out.slice(0, 4);
  return { truncated: true, preview: s.slice(0, 6500) };
}
/* Rules-based plan, used only when the AI plan can't be read */
function fallbackPlan(run) {
  const t = run.text.toLowerCase(), tasks = [];
  const add = (agent, objective, tools, deps) => tasks.push({ k: 'task', id: 'T' + (tasks.length + 1), agent, objective, depends_on: deps || [], reads: ['memory', 'knowledge', 'policy', 'models'], tools, why: 'Chosen by rule because the AI plan was unavailable.' });
  if (/territor|trend|growing/.test(t)) add('sales.territory', 'Summarize what is growing in the territory, with evidence', ['models.territory_trends']);
  if (/compar|fee|cost|expense|fund|bfa|ambal|gfa|trail/.test(t)) add('product.qar', 'Answer from the data platform: costs, category and approach of the named funds', ['fund.lookup', 'fund.get_facts', 'mstar.get_peers']);
  if (/prep|brief/.test(t) && run.advisor) add('sales.prep', 'Build a one-page brief for the advisor', ['crm.get_call_notes', 'crm.get_opportunities'], tasks.map(x => x.id));
  if (/schedul|meeting|book|calendar/.test(t)) add('sales.schedule', 'Find times and place the meeting', ['calendar.find_times', 'calendar.create_event']);
  if (/email|campaign|follow.?up|draft/.test(t)) add('marketing.email', 'Draft the email from verified material', ['seismic.search_content', 'mail.draft'], tasks.map(x => x.id));
  if (/linkedin|post/.test(t)) add('marketing.linkedin', 'Draft a public post with no advisor identifiers', ['seismic.search_content']);
  if (/link|access|won.?t open|issue|problem|unclear/.test(t)) add('service.resolve', 'Resolve the advisor’s issue', ['service.get_cases']);
  if (/said|profile|from now on|prefers/.test(t)) add('marketing.voc', 'Capture the advisor statement and propose memory under the rules', ['crm.get_call_notes']);
  if (!tasks.length) add(run.advisor ? 'sales.prep' : 'product.qar', run.advisor ? 'Summarize what the foundation knows for this request' : 'Answer the request from verified knowledge', []);
  return tasks.slice(0, 5);
}

/* ---------- AI runtime ---------- */
const AI = { sample: null, tools: false, mode: 'checking', deep: false, recording: null, replay: null };
async function initAI() {
  /* 1. Hosted on your own server with an OpenAI or Azure OpenAI key */
  try {
    const r = await fetch('api/config', { cache: 'no-store' });
    if (r.ok) { const c = await r.json(); if (c && c.provider) { AI.sample = openAISampler(); AI.tools = true; AI.mode = 'live'; AI.provider = `${c.provider === 'azure-openai' ? 'Azure OpenAI' : 'OpenAI'} · ${c.models.orchestrator}`; return; } }
  } catch (e) { }
  /* 2. Inside claude.ai */
  if (window.claude && window.claude.use) {
    try { AI.sample = await window.claude.use('sample'); } catch (e) { AI.sample = null; }
    if (AI.sample) { try { const lim = await AI.sample.limits(); AI.tools = !!(lim && lim.tools); } catch (e) { AI.tools = false; } AI.mode = 'live'; AI.provider = 'Claude'; return; }
  }
  AI.mode = 'replay-only';
}
/* OpenAI connector: same interface the app already uses (sample, sample.json with tools). The key stays on the server. */
function openAISampler() {
  const err = (code, message, text) => Object.assign(new Error(message || code), { code, text });
  async function post(body, signal) {
    let r;
    try { r = await fetch('api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal }); }
    catch (e) { if (e.name === 'AbortError') throw err('cancelled'); throw err('upstream_error', 'Could not reach the server'); }
    if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch (e) { } throw err(r.status === 429 ? 'rate_limited' : r.status === 401 || r.status === 403 ? 'auth_failed' : r.status === 413 ? 'prompt_too_large' : 'upstream_error', m || 'HTTP ' + r.status); }
    return r;
  }
  const tierOf = o => (o && o.modelTier === 'quick') ? 'agent' : 'orchestrator';
  async function sample(prompt, o = {}) {
    const stream = typeof o.onText === 'function';
    const r = await post({ tier: tierOf(o), messages: [{ role: 'user', content: prompt }], stream }, o.signal);
    if (!stream) { const d = await r.json(); const text = d.choices?.[0]?.message?.content || ''; if (!text) throw err('empty_completion'); return { text }; }
    const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const ln of lines) { const s = ln.trim(); if (!s.startsWith('data:')) continue; const p = s.slice(5).trim(); if (p === '[DONE]') continue;
          try { const delta = JSON.parse(p).choices?.[0]?.delta?.content || ''; if (delta) { text += delta; o.onText({ text, delta }); } } catch (e) { } }
      }
    } catch (e) { if (e.name === 'AbortError' || (o.signal && o.signal.aborted)) throw err('cancelled'); throw err('upstream_error', 'Stream interrupted', text); }
    if (!text) throw err('empty_completion');
    return { text };
  }
  sample.json = async function (prompt, o = {}) {
    const tools = o.tools || [];
    const defs = tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
    const messages = [{ role: 'system', content: 'You are a specialist inside an enterprise workbench. When you are done, reply with a single JSON object only.' }, { role: 'user', content: prompt }];
    for (let round = 0; round < 6; round++) {
      const r = await post({ tier: tierOf(o), messages, tools: defs.length ? defs : undefined, json: true }, o.signal);
      const d = await r.json(), msg = d.choices?.[0]?.message;
      if (!msg) throw err('empty_completion');
      if (msg.tool_calls && msg.tool_calls.length) {
        messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          const t = tools.find(x => x.name === tc.function.name); let out;
          try { out = t ? await t.execute(JSON.parse(tc.function.arguments || '{}'), { signal: o.signal }) : { error: 'Unknown tool ' + tc.function.name }; }
          catch (e) { if (o.signal && o.signal.aborted) throw err('cancelled'); out = { error: String(e && e.message || e) }; }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out ?? null).slice(0, 12000) });
        }
        continue;
      }
      const text = msg.content || '';
      try { return JSON.parse(text); } catch (e) { const m = text.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (x) { } } throw err('invalid_json', 'Reply was not JSON', text); }
    }
    throw err('upstream_error', 'Too many tool rounds');
  };
  sample.limits = async () => ({ tools: { maxCount: 10 } });
  return sample;
}
function registryText() { return Object.entries(AGENTS).map(([id, a]) => `${id} | ${a.name} | ${a.team} | ${a.does} | tools: ${a.tools.join(', ') || 'none'}`).join('\n'); }
function foundationHeadlines() {
  return Object.entries(ADVISORS).map(([id, a]) => {
    const mem = F.memory.filter(m => m.adv === id && m.status !== 'superseded' && m.access === 'shared').map(m => `${m.attr}: ${m.value} [${m.scope}; ${m.id}]`).join(' | ');
    const com = F.commitments.filter(c => c.adv === id && c.status === 'Open').map(c => `${c.id} ${c.title}`).join('; ');
    const ep = F.episodes.filter(e => e.adv === id).map(e => `${e.id} (${e.date})`).join(', ');
    return `${id} ${a.name}, ${a.title}, ${FIRMS[a.firm].name}. Units: ${Object.entries(a.units).map(([k, v]) => k + ' ' + v).join('; ')}. Coverage: ${a.coverage.map(c => EMPLOYEES[c].name).join(', ')}.\n  Memory: ${mem || 'none'}\n  Unknown: ${(UNKNOWNS[id] || []).join('; ') || 'nothing flagged'}\n  Open commitments: ${com || 'none'}\n  Episodes: ${ep}`;
  }).join('\n');
}
function orchestratorPrompt(run) {
  const E = EMPLOYEES[run.requester];
  return `You are the Intelligence & Orchestration layer of Capital Group's Connected Client Experience: an AI workbench where named specialist agents in Sales, Product, Marketing and Service share one governed AI foundation (memory, knowledge, verification, models, feedback, events, graph) connected to Salesforce, Microsoft 365, Seismic and the fund data platform. Today is ${TODAY}.

REQUEST
From: ${E.name}, ${TEAMS[E.team].name} · ${E.role}. Covers: ${E.covers.map(c => ADVISORS[c].name).join(', ') || 'no advisors directly'}.
Text: "${run.text}"

CURRENT CONVERSATION (short-term memory)
${JSON.stringify({ active_advisor: F.session.advisor, active_unit: F.session.unit, earlier_requests: F.session.requests.slice(-3).map(q => q.text) })}

GRAPH LOOKUP (deterministic entity resolution)
${JSON.stringify(run.resolution)}

WHAT THE FOUNDATION HOLDS
${foundationHeadlines()}
Verified findings: ${F.findings.map(k => `${k.id} ${k.label}`).join('; ')}
Content (Seismic): ${CONTENT.map(c => `${c.id} ${c.title} [${c.audience}]`).join('; ')}
Funds (data platform): ${Object.entries(FUNDS).map(([k, f]) => `${k} ${f.name}`).join('; ')}
Pending memory validations: ${F.pending.map(p => `${p.id} ${p.attr}`).join('; ') || 'none'}
Capital Group colleagues (NOT advisors; a meeting with them is internal): ${Object.values(EMPLOYEES).map(x => `${x.name} (${TEAMS[x.team].name})`).join('; ')}
Territories: ${Object.entries(TERRITORIES).map(([k, t]) => `${k} ${t.name}: ${t.advisors.map(a => ADVISORS[a].short).join(', ')}`).join('; ')}
Fund nicknames: GFA = Growth Fund of America (GFFFX F-2), BFA = The Bond Fund of America (ABNFX F-2), AMBAL = American Balanced Fund (AMBFX F-2), WMIF = Washington Mutual (AWSHX), IFA = Income Fund of America (AMECX)

WORKBENCH TEAMS (every task is assigned to one of these roles and appears on that team's workbench)
${Object.entries(ROLES).map(([k, r]) => `${k} | ${TEAMS[r.team].name} · ${r.name} | ${r.does} | specialists: ${Object.keys(AGENTS).filter(a => roleOf(a) === k).join(', ')}`).join('\n')}
Routing rules: meeting preparation goes to sales.wholesalers; scheduling and anything that is follow-up goes to sales.ssc; territory insight goes to sales.internal.

AGENT REGISTRY (choose only these ids)
${registryText()}

RULES
${POLICIES.map(p => p.id + ' ' + p.text).join('\n')}

Output ONLY newline-delimited JSON, one object per line, no prose and no code fences, in this order:
{"k":"decision","type":"requester","title":"...","detail":"..."}
{"k":"decision","type":"intent","title":"...","detail":"...","intent":"meeting_prep|research|content|campaign|service|profile_update|question"}
{"k":"decision","type":"asks","title":"N things requested","detail":"...","asks":["each distinct thing the person asked for, in their words, 2 to 8 words each"]}
{"k":"decision","type":"entity","title":"...","detail":"...","advisor":"ADV-...|null","unit":"BU-...|null","territory":"LA|OC|SD|null","confidence":"high|medium|low"}
{"k":"decision","type":"scope","title":"...","detail":"..."}
{"k":"decision","type":"known","title":"...","detail":"...","uses":["ids you will reuse"]}
{"k":"decision","type":"missing","title":"...","detail":"..."}
{"k":"decision","type":"memory","title":"...","detail":"...","class":"read_only|task_requirement|lasting_preference_candidate|none"}
{"k":"decision","type":"controls","title":"...","detail":"..."}
then 2 to 5 lines {"k":"task","id":"T1","ask":1,"title":"3 to 6 words, as it appears on the team's workbench","role":"workbench role id","agent":"registry id from that role","objective":"one sentence","depends_on":[],"reads":["memory","knowledge","policy","models","events","feedback"],"tools":["tool names from that agent's list"],"why":"why this specialist"}
{"k":"decision","type":"success","title":"...","detail":"..."}
{"k":"end"}
Requests can be about one advisor, a territory, a product, or internal work with colleagues. Not every request needs an advisor: for a territory set advisor null and territory; for product-only or internal work set both null.
Ask for clarification only if acting would be unsafe or impossible: emit {"k":"clarify","question":"..."} after the entity decision, then {"k":"end"}. Otherwise make a sensible assumption and state it in the "missing" decision.
${run.clarified ? `You already asked: "${run.clarified.question}". The user answered: "${run.clarified.answer}". Do NOT ask again. Proceed, interpreting the answer as best you can, and state your assumption.` : ''}
Be precise: titles of 3 to 6 words, details of at most 16 words, no filler. Reuse foundation records instead of redoing work.
Tell the story a real team would: choose the specialists who genuinely own each part (usually 3 to 5, across teams when the work crosses teams), and chain them with depends_on so later specialists build on what earlier ones publish to the foundation. Tasks that don't depend on each other run in parallel.
Every ask must be covered by at least one task, and every task must serve one ask ("ask" is its 1-based number). Do not add work the person did not ask for.
Classify new information about the advisor strictly: an employee's request is not an advisor preference.`;
}
function agentPrompt(task, run, packet, upstream, withTools) {
  const a = AGENTS[task.agent], E = EMPLOYEES[run.requester];
  const lines = packet.items.map(i => `[${i.id}] (${i.layer}, from ${i.from}, scope ${i.scope}) ${i.label}: ${i.value}`).join('\n');
  const up = upstream.length ? upstream.map(u => { const R = ROLES[roleOf(u.agent)]; return `${u.task} by ${R ? R.name + ' (' + TEAMS[R.team].name + ')' : AGENTS[u.agent].name}: ${u.title}\n${u.body}\nPublished: ${u.ids.join(', ') || 'nothing'}`; }).join('\n\n') : 'None.';
  const tl = withTools ? `\nYou can call your enterprise tools (Salesforce and Microsoft 365 through the MCP gateway; the data and model platform, Seismic exports and Morningstar through APIs). Call a tool only when the packet lacks what you need.` : `\nTool results fetched for you:\n${JSON.stringify(task.prefetched || {})}`;
  return `You are ${a.name}, a ${TEAMS[a.team].name} specialist agent working for the ${ROLES[task.role] ? ROLES[task.role].name : TEAMS[a.team].name} team in Capital Group's Connected Client Experience. Your job: ${a.does}. Today is ${TODAY}.
Task from orchestration (${task.id}): ${task.objective}
Original request from ${E.name} (${TEAMS[E.team].name}): "${run.text}"
Active scope: advisor ${run.advisor || 'none'} · unit ${run.unit || 'none'}

CONTEXT PACKET FROM THE SHARED AI FOUNDATION (only what you are permitted to see):
${lines || 'Empty.'}
Withheld from you: ${packet.withheld.map(w => w.id + ' (' + w.why + ')').join('; ') || 'nothing'}

WORK FROM OTHER SPECIALISTS IN THIS PLAN:
${up}
${tl}

RULES
- Use only facts from the packet, upstream work or tool results, and cite their ids in "used".
- Never write a fund number, dollar figure or percentage unless it appears in the packet or a tool result. For costs on an amount, use models.cost_on_assets. Never write performance returns.
- Personal notes never go in client-facing content. Public content never names advisors.
- Memory: propose a lasting preference with "basis":"advisor_statement" only when the advisor's own words in a cited episode (CALL-/EMAIL- id) support it. An employee's ask is "employee_request"; a one-time need is "task_requirement"; a guess is "inference". Propose memory only for genuinely new information.
- Knowledge: publish only reusable, evidence-backed findings with evidence ids.
- When you mention other contributors, name their team role (for example Investment analytics, Product specialists, SSC, Wholesalers), not internal agent names.

Reply with only a JSON object:
{"says":"one first-person sentence, at most 22 words: what you did and which team's work you built on (name teams, not agents)","output":{"kind":"brief|email|finding|answer|plan|content_pick|post|case_update|note","title":"...","body":"under 150 words; '- ' bullets; blank line between paragraphs"},"used":["ids"],"knowledge":[{"label":"...","value":"...","evidence":["ids"]}],"memory":[{"attribute":"...","value":"...","scope":"BU-...|advisor","category":"content_pref|communication_pref|priority|relationship","basis":"advisor_statement|employee_request|task_requirement|inference","evidence":["ids"]}],"commitments":[{"title":"...","owner":"...","due":"..."}],"needs_approval":false,"open_questions":[]}
Use empty arrays when nothing applies.`;
}
function toolDefs(task, onCall) {
  return (task.tools || []).filter(t => TOOLS[t]).map(name => {
    const T = TOOLS[name], props = {};
    for (const [k, v] of Object.entries(T.props)) props[k] = v === 'array' ? { type: 'array', items: { type: 'string' } } : { type: v };
    return { name: name.replace('.', '_'), description: `${T.desc} (${SYSTEMS[T.sys].name} via ${T.via})`, inputSchema: { type: 'object', properties: props }, execute: async input => onCall(name, input) };
  });
}
