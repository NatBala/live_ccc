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
const M1 = x => Math.round(x * 10) / 10, pct1 = (c, p) => p ? Math.round((c - p) / p * 1000) / 10 : null;
const adv = id => { const a = !S(id) ? null : ADVISORS[S(id)] || Object.entries(ADVISORS).find(([k, x]) => x.short.toLowerCase() === S(id).toLowerCase() || x.name.toLowerCase().includes(S(id).toLowerCase()))?.[1]; if (!a) throw new Error('Unknown advisor id. Use ids like ADV-101.'); return a; };
const advId = id => !S(id) ? undefined : ADVISORS[S(id)] ? S(id) : Object.keys(ADVISORS).find(k => ADVISORS[k].short.toLowerCase() === S(id).toLowerCase() || ADVISORS[k].name.toLowerCase().includes(S(id).toLowerCase())); /* an empty id matches nobody */
/* ---------- computations behind Lead Me, Territory Planning and Schedule Me (deterministic, on simulated data) ---------- */
const lastContact = id => { const d = EPISODES.filter(e => e.adv === id).map(e => Date.parse(e.date)).sort((x, y) => y - x)[0]; return d ? Math.round((Date.parse('Sep 29, 2026') - d) / 864e5) : null; };
function leadDiscover(a, save = true) {
  const cat = S(a.category).toLowerCase() || 'equity', group = CATEGORY_GROUPS[Object.keys(CATEGORY_GROUPS).find(k => cat.includes(k)) || 'equity'];
  const minA = Number(a.min_category_assets_usd_m) || 0, maxS = Number(a.max_share_pct) || 100, days = Number(a.not_contacted_days) || 0;
  const T = Object.keys(TERRITORIES).find(k => k.toLowerCase() === S(a.territory).toLowerCase()), pool = T ? TERRITORIES[T].advisors : Object.keys(ADVISORS);
  const ranked = [], excluded = [];
  for (const id of pool) {
    const ind = group.reduce((t, c) => t + ((INDUSTRY_BOOK[id] || {})[c] || 0), 0), cg = M1(BOOK[id].funds.filter(f => group.includes(FUND_CATEGORY[f[0]])).reduce((t, f) => t + f[2], 0)), share = ind ? M1(cg / ind * 100) : null, lc = lastContact(id);
    const why = !ind ? 'No industry-book assets in ' + group.join(' or ') : ind < minA ? `Category assets $${ind}M below the $${minA}M minimum` : share > maxS ? `CG share ${share}% above the ${maxS}% limit` : days && lc != null && lc < days ? `Contacted ${lc} days ago, inside the ${days}-day window` : null;
    if (why) { excluded.push({ advisor: ADVISORS[id].name, reason: why }); continue; }
    ranked.push({ advisor: ADVISORS[id].name, advisor_id: id, category_assets_usd_m: ind, cg_assets_usd_m: cg, cg_share_pct: share, headroom_usd_m: M1(ind - cg), days_since_contact: lc, signal: ALPHA[id] ? `Sales Alpha ${ALPHA[id].score} (a signal, not intent)` : 'No Sales Alpha score' });
  }
  ranked.sort((x, y) => y.headroom_usd_m - x.headroom_usd_m).forEach((r, k) => { r.rank = k + 1; });
  const out = { ranking_id: 'RANK-' + (save && typeof F !== 'undefined' ? 900 + (++F.seq) : 928), produced: TODAY, criteria: { categories: group, min_category_assets_usd_m: minA, max_share_pct: maxS, territory: T ? TERRITORIES[T].name : 'All covered advisors', not_contacted_days: days || null },
    basis: 'Ranked by headroom: the advisor’s category assets with other managers (industry book, Jun 30, 2026) minus CG assets (Aug 31, 2026).', ranked, excluded };
  if (save && typeof F !== 'undefined') F.lastRanking = out;
  return out;
}
const LEAD_RANKING_SAMPLE = Object.assign(leadDiscover({ category: 'equity', min_category_assets_usd_m: 50 }, false), { note: 'Saved ranking from Sep 28, 2026 (equity-fund leads, minimum $50M in equity categories). No ranking has been produced in this session yet.' });
function peerCompare(id) {
  if (!id) return { note: 'Name an advisor.' };
  const cohort = Object.entries(PEER_COHORTS).find(([, ids]) => ids.includes(id)), stats = x => { const B = BOOK[x], tot = M1(B.funds.reduce((t, f) => t + f[2], 0)), etf = M1(B.funds.filter(f => f[1] === 'ETF').reduce((t, f) => t + f[2], 0)), Fl = FLOWS[x], net = M1(Object.keys(Fl.sales).reduce((t, v) => t + Fl.sales[v][0] - Fl.redemptions[v][0], 0)); return { cg_assets_usd_m: tot, etf_share_pct: M1(etf / tot * 100), net_flows_12m_usd_m: net }; };
  const med = arr => { const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : M1((s[m - 1] + s[m]) / 2); };
  const peers = cohort[1].filter(x => x !== id).map(stats), me = stats(id);
  return { advisor: ADVISORS[id].name, cohort: cohort[0], cohort_size: cohort[1].length, definition: 'Permitted cohort by practice type; internal coverage data only, no client data. Peers are not named.', advisor_values: me,
    cohort_median: { cg_assets_usd_m: med(peers.map(p => p.cg_assets_usd_m)), etf_share_pct: med(peers.map(p => p.etf_share_pct)), net_flows_12m_usd_m: med(peers.map(p => p.net_flows_12m_usd_m)) }, caveat: 'Small cohort; treat as directional.' };
}
function pipelineScore(a) {
  const id = advId(a.advisor_id), T = Object.keys(TERRITORIES).find(k => k.toLowerCase() === S(a.territory).toLowerCase()), pool = id ? [id] : T ? TERRITORIES[T].advisors : Object.keys(ADVISORS), stageW = { Discovery: 10, Qualified: 20, Proposal: 30, Paperwork: 35 };
  const rows = OPPORTUNITIES.filter(o => pool.includes(o.adv) && !/closed/i.test(o.stage)).map(o => { const D = PIPELINE_DETAIL[o.id] || {}, age = Math.round((Date.parse('Sep 29, 2026') - Date.parse(D.last_activity || 'Sep 29, 2026')) / 864e5), size = Math.min(40, Math.round((D.est_usd_m || 0) / 15 * 40)), fresh = age <= 14 ? 30 : age <= 30 ? 20 : 5, stage = stageW[o.stage] || 10;
    return { id: o.id, name: o.name, advisor: ADVISORS[o.adv].name, stage: o.stage, est_usd_m: D.est_usd_m, days_since_activity: age, next_action: D.next, score: stage + size + fresh, basis: { stage, size, recency: fresh } }; }).sort((x, y) => y.score - x.score);
  return { as_of: 'Sep 29, 2026', method: 'Score = stage (10 to 35) + size (up to 40, scaled to $15M) + recency (30 if active in 14 days, 20 within 30, else 5). Closed opportunities are excluded.', opportunities: rows };
}
function coverageReport(terr) {
  const T = Object.keys(TERRITORIES).find(k => k.toLowerCase() === terr.toLowerCase()), pool = T ? TERRITORIES[T].advisors : Object.keys(ADVISORS), now = Date.parse('Sep 29, 2026');
  return { window: 'Last 90 days to Sep 29, 2026', definition: 'Completed contacts recorded in Salesforce, against the coverage tier target for 90 days.', advisors: pool.map(id => { const [tier, target] = COVERAGE_TIERS[id], n = F.episodes.filter(e => e.adv === id && now - Date.parse(e.date) <= 90 * 864e5).length;
    return { advisor: ADVISORS[id].name, tier, target_contacts: target, completed_contacts: n, status: n > target ? 'Over-covered' : n < target / 2 ? 'Neglected' : n < target ? 'Under target' : 'On target', last_contact_days: lastContact(id) }; }) };
}
function zoneVisits(a) {
  const ids = (Array.isArray(a.advisor_ids) ? a.advisor_ids : S(a.advisor_ids).split(/[ ,]+/)).map(advId).filter(Boolean), T = Object.keys(TERRITORIES).find(k => k.toLowerCase() === S(a.territory).toLowerCase() || TERRITORIES[k].name.toLowerCase() === S(a.territory).toLowerCase());
  const pool = ids.length ? ids : T ? TERRITORIES[T].advisors : [];
  if (!pool.length) return { note: `No covered advisors in ${S(a.territory) || 'that area'}. Covered territories: Los Angeles, Orange County, San Diego.` };
  const zones = {}; pool.forEach(id => { const [z, mins] = ZONES[id]; (zones[z] = zones[z] || { zone: z, drive_minutes_from_irvine: mins, advisors: [] }).advisors.push({ advisor: ADVISORS[id].name, office: ADVISORS[id].office }); });
  const days = ['Tue Oct 6', 'Wed Oct 14', 'Thu Oct 22', 'Tue Oct 27'];
  return { month: S(a.month) || 'October 2026', base: 'Irvine', zones: Object.values(zones).sort((x, y) => y.drive_minutes_from_irvine - x.drive_minutes_from_irvine).map((z, k) => Object.assign(z, { proposed_day: days[k % days.length] })), note: 'Proposed days only; nothing is booked.' };
}
/* ---------- Activity generated on the fly for any advisor and period (deterministic: same inputs, same numbers) ---------- */
function seededRandom(key) {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) { h = Math.imul(h ^ key.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const fmtDay = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dayMs = s => Date.parse(S(s) + ' UTC');
/* Purchases and redemptions between two dates: recorded transactions first, then generated ones shaped by the advisor's own book and flow trend */
function activityFeed(id, since, until) {
  const B = BOOK[id], X = FLOWS[id], t0 = dayMs(since), t1 = dayMs(until), days = Math.max(1, Math.round((t1 - t0) / 864e5));
  const recorded = FUND_TRANSACTIONS.filter(t => t[0] === id && dayMs(t[1]) > t0 && dayMs(t[1]) <= t1).map(([, d, f, ty, amt]) => ({ date: fmtDay(dayMs(d)), fund: f, vehicle: (B.funds.find(x => x[0] === f) || [0, FUNDS[f] && FUNDS[f].vehicle === 'ETF' ? 'ETF' : MF])[1], type: ty, amount_usd_m: amt }));
  const rnd = seededRandom(id + '|' + since + '|' + until), funds = B.funds.filter(f => f[1] !== 'SMA'), total = funds.reduce((t, f) => t + f[2], 0);
  const trend = v => X && X.sales[v] ? (X.sales[v][0] - X.sales[v][1]) - ((X.redemptions[v] || [0, 0])[0] - (X.redemptions[v] || [0, 0])[1]) : 0;
  const n = Math.max(0, Math.min(8, Math.max(2, Math.round(days / 2.5))) - recorded.length), scale = Math.max(0.2, total / 60), generated = [];
  for (let k = 0; k < n; k++) {
    let r = rnd() * total, f = funds[0]; for (const x of funds) { if ((r -= x[2]) <= 0) { f = x; break; } }
    const buy = rnd() < (trend(f[1]) >= 0 ? 0.72 : 0.35), amt = M1(Math.max(0.1, (0.15 + rnd() * 0.85) * scale));
    generated.push({ date: fmtDay(t0 + (1 + Math.floor(rnd() * days)) * 864e5), fund: f[0], vehicle: f[1], type: buy ? 'Purchase' : 'Redemption', amount_usd_m: amt });
  }
  return [...recorded, ...generated].filter(t => dayMs(t.date) <= t1).sort((a, b) => dayMs(a.date) - dayMs(b.date));
}
/* Everything that changed for an advisor since a date (by default, the last completed meeting) */
function changesSince(a) {
  const id = advId(a.advisor_id); if (!id || !BOOK[id]) return { note: 'Name an advisor to compare against their last meeting.' };
  const eps = F.episodes.filter(e => e.adv === id).sort((x, y) => dayMs(y.date) - dayMs(x.date)), last = eps.find(e => /call|meeting/i.test(e.kind)) || eps[0]; /* the last call or meeting; an email only if there was none */
  const since = S(a.since) && !isNaN(dayMs(a.since)) ? fmtDay(dayMs(a.since)) : last ? last.date : 'Sep 1, 2026', until = 'Sep 29, 2026', t0 = dayMs(since), inWin = d => dayMs(d) > t0 && dayMs(d) <= dayMs(until);
  const rnd = seededRandom('assets|' + id + '|' + since), base = BOOK[id].funds.reduce((t, f) => t + f[2], 0), tx = activityFeed(id, since, until);
  const byVeh = {}; tx.forEach(t => { const v = byVeh[t.vehicle] = byVeh[t.vehicle] || { vehicle: t.vehicle, purchases_usd_m: 0, redemptions_usd_m: 0 }; if (t.type === 'Purchase') v.purchases_usd_m = M1(v.purchases_usd_m + t.amount_usd_m); else v.redemptions_usd_m = M1(v.redemptions_usd_m + t.amount_usd_m); });
  Object.values(byVeh).forEach(v => { v.net_usd_m = M1(v.purchases_usd_m - v.redemptions_usd_m); });
  const net = M1(Object.values(byVeh).reduce((t, v) => t + v.net_usd_m, 0)), start = M1(base * (1 + (rnd() - 0.4) * 0.02)), market = M1(start * (rnd() - 0.45) * 0.012), end = M1(start + net + market);
  const firm = ADVISORS[id].firm, shelf = SHELF[firm] ? SHELF[firm].items.filter(i => i[3] && !isNaN(dayMs(i[3])) && inWin(i[3])).map(([t, p, st, d]) => ({ date: d, change: `${t} ${st.toLowerCase()} in ${p}` })) : [];
  const pipe = OPPORTUNITIES.filter(o => o.adv === id).flatMap(o => (PIPELINE_HISTORY[o.id] || []).filter(([d]) => inWin(d)).map(([d, st]) => ({ date: d, opportunity: `${o.id} ${o.name}`, stage: st })));
  const digital = DIGITAL.filter(d => d[0] === id && inWin(d[1])).map(([, d, k, item]) => ({ date: d, kind: k, item })), events = CHANGE_EVENTS.filter(e => e[0] === id && inWin(e[1])).map(([, d, what, src]) => ({ date: d, event: what, source: src }));
  const contacts = eps.filter(e => inWin(e.date)).map(e => ({ date: e.date, id: e.id, kind: e.kind, with: e.with })), cases = F.cases.filter(c => c.adv === id && c.opened && inWin(c.opened)).map(c => ({ id: c.id, opened: c.opened, status: c.status }));
  const biggest = [...tx].sort((x, y) => y.amount_usd_m - x.amount_usd_m)[0], topVeh = Object.values(byVeh).sort((x, y) => Math.abs(y.net_usd_m) - Math.abs(x.net_usd_m))[0];
  const highlights = [
    topVeh && `${topVeh.vehicle} net ${topVeh.net_usd_m >= 0 ? 'inflow' : 'outflow'} of $${Math.abs(topVeh.net_usd_m)}M since ${since}`,
    biggest && `Largest transaction: ${biggest.type.toLowerCase()} of $${biggest.amount_usd_m}M in ${biggest.fund} on ${biggest.date}`,
    ...pipe.map(p => `${p.opportunity} moved to ${p.stage} on ${p.date}`), ...shelf.map(s => `${s.change} (${s.date})`),
    digital.length && `${digital.length} attributable digital ${digital.length === 1 ? 'event' : 'events'}, latest: ${digital[digital.length - 1].item}`, ...events.map(e => `${e.event} (${e.date})`)
  ].filter(Boolean).slice(0, 6);
  return { advisor: ADVISORS[id].name, last_meeting: last ? { id: last.id, date: last.date, kind: last.kind, with: last.with } : null, period: `${since} to ${until}`, days: Math.round((dayMs(until) - t0) / 864e5),
    assets: { start_usd_m: start, net_flows_usd_m: net, market_and_other_usd_m: market, end_usd_m: end, note: 'Market and other changes are the residual after net flows; not fund performance.' },
    flows_by_vehicle: Object.values(byVeh), transactions: tx, pipeline_changes: pipe, platform_changes: shelf, digital_engagement: digital, business_events: events, other_contacts: contacts, service_cases: cases, highlights,
    source: 'Change history service: recorded activity plus a generated activity feed for the period (simulated)' };
}
const TOOLS = {
  'crm.get_contact': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce: advisor contact, firm, team, buying units and coverage.', props: { advisor_id: 'string' },
    run: a => { const x = adv(a.advisor_id), id = advId(a.advisor_id), sh = SHELF[x.firm]; return { name: x.name, title: x.title, firm: FIRMS[x.firm].name, office: x.office, team: x.team, units: x.units, coverage: x.coverage.map(c => EMPLOYEES[c].name), platform_programs: sh && sh.advisor_programs[id] ? sh.advisor_programs[id] : 'not in reference data' }; } },
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
  'service.update_case': { sys: 'sf', via: 'MCP', rw: 'write', desc: 'Service Cloud: add a resolution note and status (Open, Pending advisor, Resolved) to a case, or open a new one.', props: { case_id: 'string', note: 'string', status: 'string' },
    run: a => { const id = S(a.case_id) || 'CASE-00' + (600 + F.seq), c = F.cases.find(x => x.id === id), status = S(a.status) || 'Updated';
      if (c && S(a.status)) c.status = status;
      return { case_id: id, status, note: S(a.note).slice(0, 600), history: c ? `Added to ${id} history in Service Cloud; owner ${c.owner || 'Advisor service'}` : 'New case opened in Service Cloud' }; } },
  'contact.get_interactions': { sys: 'gen', via: 'MCP', rw: 'read', desc: 'Genesys Cloud: recent calls and chats from an advisor or their team, with what they said and who handled it.', props: { advisor_id: 'string' },
    run: a => INTERACTIONS.filter(x => x.adv === advId(a.advisor_id)) },
  'service.get_insights': { sys: 'gen', via: 'API', rw: 'read', desc: 'Genesys Cloud and Service Cloud, aggregated: what advisors ask Service about a topic (fees, access) this quarter. No advisor identifiers.', props: { topic: 'string' },
    run: a => { const t = S(a.topic).toLowerCase(), k = /fee|cost|expense|transparen/.test(t) ? 'fees' : /link|access|deliver/.test(t) ? 'access' : null; return k ? Object.assign({ topic: k }, SERVICE_INSIGHTS[k]) : { topic: t, note: 'No aggregated insights for this topic. Known topics: fees, access.' }; } },
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
  'sharepoint.get_disclosures': { sys: 'm365', via: 'API', rw: 'read', desc: 'SharePoint compliance library: required disclosures and channel rules for a content type (advisor email, LinkedIn post, committee pack).', props: { content_type: 'string' },
    run: a => { const t = S(a.content_type).toLowerCase(), k = /linkedin|social|post|public/.test(t) ? 'social' : /committee|plan|retirement/.test(t) ? 'committee' : 'email';
      return { channel: k, required_disclosures: DISCLOSURES[k].required, channel_rules: DISCLOSURES[k].rules }; } },
  'seismic.search_content': { sys: 'seismic', via: 'MCP', rw: 'read', desc: 'Seismic: search approved content by keywords and audience. Returns ids, titles, audience, format.', props: { query: 'string' },
    run: a => { const q = S(a.query).toLowerCase().split(/\W+/).filter(w => w.length > 2); return CONTENT.map(c => ({ c, s: q.filter(w => (c.tags + ' ' + c.title.toLowerCase()).includes(w)).length })).filter(x => x.s).sort((x, y) => y.s - x.s).slice(0, 4).map(x => ({ id: x.c.id, title: x.c.title, audience: x.c.audience, format: x.c.format, status: x.c.status })); } },
  'seismic.get_approved_language': { sys: 'seismic', via: 'MCP', rw: 'read', desc: 'Seismic messaging library: approved language on a topic (fees, active vs index, performance), with ids to cite.', props: { topic: 'string' },
    run: a => { const q = S(a.topic).toLowerCase().split(/\W+/).filter(w => w.length > 2); const hits = APPROVED_LANGUAGE.filter(m => q.some(w => (m.topic + ' ' + m.text.toLowerCase()).includes(w))); return (hits.length ? hits : APPROVED_LANGUAGE).slice(0, 4); } },
  'seismic.get_delivery_log': { sys: 'seismic', via: 'API', rw: 'read', desc: 'Seismic LiveSend: delivery and link activity for content sent to an advisor (opens, link clicks, expiry, recipient access).', props: { advisor_id: 'string' },
    run: a => DELIVERIES.filter(x => x.adv === advId(a.advisor_id)) },
  'mcloud.get_engagement': { sys: 'mcloud', via: 'API', rw: 'read', desc: 'Marketing Cloud: how past content on a topic performed (opens, clicks, engagement) and what resonated.', props: { topic: 'string' },
    run: a => /fee|cost|expense|transparen/.test(S(a.topic).toLowerCase()) ? { topic: 'fees', results: ENGAGEMENT.fees } : { topic: S(a.topic), results: [], note: 'No campaign history for this topic. Known topics: fees.' } },
  'aem.get_page': { sys: 'aem', via: 'API', rw: 'read', desc: 'Adobe Experience Manager: published, approved web pages a post or email may link to.', props: { query: 'string' },
    run: a => { const q = S(a.query).toLowerCase().split(/\W+/).filter(w => w.length > 2); return AEM_PAGES.filter(p => q.some(w => (p.tags + ' ' + p.title.toLowerCase()).includes(w))).map(({ tags, ...p }) => p); } },
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
  'crm.get_plan': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce: retirement plan records an advisor’s committee oversees: plan, assets, participants, committee, meeting dates and lineup.', props: { advisor_id: 'string' },
    run: a => Object.entries(PLANS).filter(([, p]) => p.adv === advId(a.advisor_id)).map(([id, p]) => ({ plan_id: id, name: p.name, assets_usd: p.assets_usd, participants: p.participants, committee: p.committee, next_meeting: p.next_meeting, materials_due: p.materials_due, lineup: p.lineup.map(o => ({ option: o.option, fund: o.fund, fund_name: FUNDS[o.fund].name, assets_usd: o.assets_usd })), other: p.other })) },
  'models.plan_fee_comparison': { sys: 'fund', via: 'API', rw: 'read', desc: 'Model platform: fee comparison for a retirement plan lineup: each option’s expense ratio against its Morningstar category median, in basis points and annual dollars on the option’s assets.', props: { plan_id: 'string' },
    run: a => { const id = PLANS[S(a.plan_id)] ? S(a.plan_id) : Object.keys(PLANS).find(k => PLANS[k].adv === advId(a.plan_id)); if (!id) return { note: 'No retirement plan on file for this advisor. Plans on file: ' + Object.keys(PLANS).join(', ') };
      const P = PLANS[id], r2 = x => Math.round(x * 1000) / 1000;
      const options = P.lineup.map(o => { const f = FUNDS[o.fund], c = PEERS[o.category];
        return { option: o.option, fund: o.fund, share_class: f.name.split(', ')[1] || '', assets_usd: o.assets_usd, expense_ratio_pct: f.er, er_as_of: f.asOf, category: o.category, category_median_pct: c.medianEr,
          difference_bps: Math.round((f.er - c.medianEr) * 100), annual_cost_usd: Math.round(o.assets_usd * f.er / 100), annual_cost_at_median_usd: Math.round(o.assets_usd * c.medianEr / 100) }; });
      const covered = options.reduce((t, o) => t + o.assets_usd, 0), cost = options.reduce((t, o) => t + o.annual_cost_usd, 0);
      const same = [...new Set(P.lineup.map(o => o.category))].map(cat => options.filter(o => o.category === cat)).filter(g => g.length > 1).map(g => { const base = Math.max(...g.map(o => o.assets_usd)); return { category: g[0].category, on_assets_usd: base, costs: g.map(o => ({ fund: o.fund, option: o.option, annual_cost_usd: Math.round(base * o.expense_ratio_pct / 100) })) }; });
      return { plan_id: id, plan: P.name, options, covered_assets_usd: covered, covered_annual_cost_usd: cost, covered_weighted_expense_ratio_pct: r2(cost / covered * 100), same_category_on_equal_assets: same, not_covered: P.other, sources: 'Expense ratios: fund data platform (as of dates shown). Category medians: Morningstar (' + [...new Set(P.lineup.map(o => PEERS[o.category].note))].join('; ') + ').' }; } },
  /* ---- Sales AI shared services: amounts in $ millions so every figure an agent quotes traces to the tool ---- */
  'book.get_assets': { sys: 'fund', via: 'API', rw: 'read', desc: 'Assets service: Capital Group assets for an advisor’s team by vehicle and fund as of a date, with the prior-year snapshot and mix change. Amounts in $ millions.', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id), B = BOOK[id]; if (!B) return { advisor: id ? ADVISORS[id].name : S(a.advisor_id), note: 'No book data for this advisor in the assets service.' };
      const veh = {}; B.funds.forEach(([, v, x]) => { veh[v] = M1((veh[v] || 0) + x); });
      const total = M1(Object.values(veh).reduce((t, x) => t + x, 0)), ptotal = M1(Object.values(B.prior_by_vehicle).reduce((t, x) => t + x, 0));
      return { advisor: ADVISORS[id].name, entity: B.entity, as_of: B.as_of, total_usd_m: total, prior_as_of: B.prior_as_of, prior_total_usd_m: ptotal,
        by_vehicle: Object.entries(veh).map(([v, x]) => { const p = B.prior_by_vehicle[v] || 0; return { vehicle: v, assets_usd_m: x, share_pct: M1(x / total * 100), prior_assets_usd_m: p, prior_share_pct: M1(p / ptotal * 100), change_usd_m: M1(x - p), share_change_pp: M1(x / total * 100 - p / ptotal * 100) }; }),
        by_fund: B.funds.map(([f, v, x]) => ({ fund: f, name: FUNDS[f] ? FUNDS[f].name : 'Capital Group ' + f, vehicle: v, assets_usd_m: x })) }; } },
  'book.get_flows': { sys: 'fund', via: 'API', rw: 'read', desc: 'Flows service: gross sales, redemptions and net flows by vehicle and channel, trailing twelve months against the prior twelve, with each vehicle’s contribution to the change in sales. Amounts in $ millions.', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id), X = FLOWS[id]; if (!X) return { advisor: id ? ADVISORS[id].name : S(a.advisor_id), note: 'No flow data for this advisor in the flows service.' };
      const row = o => Object.entries(o).map(([k, [c, p]]) => ({ name: k, current_usd_m: c, prior_usd_m: p, change_usd_m: M1(c - p), change_pct: pct1(c, p) }));
      const sum = (o, i) => M1(Object.values(o).reduce((t, x) => t + x[i], 0)), tS = [sum(X.sales, 0), sum(X.sales, 1)], tR = [sum(X.redemptions, 0), sum(X.redemptions, 1)], dS = M1(tS[0] - tS[1]);
      return { advisor: ADVISORS[id].name, current_period: X.current, prior_period: X.prior,
        totals: { gross_sales: { current_usd_m: tS[0], prior_usd_m: tS[1], change_usd_m: dS, change_pct: pct1(tS[0], tS[1]) }, redemptions: { current_usd_m: tR[0], prior_usd_m: tR[1], change_usd_m: M1(tR[0] - tR[1]), change_pct: pct1(tR[0], tR[1]) }, net_flows: { current_usd_m: M1(tS[0] - tR[0]), prior_usd_m: M1(tS[1] - tR[1]) } },
        gross_sales_by_vehicle: row(X.sales), redemptions_by_vehicle: row(X.redemptions),
        net_flows_by_vehicle: Object.keys(X.sales).map(v => ({ vehicle: v, current_usd_m: M1(X.sales[v][0] - X.redemptions[v][0]), prior_usd_m: M1(X.sales[v][1] - X.redemptions[v][1]) })),
        contribution_to_sales_change: Object.entries(X.sales).map(([v, [c, p]]) => ({ vehicle: v, change_usd_m: M1(c - p), share_of_total_change_pct: dS ? M1((c - p) / dS * 100) : null })),
        gross_sales_by_channel: row(X.channels), limitations: X.limitations }; } },
  'book.get_market_share': { sys: 'fund', via: 'API', rw: 'read', desc: 'Market share service: the metric definition, numerator and denominator by category, their as-of dates, and any discrepancy. Amounts in $ millions.', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id), X = MARKET_SHARE[id], B = BOOK[id]; if (!X || !B) return { advisor: id ? ADVISORS[id].name : S(a.advisor_id), note: 'No market-share data for this advisor.' };
      const amt = f => (B.funds.find(x => x[0] === f) || [0, 0, 0])[2];
      return { advisor: ADVISORS[id].name, definition: X.definition, numerator_as_of: X.numerator_as_of, denominator_as_of: X.denominator_as_of, denominator_source: X.denominator_source,
        categories: X.categories.map(([c, fs, ind]) => { const cg = M1(fs.reduce((t, f) => t + amt(f), 0)); return { category: c, cg_funds: fs, cg_assets_usd_m: cg, industry_assets_usd_m: ind, share_pct: M1(cg / ind * 100) }; }),
        excluded_usd_m: M1(B.funds.filter(f => f[1] === 'SMA').reduce((t, f) => t + f[2], 0)), excluded_note: 'SMA assets are excluded by the definition',
        discrepancy: X.numerator_as_of !== X.denominator_as_of ? `Numerator (${X.numerator_as_of}) and denominator (${X.denominator_as_of}) dates differ; shares can be off until the industry book refreshes.` : null }; } },
  'platform.get_availability': { sys: 'fund', via: 'API', rw: 'read', desc: 'Platform eligibility: dealer platform and program availability for Capital Group funds and ETFs with effective dates. Pass advisor_id (uses their firm and programs), optionally ticker, program, or since (a date) to list changes after it.', props: { advisor_id: 'string', ticker: 'string', program: 'string', since: 'string' },
    run: a => { const id = advId(a.advisor_id), firm = id ? ADVISORS[id].firm : null, X = SHELF[firm]; if (!X) return { firm: firm ? FIRMS[firm].name : null, note: 'No platform data for this firm in the eligibility service.' };
      const tk = tickerOf(a.ticker), prog = S(a.program).toLowerCase(), since = Date.parse(S(a.since));
      const items = X.items.filter(([t, p]) => (!tk || t === tk) && (!prog || p.toLowerCase().includes(prog))).map(([t, p, st, eff]) => ({ ticker: t, name: FUNDS[t] ? FUNDS[t].name : t, program: p, status: st, effective: eff }));
      return { firm: X.firm, as_of: X.as_of, source: X.source, advisor_programs: X.advisor_programs[id] || [], items, changes_since: isNaN(since) ? undefined : items.filter(i => i.effective && Date.parse(i.effective) > since), note: 'Availability on a platform is not a suitability conclusion for any client.' }; } },
  'taxonomy.resolve': { sys: 'fund', via: 'API', rw: 'read', desc: 'Taxonomy: which actual funds a category includes (equity funds, fixed income, ETFs, multi-asset, large growth), with exclusions and unmapped holdings.', props: { term: 'string' },
    run: a => { const t = S(a.term).toLowerCase(), k = Object.keys(TAXONOMY).find(x => t.includes(x) || x.includes(t.replace(/s$/, ''))); if (!k) return { term: t, note: 'No mapping. Known categories: ' + Object.keys(TAXONOMY).join(', ') };
      const X = TAXONOMY[k]; return { category: k, includes: X.include.map(f => ({ ticker: f, name: FUNDS[f].name })), excludes: X.exclude.map(([f, why]) => ({ ticker: f, name: FUNDS[f].name, why })), unmapped: X.unmapped }; } },
  'pipeline.get': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce pipeline: an advisor’s opportunities with current stage, plan type and full status history.', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id); return { as_of: 'Sep 29, 2026', opportunities: OPPORTUNITIES.filter(o => o.adv === id).map(o => ({ id: o.id, name: o.name, unit: o.scope, plan_type: o.type || null, stage: o.stage, open: !/closed/i.test(o.stage), history: (PIPELINE_HISTORY[o.id] || []).map(([d, st]) => ({ date: d, stage: st })) })) }; } },
  'engage.get_history': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce engagements: last completed interaction and completed interactions in the last 90 days, for one advisor or a territory (LA, OC, SD).', props: { advisor_id: 'string', territory: 'string' },
    run: a => { const T = Object.keys(TERRITORIES).find(k => k.toLowerCase() === S(a.territory).toLowerCase()), one = advId(a.advisor_id), ids = one ? [one] : T ? TERRITORIES[T].advisors : Object.keys(ADVISORS), now = Date.parse('Sep 29, 2026');
      return { as_of: 'Sep 29, 2026', definition: 'Meaningful contact = a completed call, meeting or two-way email recorded in Salesforce; scheduled meetings do not count.',
        advisors: ids.map(id => { const eps = F.episodes.filter(e => e.adv === id).sort((x, y) => Date.parse(y.date) - Date.parse(x.date)), last = eps[0];
          return { advisor: ADVISORS[id].name, last_completed: last ? { id: last.id, date: last.date, kind: last.kind, with: last.with } : null, days_since: last ? Math.round((now - Date.parse(last.date)) / 864e5) : null, completed_last_90_days: eps.filter(e => now - Date.parse(e.date) <= 90 * 864e5).length }; }) }; } },
  'insights.changes_since': { sys: 'fund', via: 'API', rw: 'read', desc: 'Change history: everything that changed for an advisor since their last completed meeting (or a given date): assets at start and end of the period split into net flows and market movement, flows by vehicle, transactions, pipeline moves, platform changes, digital engagement, business events and other contacts, with ranked highlights. Amounts in $ millions.', props: { advisor_id: 'string', since: 'string' },
    run: a => changesSince(a) },
  'book.get_activity': { sys: 'fund', via: 'API', rw: 'read', desc: 'Activity feed: daily purchases and redemptions for an advisor between two dates (default: the last 30 days), with net flows by vehicle. Amounts in $ millions.', props: { advisor_id: 'string', since: 'string', until: 'string' },
    run: a => { const id = advId(a.advisor_id); if (!id || !BOOK[id]) return { note: 'Name an advisor.' }; const until = S(a.until) && !isNaN(dayMs(a.until)) ? fmtDay(dayMs(a.until)) : 'Sep 29, 2026', since = S(a.since) && !isNaN(dayMs(a.since)) ? fmtDay(dayMs(a.since)) : fmtDay(dayMs(until) - 30 * 864e5), tx = activityFeed(id, since, until), net = {};
      tx.forEach(t => { net[t.vehicle] = M1((net[t.vehicle] || 0) + (t.type === 'Purchase' ? t.amount_usd_m : -t.amount_usd_m)); }); return { advisor: ADVISORS[id].name, period: `${since} to ${until}`, transactions: tx, net_by_vehicle_usd_m: net }; } },
  /* ---- data behind the remaining Sales AI sub-agents (simulated, fictional) ---- */
  'book.get_fund_transactions': { sys: 'fund', via: 'API', rw: 'read', desc: 'Transactions service: fund-level purchases and redemptions for an advisor, Jul to Sep 2026. Amounts in $ millions.', props: { advisor_id: 'string', fund: 'string' },
    run: a => { const id = advId(a.advisor_id), tk = tickerOf(a.fund); return { window: 'Jul 1 to Sep 28, 2026', transactions: FUND_TRANSACTIONS.filter(t => (!id || t[0] === id) && (!tk || t[2] === tk)).map(([adv, date, fund, type, amt]) => ({ advisor: ADVISORS[adv].name, date, fund, type, amount_usd_m: amt })) }; } },
  'engage.get_digital': { sys: 'mcloud', via: 'API', rw: 'read', desc: 'Marketing Cloud engagement graph: attributable page visits, article opens and webinars by logged-in advisors. An observed event, not intent.', props: { advisor_id: 'string', since: 'string' },
    run: a => { const id = advId(a.advisor_id), since = Date.parse(S(a.since)); return { note: 'Observed events only; a visit is not intent to buy.', events: DIGITAL.filter(d => (!id || d[0] === id) && (isNaN(since) || Date.parse(d[1]) > since)).map(([adv, date, kind, item]) => ({ advisor: ADVISORS[adv].name, date, kind, item })) }; } },
  'lead.discover': { sys: 'fund', via: 'API', rw: 'read', desc: 'Lead discovery: ranks covered advisors against explicit criteria (category: equity, fixed income, multi-asset, large growth; minimum category assets; maximum CG share; territory; days since contact). Returns the ranking, its basis and exclusions, and saves the trace.', props: { category: 'string', min_category_assets_usd_m: 'number', max_share_pct: 'number', territory: 'string', not_contacted_days: 'number' },
    run: a => leadDiscover(a) },
  'lead.get_ranking_trace': { sys: 'fund', via: 'API', rw: 'read', desc: 'Ranking trace: for the most recent lead ranking, the criteria, each advisor’s evidence and score, and who was excluded and why.', props: {},
    run: () => F.lastRanking || LEAD_RANKING_SAMPLE },
  'peer.compare': { sys: 'fund', via: 'API', rw: 'read', desc: 'Peer analytics: compares an advisor with a permitted peer cohort (internal coverage data only) on CG assets, ETF share and net flows. Amounts in $ millions.', props: { advisor_id: 'string' },
    run: a => peerCompare(advId(a.advisor_id)) },
  'pipeline.score': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Pipeline scoring: scores open opportunities by stage, estimated size and recency of activity, with the basis shown. Pass an advisor or a territory.', props: { advisor_id: 'string', territory: 'string' },
    run: a => pipelineScore(a) },
  'events.get_changes': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Change events: business events for an advisor or their clients’ plans after a date (new hires, model launches, plan sponsor changes, platform changes).', props: { advisor_id: 'string', since: 'string' },
    run: a => { const id = advId(a.advisor_id), since = Date.parse(S(a.since)); return { events: CHANGE_EVENTS.filter(e => (!id || e[0] === id) && (isNaN(since) || Date.parse(e[1]) > since)).map(([adv, date, what, src]) => ({ advisor: ADVISORS[adv].name, date, event: what, source: src })) }; } },
  'crm.get_team': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce relationship graph: the advisor’s own team with roles, and Capital Group’s coverage team.', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id), ho = HANDOVERS.find(h => h.adv === id); return { advisor_team: (ADVISOR_TEAMS[id] || []).map(([name, role]) => ({ name, role })), coverage_team: COVERAGE_TEAM.filter(([n]) => !id || ADVISORS[id].coverage.some(c => EMPLOYEES[c].name === n) || !Object.values(EMPLOYEES).some(e => e.name === n && e.team === 'sales')).map(([name, role]) => ({ name, role })), coverage_change: ho ? `${EMPLOYEES[ho.from].name} → ${EMPLOYEES[ho.to].name}, effective ${ho.effective}` : null }; } },
  'crm.get_tasks': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Salesforce tasks: open and recent commitments for an advisor, with owner, due date and status.', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id); return { tasks: F.commitments.filter(c => !id || c.adv === id).map(c => ({ id: c.id, title: c.title, owner: c.owner, due: c.due, status: c.status, scope: c.scope })) }; } },
  'territory.coverage': { sys: 'sf', via: 'MCP', rw: 'read', desc: 'Coverage analytics: completed contacts in the last 90 days against each advisor’s coverage tier target, for a territory (LA, OC, SD) or all.', props: { territory: 'string' },
    run: a => coverageReport(S(a.territory)) },
  'territory.get_plan_inputs': { sys: 'fund', via: 'API', rw: 'read', desc: 'Business planning inputs: a wholesaler’s sales goal, year-to-date sales, meeting capacity and quarter priorities. Amounts in $ millions.', props: { wholesaler: 'string' },
    run: a => { const k = Object.keys(PLAN_INPUTS).find(e => e === S(a.wholesaler) || EMPLOYEES[e].name.toLowerCase().includes(S(a.wholesaler).toLowerCase())) || 'EMP-PRIYA', P = PLAN_INPUTS[k]; return Object.assign({ wholesaler: EMPLOYEES[k].name, remaining_to_goal_usd_m: M1(P.sales_goal_usd_m - P.ytd_sales_usd_m), pct_of_goal: M1(P.ytd_sales_usd_m / P.sales_goal_usd_m * 100) }, P); } },
  'schedule.zone_visits': { sys: 'm365', via: 'MCP', rw: 'read', desc: 'Zoning: groups advisor visits by geography with drive time from Irvine, and proposes visit days. Pass advisor ids or a territory (LA, OC, SD).', props: { advisor_ids: 'array', territory: 'string', month: 'string' },
    run: a => zoneVisits(a) },
  'schedule.check_rules': { sys: 'm365', via: 'API', rw: 'read', desc: 'Meeting compliance: the advisor firm’s meeting rules plus Capital Group policy, for a meeting type.', props: { advisor_id: 'string', meeting_type: 'string' },
    run: a => { const id = advId(a.advisor_id), firm = id ? ADVISORS[id].firm : null; return { firm: firm ? FIRMS[firm].name : 'Internal', meeting_type: S(a.meeting_type) || 'advisor meeting', firm_rules: firm ? MEETING_RULES[firm] : [], capital_group_rules: MEETING_RULES.CG }; } },
  'content.get_themes': { sys: 'news', via: 'API', rw: 'read', desc: 'This week’s approved themes, ranked by relevance to an advisor’s recorded priorities and notes.', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id), txt = id ? [...F.memory.filter(m => m.adv === id && m.access === 'shared').map(m => m.value), ...F.episodes.filter(e => e.adv === id).map(e => e.text)].join(' ').toLowerCase() : ''; return { week_of: 'Sep 28, 2026', themes: THEMES.map(([tid, title, tags, src]) => { const hits = tags.split(' ').filter(w => txt.includes(w)); return { id: tid, title, source: src, relevance: hits.length, why: hits.length ? 'Matches recorded notes: ' + hits.join(', ') : 'General theme; nothing advisor-specific' }; }).sort((x, y) => y.relevance - x.relevance) }; } },
  'news.get_items': { sys: 'news', via: 'API', rw: 'read', desc: 'Authorized news and approved commentary from the last two weeks, filtered by topic words or an advisor’s context.', props: { topics: 'string', advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id), q = (S(a.topics) + ' ' + (id ? [FIRMS[ADVISORS[id].firm].name, ...F.memory.filter(m => m.adv === id && m.access === 'shared').map(m => m.value)].join(' ') : '')).toLowerCase(); return { window: 'Sep 14 to Sep 28, 2026', items: NEWS.map(([nid, date, title, src, tags]) => ({ id: nid, date, title, source: src, matches: tags.split(' ').filter(w => q.includes(w)).length })).filter(n => n.matches || !q.trim()).sort((x, y) => y.matches - x.matches) }; } },
  'seismic.get_recommendations': { sys: 'seismic', via: 'MCP', rw: 'read', desc: 'Seismic recommendations with their trace: whether each piece is recommended for the advisor’s stated need (with the evidence) or for popularity.', props: { advisor_id: 'string' },
    run: a => { const id = advId(a.advisor_id); return { advisor: id ? ADVISORS[id].name : null, recommendations: (CONTENT_RECS[id] || []).map(([cid, basis, reason, ev]) => ({ id: cid, title: CONTENT.find(c => c.id === cid).title, basis: basis === 'stated_need' ? 'Advisor’s stated need' : 'Popular with similar advisors', reason, evidence: ev })) }; } },
  'seismic.resolve_evidence': { sys: 'seismic', via: 'API', rw: 'read', desc: 'Evidence resolver: finds the page and passage in an approved document (by id) that supports a claim, with the document version.', props: { asset_id: 'string', claim: 'string' },
    run: a => { const D = DOC_PASSAGES[S(a.asset_id)], q = S(a.claim).toLowerCase().split(/\W+/).filter(w => w.length > 3); if (!D) return { asset: S(a.asset_id), found: false, note: 'No original document text on file for this asset; the claim cannot be traced to a page.' };
      const best = D.pages.map(([pg, txt]) => ({ page: pg, passage: txt, score: q.filter(w => txt.toLowerCase().includes(w)).length })).sort((x, y) => y.score - x.score)[0]; return { asset: S(a.asset_id), version: D.version, found: best.score > 0, page: best.page, passage: best.passage }; } },
  'platform.get_program_rules': { sys: 'fund', via: 'API', rw: 'read', desc: 'Program rules: account and program minimums and rules for the advisor’s dealer programs.', props: { advisor_id: 'string', program: 'string' },
    run: a => { const id = advId(a.advisor_id), firm = id ? ADVISORS[id].firm : null, R = PROGRAM_RULES[firm]; if (!R) return { firm: firm ? FIRMS[firm].name : null, note: 'No dealer program rules: this firm uses a custodian platform.' }; const p = S(a.program).toLowerCase(); return { firm: FIRMS[firm].name, source: 'Dealer program guide (dealer feed)', programs: Object.entries(R).filter(([k]) => !p || k.toLowerCase().includes(p)).map(([k, rules]) => ({ program: k, rules })) }; } },
  'models.get_allocations': { sys: 'fund', via: 'API', rw: 'read', desc: 'Model allocations: dated versions of a Capital Group model on a dealer platform, with component weights (percent) and the change between versions.', props: { model: 'string', advisor_id: 'string' },
    run: a => { const k = Object.keys(MODEL_ALLOCATIONS).find(m => m.toLowerCase().includes(S(a.model).toLowerCase().replace(/ model.*$/, ''))) || null; if (!k) return { note: 'Unknown model. Known: ' + Object.keys(MODEL_ALLOCATIONS).join(', ') };
      const X = MODEL_ALLOCATIONS[k], [[d0, w0], [d1, w1]] = X.versions, id = advId(a.advisor_id); return { model: k, firm: FIRMS[X.firm].name, program: X.program, offered_to_advisor: id ? ADVISORS[id].firm === X.firm : null, from: d0, to: d1, components: [...new Set([...Object.keys(w0), ...Object.keys(w1)])].map(t => ({ ticker: t, name: FUNDS[t].name, from_pct: w0[t] || 0, to_pct: w1[t] || 0, change_pp: (w1[t] || 0) - (w0[t] || 0) })) }; } },
  'fund.compare': { sys: 'fund', via: 'API', rw: 'read', desc: 'Approved comparison tool: compares funds like for like (share class, expense ratio with its as-of date, benchmark, category, approach) and flags anything not on the same basis.', props: { tickers: 'array' },
    run: a => { const tk = (Array.isArray(a.tickers) ? a.tickers : S(a.tickers).split(/[ ,]+/)).map(tickerOf).filter(Boolean), rows = tk.map(t => { const f = FUNDS[t]; return { ticker: t, name: f.name, share_class: f.name.split(', ')[1] || 'n/a', expense_ratio_pct: f.er, er_as_of: f.asOf, benchmark: f.bench, category: f.category || FUND_CATEGORY[t] || null, approach: f.approach }; });
      const flags = []; if (new Set(rows.map(r => r.er_as_of)).size > 1) flags.push('Expense ratios have different as-of dates'); if (new Set(rows.map(r => r.benchmark)).size > 1) flags.push('Funds are managed to different benchmarks'); rows.filter(r => r.expense_ratio_pct == null).forEach(r => flags.push(r.ticker + ': expense ratio not in reference data'));
      return { funds: rows, basis_flags: flags, performance: 'Inserted from the system of record at approval; never generated' }; } },
  'coach.get_playbook': { sys: 'seismic', via: 'MCP', rw: 'read', desc: 'Coaching playbook for an objection (fee, active vs index): steps, approved language to use, what to avoid and clarifying questions.', props: { topic: 'string' },
    run: a => { const t = S(a.topic).toLowerCase(), k = /fee|cost|expens|price/.test(t) ? 'fee' : /active|index|passive/.test(t) ? 'active vs index' : null; return k ? Object.assign({ topic: k }, PLAYBOOK[k]) : { topic: t, note: 'No playbook for this topic. Known: fee, active vs index.' }; } },
  'expense.get_receipts': { sys: 'exp', via: 'API', rw: 'read', desc: 'Expense system: a wholesaler’s receipts for a month, matched to advisor visits, with the travel policy and anything that breaks it.', props: { wholesaler: 'string', month: 'string' },
    run: a => { const k = Object.keys(EXPENSES).find(e => e === S(a.wholesaler) || EMPLOYEES[e].name.toLowerCase().includes(S(a.wholesaler).toLowerCase())) || 'EMP-PRIYA', X = EXPENSES[k];
      return { wholesaler: EMPLOYEES[k].name, month: X.month, policy: X.policy, receipts: X.receipts.map(([date, type, amt, where, att, adv]) => { const per = att.length ? Math.round(amt / att.length * 100) / 100 : null, issues = [];
        if (type === 'Meal' && !att.length) issues.push('No attendees listed'); if (type === 'Meal' && per > 100) issues.push('Over $100 per person'); if (!adv) issues.push('No matching advisor visit');
        return { date, type, amount_usd: amt, merchant: where, attendees: att, per_person_usd: per, visit: adv ? ADVISORS[adv].name : null, issues }; }), total_usd: Math.round(X.receipts.reduce((t, r) => t + r[2], 0) * 100) / 100 }; } },
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

/* ---------- Action authority: decided by rule from the request's own words ---------- */
function authorityFromText(text, team) {
  const t = ' ' + String(text).toLowerCase().replace(/[’']/g, "'") + ' ';
  let a = 'read_only', why = 'Nothing in the request asks to draft, change or send anything.';
  if (/\b(send|publish|distribute)\b/.test(t)) { a = 'external_action'; why = 'The request explicitly asks to send or publish; a person still approves the exact payload.'; }
  else if (/\bbook (a|an|the|time|it|me|us|him|her|them|meeting|call)\b|\b(schedule|invite|move|reschedul\w*|log|update|set up (a )?(call|meeting)|create (a )?task|add (a )?task|fix|resolve)\b|won't open|can't open|not working/.test(t)) { a = 'proposed_change'; why = 'The request asks for a change (a booking, an update, a fix).'; }
  else if (/\b(draft|write|compose|create|campaign|outreach|email|post|letter|report)\b/.test(t)) { a = 'draft_only'; why = 'The request asks for something written; drafts only, nothing sent.'; }
  if (team === 'service' && AUTHORITY[a].n < 2) { a = 'proposed_change'; why = 'Service requests are handled as cases, which may be updated.'; }
  return { authority: a, why };
}
const authN = a => (AUTHORITY[a] || AUTHORITY.read_only).n;
/* Interpretation built from rules when orchestration didn't state one (saved runs, fallbacks, catalogue routes) */
function ruleInterpretation(run, intent) {
  const R = run.resolution || {}, A = run.advisor && ADVISORS[run.advisor], au = authorityFromText(run.text, EMPLOYEES[run.requester].team);
  const subj = A ? { kind: run.unit ? 'buying_unit' : 'advisor', id: run.unit || run.advisor, label: A.name + (run.unit ? ' · ' + A.units[run.unit] : '') } : run.territory ? { kind: 'territory', id: run.territory, label: TERRITORIES[run.territory].name } : R.funds && R.funds.length ? { kind: 'fund', id: R.funds[0].ticker, label: R.funds.map(f => f.ticker).join(', ') } : { kind: 'none', id: null, label: 'Not resolved from the request' };
  const time = /tomorrow|today|next week|next month|this week|90 days|since|last (meeting|visit)/i.exec(run.text);
  return { subject: subj, intent: intent || null, scope: A ? `${FIRMS[A.firm].name}${run.unit ? ' · ' + run.unit : ''}` : run.territory ? 'Territory' : 'Product level', time: time ? time[0] : `Current, as of ${TODAY}`, constraints: [], output: null, missing: [], authority: au.authority, src: 'code' };
}

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
    HANDOVERS.filter(h => h.adv === advId).forEach(h => push('graph', h.id, 'Coverage handover', `${EMPLOYEES[h.from].name} → ${EMPLOYEES[h.to].name}, effective ${h.effective}. ${h.note}`, h.src, 'advisor'));
    Object.entries(PLANS).filter(([, p]) => p.adv === advId && (!unit || p.unit === unit)).forEach(([id, p]) => push('graph', id, 'Retirement plan', `${p.name}: $${p.assets_usd / 1e6}M, ${p.participants} participants. ${p.committee}. Next meeting ${p.next_meeting}; materials due ${p.materials_due}. Options: ${p.lineup.map(o => `${o.option} ${o.fund} ($${o.assets_usd / 1e6}M)`).join('; ')}; ${p.other.label} ($${p.other.assets_usd / 1e6}M).`, 'Salesforce plan record', p.unit));
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
    if ((team === 'sales' || team === 'marketing') && (reads.has('models') || task.agent === 'sales.lead') && ALPHA[advId]) push('models', 'MOD-ALPHA', 'Sales Alpha signal', `${ALPHA[advId].score}/100: ${ALPHA[advId].note}. A signal, not intent.`, 'Model platform', 'advisor');
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
/* Everything a task was given: the only place its numbers may come from */
const corpusOf = ctx => (JSON.stringify(ctx.packet.items) + JSON.stringify(ctx.toolResults) + JSON.stringify(ctx.upstream)).replace(/,/g, '');
/* Names that identify an advisor or their firm; public content may not contain them (POL-8) */
const IDENTIFIERS = [...Object.values(ADVISORS).map(a => a.name.split(',')[0]), ...Object.values(FIRMS).map(f => f.name.replace(/\s*\(.*\)/, '').replace(/ (Wealth Management|Wealth|Advisors|Advisory)$/, ''))];
/* The output checks, shared by the gatekeeper and by human edits before approval */
function outputProblems(advisor, kind, body, corpus) {
  const clientFacing = /email|post|content/.test(kind || '');
  const personal = clientFacing && F.memory.filter(m => m.access !== 'shared' && m.adv === advisor).some(m => m.value.split(/\W+/).filter(w => w.length > 6).some(w => body.includes(w)));
  const identifiers = /post/.test(kind || '') ? IDENTIFIERS.filter(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(body)) : [];
  return { clientFacing, personal, identifiers, miss: traceable(body, corpus) };
}
/* A person edited a draft that is waiting for approval: the same rules run again before it is saved */
function recheckOutput(o, body, by) {
  const p = outputProblems(o.adv, o.kind, body, o.corpus || '');
  const issues = [];
  if (p.personal) issues.push('Contains a personal note; personal notes never go in client-facing content (POL-4).');
  if (p.identifiers.length) issues.push(`Public content names an advisor or firm: ${p.identifiers.join(', ')} (POL-8).`);
  if (p.miss.length && p.clientFacing) issues.push(`Numbers not traceable to a system of record: ${p.miss.slice(0, 3).join(', ')} (POL-2).`);
  if (issues.length) return issues;
  o.body = body; o.flagged = p.miss; o.rev = (o.rev || 1) + 1; o.editedBy = EMPLOYEES[by] ? EMPLOYEES[by].name : by;
  logEvent('content.revised', `${o.title} (rev ${o.rev}, re-checked)`, by, o.adv);
  return [];
}
function gatekeep(task, res, ctx) {
  const verdicts = [], run = ctx.run, a = AGENTS[task.agent];
  const known = new Set([...ctx.packet.items.map(i => i.id), ...ctx.toolIds, ...ctx.upstreamIds]);
  const corpus = corpusOf(ctx);
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
    if (authN(run.authority) < 2) { V('commitment', 'proposed', S(c.title), `Proposed, not created: the request is ${AUTHORITY[run.authority].label.toLowerCase()}, so tasks wait for ${EMPLOYEES[run.requester].name.split(' ')[0]} to create them`, { proposal: { title: S(c.title), owner: S(c.owner) || EMPLOYEES[run.requester].name, due: S(c.due) || 'TBD' } }); continue; }
    const id = 'TASK-' + (400 + (++F.seq));
    F.commitments.push({ id, adv: run.advisor, scope: run.unit || 'advisor', title: S(c.title), owner: S(c.owner) || EMPLOYEES[run.requester].name, due: S(c.due) || 'TBD', status: 'Open', run: run.id });
    F.graph.edges.push({ from: run.advisor || run.requester, to: id, label: 'owed', run: run.id }); F.graph.nodes.push({ id, label: S(c.title), type: 'task', run: run.id });
    const evt = logEvent('commitment.created', S(c.title), task.agent, run.advisor);
    V('commitment', 'committed', S(c.title), `Durable task, owner ${S(c.owner) || EMPLOYEES[run.requester].name}`, { id, event: evt });
  }
  /* output */
  if (res.output && res.output.body) {
    const { clientFacing, personal, identifiers, miss } = outputProblems(run.advisor, res.output.kind, res.output.body, corpus);
    if (personal) V('output', 'blocked', res.output.title, 'Client-facing draft contains a personal note (POL-4)');
    else if (identifiers.length) V('output', 'blocked', res.output.title, `Public content names an advisor or firm: ${identifiers.join(', ')} (POL-8)`);
    else if (miss.length && clientFacing) V('output', 'blocked', res.output.title, `Client-facing draft has numbers not traceable to a system of record: ${miss.slice(0, 3).join(', ')}`);
    else {
      const id = 'OUT-' + (++F.seq), needs = !!res.needs_approval || /email|post/.test(res.output.kind || '');
      F.outputs.push({ id, task: task.id, agent: task.agent, run: run.id, adv: run.advisor, kind: res.output.kind, title: res.output.title, body: res.output.body, status: needs ? 'Waiting for approval' : miss.length ? 'Needs number check' : 'Ready', flagged: miss, used: res.used || [], corpus, rev: 1 });
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
    needs_approval: !!r.needs_approval, open_questions: arr(r.open_questions || r.unresolved).map(x => str(x, 240)), as_of: arr(r.as_of).map(x => str(x, 60)).slice(0, 4), status: /^(complete|partial|blocked)$/.test(r.status) ? r.status : 'complete', next_step: str(typeof r.next_step === 'string' ? r.next_step.replace(/^[\s.…]+$/, '') : '', 240)
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
    const plans = Object.entries(PLANS).filter(([, p]) => p.adv === id).map(([k, p]) => `${k} ${p.name} (${p.unit}; options ${p.lineup.map(o => o.fund).join(', ')}; meets ${p.next_meeting})`).join('; ');
    const ho = HANDOVERS.filter(h => h.adv === id).map(h => `${h.id} ${EMPLOYEES[h.from].name} → ${EMPLOYEES[h.to].name} as primary, effective ${h.effective}`).join('; ');
    return `${id} ${a.name}, ${a.title}, ${FIRMS[a.firm].name}. Units: ${Object.entries(a.units).map(([k, v]) => k + ' ' + v).join('; ')}. Coverage: ${a.coverage.map(c => EMPLOYEES[c].name).join(', ')}.${ho ? ' Coverage handover: ' + ho + '.' : ''}${plans ? ' Plans: ' + plans + '.' : ''}\n  Memory: ${mem || 'none'}\n  Unknown: ${(UNKNOWNS[id] || []).join('; ') || 'nothing flagged'}\n  Open commitments: ${com || 'none'}\n  Episodes: ${ep}`;
  }).join('\n');
}
function subagentText() {
  return Object.entries(SUBAGENTS).flatMap(([fam, A]) => Object.keys(A.subs).map(sub => { const r = routeInfo(fam + '.' + sub); return `${r.route} | ${r.label} | ${r.does} | usual data: ${(SUB_USES[r.route] || []).join(', ') || 'foundation and upstream steps'} | agent ${r.agent} tools: ${(AGENTS[r.agent].tools || []).join(', ') || 'none'}`; })).join('\n');
}
function serviceText() { return Object.entries(SERVICES).map(([k, v]) => `${k} [${v.status}]${v.tools.length ? ' tools: ' + v.tools.join(', ') : ''} | ${v.does}`).join('\n'); }
function orchestratorPrompt(run) {
  const E = EMPLOYEES[run.requester], first = E.name.split(' ')[0];
  const pats = cataloguePatterns(run.text);
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

SUB-AGENT ROUTES (a task runs exactly one route; route notation Prep.Notes = Prep Me → Notes Summarizer)
${subagentText()}

SHARED SERVICES (tools a step uses; not autonomous agents). simulated = available here with demo data; foundation = built in; not connected = plan for it, and the step will report what it could not establish.
${serviceText()}

BUSINESS INTENTS (pick exactly one; organize by intent, not keywords)
${INTENT_ORDER.map(k => k + ': ' + INTENTS[k]).join('\n')}
The word "ETF" can carry five intents: "Find ETF leads" is prioritize, "Explain this advisor's ETF sales" is diagnose, "Check whether this ETF is available on the advisor's platform" is verify, "Prepare an ETF discussion" is prepare, "Send the approved ETF material" is execute. Each needs a different plan, different data and different controls.

ACTION AUTHORITY (lowest that satisfies the request)
${Object.entries(AUTHORITY).map(([k, v]) => k + ': ' + v.does).join('\n')}
"Help me prepare" is read_only: it never books a meeting, sends an email or updates CRM unless ${first} explicitly asked. A rule also checks the request's own words and caps the authority you state.

CATALOGUE PATTERNS closest to this request (reference decompositions from the Sales AI query catalogue; adapt them, do not copy blindly)
${pats.map(c => `#${c.n} ${c.intent} · "${c.ask}" · decomposition: ${c.decomp} · route: ${c.exec}`).join('\n') || 'None close.'}

RULES
${POLICIES.map(p => p.id + ' ' + p.text).join('\n')}

Work in two layers. INTELLIGENCE first: establish what ${first} actually wants as a structured interpretation. ORCHESTRATION second: turn that interpretation into an executable plan of routes in waves.
Output ONLY newline-delimited JSON, one object per line, no prose and no code fences, in this order:
{"k":"decision","type":"requester","title":"...","detail":"..."}
{"k":"decision","type":"intent","title":"...","detail":"...","intent":"${INTENT_ORDER.join('|')}"}
{"k":"decision","type":"asks","title":"N things requested","detail":"...","asks":["each distinct thing the person asked for, in their words, 2 to 8 words each"]}
{"k":"decision","type":"interpretation","title":"one line: what ${first} actually wants","detail":"...","subject":{"kind":"advisor|buying_unit|firm|territory|plan|opportunity|fund|document|internal|none","id":"ADV-...|BU-...|PLAN-...|OPP-...|ticker|null","label":"..."},"intent":"one business intent","scope":"wealth or retirement, territory, dealer or platform, vehicle, audience","time":"as-of date, comparison period or last meeting","constraints":["..."],"output":"answer|ranked_list|comparison|agenda|brief|draft|task|alert","missing":["only what materially changes the answer or action"],"authority":"read_only|draft_only|proposed_change|external_action","patterns":[catalogue numbers you followed]}
{"k":"decision","type":"entity","title":"...","detail":"...","advisor":"ADV-...|null","unit":"BU-...|null","territory":"LA|OC|SD|null","confidence":"high|medium|low"}
{"k":"decision","type":"scope","title":"...","detail":"..."}
{"k":"decision","type":"known","title":"...","detail":"...","uses":["ids you will reuse"]}
{"k":"decision","type":"missing","title":"...","detail":"..."}
{"k":"decision","type":"memory","title":"...","detail":"...","class":"read_only|task_requirement|lasting_preference_candidate|none"}
{"k":"decision","type":"controls","title":"...","detail":"..."}
then 2 to 6 lines {"k":"task","id":"T1","ask":1,"route":"Prep.Notes (a sub-agent route; use agent only for non-Sales work without a route)","title":"3 to 6 words, as it appears on the team's workbench","objective":"one sentence","depends_on":[],"services":["shared service names this step reads"],"tools":["tool names from the route's agent list, within the action authority"],"reads":["memory","knowledge","policy","models","events","feedback"],"returns":"what this step hands on","why":"why this sub-agent, which system it queries and for what"}
{"k":"decision","type":"success","title":"...","detail":"..."}
{"k":"end"}
Requests can be about one advisor, a territory, a product, or internal work with colleagues. Not every request needs an advisor: for a territory set advisor null and territory; for product-only or internal work set both null.
Ask for clarification only if acting would be unsafe or impossible: emit {"k":"clarify","question":"..."} after the entity decision, then {"k":"end"}. Otherwise make a sensible assumption and state it in the "missing" decision.
${run.clarified ? `You already asked: "${run.clarified.question}". The user answered: "${run.clarified.answer}". Do NOT ask again. Proceed, interpreting the answer as best you can, and state your assumption.` : ''}
Be precise: titles of 3 to 6 words, details of at most 16 words, no filler. Reuse foundation records instead of redoing work.
Plan in waves. Independent reads go first with empty depends_on so they run together (for example Prep.Profile, Prep.Notes and data-service reads). Checks (Prep.Fact Check, Product.QAR) depend on the reads they check. Building steps (Prep.Agenda, drafts) come last. A step depends only on steps whose output it actually needs. Numbers come from data services (assets, flows, market share, platform eligibility), never from narrative notes.
Every step returns its output, source references, as-of dates, unresolved issues and completion status.
Tell the story a real team would. ${E.name} is the primary actor: the plan ends with a result delivered to them, and other teams appear as contributors whose work they build on. Choose only the steps the request needs (often 2 to 5); bring in another team only when it owns part of the work or holds evidence ${E.name.split(' ')[0]} lacks, and say so in "why", including which system it will query and for what. Every task must produce a different kind of output (for example a computation, a verified answer, a draft, a compliance review, a case update, a calendar hold); never add a task that only reformats, summarizes or packages an earlier task's output. Chain tasks with depends_on so later specialists build on what earlier ones publish to the foundation. Tasks that don't depend on each other run in parallel.
Every ask must be covered by at least one task, and every task must serve one ask ("ask" is its 1-based number). Do not add work the person did not ask for.
Classify new information about the advisor strictly: an employee's request is not an advisor preference.`;
}
function agentPrompt(task, run, packet, upstream, withTools) {
  const a = AGENTS[task.agent], E = EMPLOYEES[run.requester];
  const lines = packet.items.map(i => `[${i.id}] (${i.layer}, from ${i.from}, scope ${i.scope}) ${i.label}: ${i.value}`).join('\n');
  const up = upstream.length ? upstream.map(u => { const R = ROLES[roleOf(u.agent)]; return `${u.task} by ${R ? R.name + ' (' + TEAMS[R.team].name + ')' : AGENTS[u.agent].name}: ${u.title}\n${u.body}\nPublished: ${u.ids.join(', ') || 'nothing'}`; }).join('\n\n') : 'None.';
  const tl = withTools ? `\nYou can call your enterprise tools (Salesforce and Microsoft 365 through the MCP gateway; the data and model platform, Seismic exports and Morningstar through APIs). Call a tool only when the packet lacks what you need.` : `\nTool results fetched for you:\n${JSON.stringify(task.prefetched || {})}`;
  const ri = task.route && routeInfo(task.route), gaps = (task.services || []).filter(k => serviceStatus(k) === 'not connected');
  return `You are ${ri ? `${ri.label} (route ${ri.route}), a skill of ${a.name},` : a.name + ','} a ${TEAMS[a.team].name} specialist agent working for the ${ROLES[task.role] ? ROLES[task.role].name : TEAMS[a.team].name} team in Capital Group's Connected Client Experience. Your job: ${ri ? ri.does : a.does}. Today is ${TODAY}.
Task from orchestration (${task.id}): ${task.objective}${task.returns ? `\nHand on: ${task.returns}` : ''}
How the request was interpreted: ${JSON.stringify(run.interp ? { intent: run.interp.intent, scope: run.interp.scope, time: run.interp.time, constraints: run.interp.constraints, output: run.interp.output } : {})}. Action authority: ${run.authority || 'read_only'} (${AUTHORITY[run.authority || 'read_only'].does})
Shared services for this step: ${(task.services || []).map(k => `${k} (${serviceStatus(k)})`).join(', ') || 'none'}.${gaps.length ? ` NOT CONNECTED: ${gaps.join(', ')}. Say plainly what you could not establish because of it, and set "status":"partial".` : ''}
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
- You work for ${E.name}. When you reuse a colleague's earlier notes or work (for example call notes another wholesaler recorded), credit them by name and team and say why it helps ${E.name.split(' ')[0]}.
- When approved messaging (MSG- ids) is available, use it verbatim or lightly edited and cite the ids in "used"; make no new claims beyond it.${a.team === 'service' ? `
- Diagnose from evidence: for each likely cause, say what you checked and which record (case, interaction, delivery log id) confirms or rules it out. Write case notes the way an experienced service rep would: plain sentences a colleague can follow, not system shorthand.` : ''}
- When your step reads data, write the output body the way an analyst would, in three short parts: "What I checked:" the sources you used and the period you compared; "What changed:" the specific changes with numbers from the tool results, each against its prior period or starting point; "What it means:" one to three insights for ${E.name.split(' ')[0]}, each tied to a change above. If one source shows no change, say so in a single line and move on to the sources that did change. Never conclude that nothing changed while any tool result shows activity. (Emails, posts and case notes keep their own format.)
- Step contract: "as_of" lists the dates of the data you relied on; "status" is complete, partial (something material could not be established) or blocked; "open_questions" lists unresolved issues and conflicts.
- "next_step": the one concrete action ${E.name} should take because of your work (who, what, by when if known), addressed to ${E.name.split(' ')[0]}. Use the same number rules. Leave it empty if there is nothing for them to do.

Reply with only a JSON object:
{"says":"one first-person sentence, at most 22 words: what you did and which team's work you built on (name teams, not agents)","output":{"kind":"brief|email|finding|answer|plan|content_pick|post|case_update|note","title":"...","body":"${a.team === 'service' ? 'under 180 words; short plain paragraphs: what happened, what you checked and found (with record ids), what you did and what happens next' : "under 150 words; '- ' bullets; blank line between paragraphs"}"},"used":["ids"],"knowledge":[{"label":"...","value":"...","evidence":["ids"]}],"memory":[{"attribute":"...","value":"...","scope":"BU-...|advisor","category":"content_pref|communication_pref|priority|relationship","basis":"advisor_statement|employee_request|task_requirement|inference","evidence":["ids"]}],"commitments":[{"title":"...","owner":"...","due":"..."}],"needs_approval":false,"open_questions":[],"as_of":["dates of the data used"],"status":"complete|partial|blocked","next_step":"..."}
Use empty arrays when nothing applies.`;
}
function toolDefs(task, onCall) {
  return (task.tools || []).filter(t => TOOLS[t]).map(name => {
    const T = TOOLS[name], props = {};
    for (const [k, v] of Object.entries(T.props)) props[k] = v === 'array' ? { type: 'array', items: { type: 'string' } } : { type: v };
    return { name: name.replace('.', '_'), description: `${T.desc} (${SYSTEMS[T.sys].name} via ${T.via})`, inputSchema: { type: 'object', properties: props }, execute: async input => onCall(name, input) };
  });
}
