/* ===== Always-on Intelligence: listen, decide, hand off =====
   Advisor activity from every connected system arrives as events. Each event
   updates the advisor's profile: interest by topic (decaying over time),
   friction, deadlines, new assets in motion and the last person-to-person touch.
   Most events stop there. A strong event, or enough weaker ones together, asks
   for a decision: the next best action is the option with the most incremental
   value, using Sales Alpha (incremental sales from one in-person visit to this
   advisor) and Digital Alpha (from one digital engagement), under capacity and
   contact guardrails. A decision that needs work becomes a work order that
   Intelligence plans and runs like any request. No DOM here, so it runs in Node. */

/* what each kind of event means; w is its weight toward intent */
const SIG_TYPES = {
  'web.page': { label: 'Page visit', cat: 'Digital', sys: 'aem', w: 1, strength: 'weak' },
  'web.article': { label: 'Article read', cat: 'Digital', sys: 'aem', w: 2, strength: 'medium' },
  'web.tool': { label: 'Tool used', cat: 'Digital', sys: 'aem', w: 2.5, strength: 'medium' },
  'web.download': { label: 'Download', cat: 'Digital', sys: 'aem', w: 2, strength: 'medium' },
  'web.search': { label: 'Site search', cat: 'Digital', sys: 'aem', w: 1, strength: 'weak' },
  'web.login': { label: 'Portal login', cat: 'Digital', sys: 'aem', w: 0.5, strength: 'weak' },
  'ce.course': { label: 'CE course completed', cat: 'Digital', sys: 'aem', w: 2, strength: 'medium' },
  'social.engage': { label: 'LinkedIn engagement', cat: 'Social', sys: 'social', w: 1, strength: 'weak' },
  'mc.register': { label: 'Webinar registration', cat: 'Marketing', sys: 'mcloud', w: 1, strength: 'weak' },
  'mc.noshow': { label: 'Webinar no-show', cat: 'Marketing', sys: 'mcloud', w: 0.3, strength: 'weak' },
  'mc.open': { label: 'Email opened', cat: 'Marketing', sys: 'mcloud', w: 0.5, strength: 'weak' },
  'mc.click': { label: 'Email click', cat: 'Marketing', sys: 'mcloud', w: 1.5, strength: 'medium' },
  'mc.webinar': { label: 'Webinar attended', cat: 'Marketing', sys: 'mcloud', w: 2, strength: 'medium' },
  'ls.sent': { label: 'Content sent', cat: 'Sales', sys: 'seismic', w: 0, strength: 'info', touch: true },
  'ls.open': { label: 'Content opened', cat: 'Content', sys: 'seismic', w: 1.5, strength: 'medium' },
  'ls.blocked': { label: 'Link blocked', cat: 'Content', sys: 'seismic', w: 0, strength: 'medium', friction: 1 },
  'crm.call': { label: 'Call logged', cat: 'Sales', sys: 'sf', w: 0, strength: 'info', touch: true },
  'crm.email': { label: 'Email logged', cat: 'Sales', sys: 'sf', w: 0, strength: 'info', touch: true },
  'crm.coverage': { label: 'Coverage change', cat: 'Sales', sys: 'sf', w: 0, strength: 'info' },
  'crm.deadline': { label: 'Decision date set', cat: 'Practice', sys: 'sf', w: 2, strength: 'medium' },
  'crm.practice': { label: 'Practice change', cat: 'Practice', sys: 'sf', w: 3, strength: 'strong', assets: true },
  'svc.question': { label: 'Service contact', cat: 'Service', sys: 'gen', w: 3, strength: 'strong' },
  'svc.issue': { label: 'Service issue', cat: 'Service', sys: 'gen', w: 0, strength: 'strong', friction: 2 },
  'tx.buy': { label: 'Purchase', cat: 'Transactions', sys: 'fund', w: 2, strength: 'medium' },
  'tx.sell': { label: 'Redemption', cat: 'Transactions', sys: 'fund', w: 0, strength: 'strong', risk: true },
  'dealer.platform': { label: 'Platform change', cat: 'Dealer', sys: 'fund', w: 3, strength: 'strong', assets: true },
  'news.client': { label: 'Client news', cat: 'News', sys: 'news', w: 3, strength: 'strong', assets: true },
  'model.refresh': { label: 'Alpha models refreshed', cat: 'Models', sys: 'fund', w: 0, strength: 'info' }
};
const SIG_TOPICS = [
  ['plans', 'Retirement plans', /401\(k\)|recordkeeper|plan sponsor|\bcfo\b|simple ira/i],
  ['fees', 'Fees', /fee|expense|cost/i],
  ['income', 'Retirement income', /income|retire|balanced|bond|abnfx|ambfx|dividend/i],
  ['etf', 'ETFs', /\betfs?\b|cggr|cgdv|cgcp/i],
  ['models', 'Model portfolios', /model|core-satellite|uma\b/i],
  ['growth', 'Growth (GFA)', /\bgfa\b|growth|attribution|gfffx/i],
  ['access', 'Access', /link|blocked|gateway|open/i]
];
const topicOfText = s => (SIG_TOPICS.find(([, , re]) => re.test(s)) || ['general'])[0];
const TOPIC_NAME = Object.fromEntries(SIG_TOPICS.map(([k, n]) => [k, n]).concat([['general', 'General']]));

/* Sales Alpha and Digital Alpha, refreshed weekly by the model platform, in $K of incremental sales */
const VISIT_ALPHA = {
  'ADV-101': { sales: 140, digital: 12 }, 'ADV-102': { sales: 85, digital: 9 }, 'ADV-103': { sales: 28, digital: 11 }, 'ADV-104': { sales: 120, digital: 26 },
  'ADV-105': { sales: 110, digital: 14 }, 'ADV-106': { sales: 72, digital: 10 }, 'ADV-107': { sales: 55, digital: 8 }
};
/* field capacity: visits are the scarce resource, so a new visit has to beat the least valuable one already booked */
const CAPACITY = {
  'EMP-PRIYA': { kind: 'visit', perQuarter: 200, perWeek: 15, window: 'Oct 5 to Oct 16', slots: 30, booked: 28,
    bookedLow: [{ id: 'VIS-2241', what: 'Routine check-in, Torrance branch', value: 45 }, { id: 'VIS-2236', what: 'Quarterly review, Irvine office', value: 58 }] },
  'EMP-SAM': { kind: 'call', perWeek: 60, booked: 41 }
};
const POLICY = { coolOffDays: 5, trigger: 5, halfLifeDays: 14, plannedDays: 21, visitShare: 0.8, callShare: 0.35, callConnect: 0.9, callMin: 15, digitalMin: 4, dedupeDays: 7 };
/* activity the existing records do not hold: web analytics detail, email engagement, LinkedIn and the weekly model runs */
const SIGNAL_EXTRAS = [
  { adv: 'ADV-101', at: 'Jul 28, 2026 7:40', type: 'web.download', what: 'GFA quarterly attribution, Q2 (PDF)', src: 'Website analytics' },
  { adv: 'ADV-101', at: 'Aug 27, 2026 7:55', type: 'web.tool', what: 'Fund comparison tool: GFA vs. VIGAX, 1-, 3- and 5-year returns', src: 'Website analytics' },
  { adv: 'ADV-101', at: 'Sep 10, 2026 7:35', type: 'web.search', what: 'Searched “GFA vs index fund”', src: 'Website analytics' },
  { adv: 'ADV-102', at: 'Aug 12, 2026 10:00', type: 'mc.register', what: 'Registered for “Fee transparency for plan committees”', src: 'Marketing Cloud' },
  { adv: 'ADV-102', at: 'Aug 19, 2026 11:00', type: 'mc.noshow', what: 'Missed “Fee transparency for plan committees”; recording sent', src: 'Marketing Cloud' },
  { adv: 'ADV-102', at: 'Aug 24, 2026 14:20', type: 'web.tool', what: 'Fee calculator: PLAN-102 lineup costs in dollars', src: 'Website analytics' },
  { adv: 'ADV-102', at: 'Aug 31, 2026 9:30', type: 'web.download', what: 'Fund expense guide for plan committees (PDF)', src: 'Website analytics' },
  { adv: 'ADV-103', at: 'Aug 5, 2026 12:00', type: 'mc.noshow', what: 'Registered for “Income in retirement” but did not attend', src: 'Marketing Cloud' },
  { adv: 'ADV-103', at: 'Sep 5, 2026 8:10', type: 'web.login', what: 'Logged in to the advisor portal for the first time in four months', src: 'Website analytics' },
  { adv: 'ADV-104', at: 'Sep 2, 2026 20:15', type: 'ce.course', what: 'Completed the CE course “Active ETFs in model portfolios” (1 credit)', src: 'Learning platform' },
  { adv: 'ADV-104', at: 'Sep 11, 2026 21:05', type: 'web.tool', what: 'Portfolio analyzer: core-satellite blend with CGGR and CGDV', src: 'Website analytics' },
  { adv: 'ADV-104', at: 'Sep 18, 2026 12:40', type: 'social.engage', what: 'Liked and shared the “Active ETFs in a core” LinkedIn post', src: 'LinkedIn' },
  { adv: 'ADV-105', at: 'Sep 3, 2026 7:20', type: 'web.search', what: 'Searched “CGGR Wells Fargo platform”', src: 'Website analytics' },
  { adv: 'ADV-105', at: 'Sep 24, 2026 8:05', type: 'web.download', what: 'CGGR fact sheet (PDF)', src: 'Website analytics' },
  { adv: 'ADV-106', at: 'Sep 4, 2026 9:00', type: 'mc.register', what: 'Registered for “Retirement income in a higher-rate world”', src: 'Marketing Cloud' },
  { adv: 'ADV-106', at: 'Sep 20, 2026 19:30', type: 'web.download', what: 'Retirement income playbook (PDF)', src: 'Website analytics' },
  { adv: 'ADV-107', at: 'Sep 26, 2026 21:10', type: 'web.search', what: 'Searched “SIMPLE IRA vs 401(k) for small businesses”', src: 'Website analytics' },
  { adv: null, at: 'Sep 14, 2026 6:00', type: 'model.refresh', what: 'Sales Alpha and Digital Alpha scored for 7 advisors in Southern California', src: 'Weekly model run' },
  { adv: 'ADV-103', at: 'Sep 15, 2026 9:12', type: 'mc.open', what: 'Opened “Retirement income insights, September”', src: 'Marketing Cloud' },
  { adv: 'ADV-103', at: 'Sep 22, 2026 9:05', type: 'mc.open', what: 'Opened “Dividend payers for retirees”', src: 'Marketing Cloud' },
  { adv: null, at: 'Sep 21, 2026 6:00', type: 'model.refresh', what: 'Weekly refresh: no advisor moved more than one decile', src: 'Weekly model run' },
  { adv: 'ADV-104', at: 'Sep 23, 2026 12:20', type: 'web.page', what: 'Active ETFs in a core allocation (CGGR, CGDV)', src: 'Website analytics' },
  { adv: 'ADV-104', at: 'Sep 23, 2026 12:31', type: 'mc.click', what: 'Clicked “ETF model portfolios” in the September ETF email', src: 'Marketing Cloud' },
  { adv: 'ADV-103', at: 'Sep 28, 2026 9:40', type: 'mc.open', what: 'Opened “Income in a higher-rate world” (third open, no clicks)', src: 'Marketing Cloud' }
];
/* details a record states in words, made explicit for the engine */
const SIGNAL_NOTES = { 'INT-7731': { deadline: 'Oct 1, 2026', deadlineLabel: 'Rivera Group committee meets Thursday' } };
/* the work a decision hands to Intelligence, when there is no live AI: a saved AI run of an equivalent request */
const SIGNAL_REPLAYS = {
  'ADV-102|visit': { requester: 'EMP-PRIYA', text: 'Prepare Maya’s retirement committee fee comparison review' },
  'ADV-105|visit': { requester: 'EMP-PRIYA', text: 'Prepare me for tomorrow’s meeting with Daniel’s team' },
  'ADV-104|campaign': { requester: 'EMP-MARCUS', text: 'Create an ETF email campaign for Sofia' },
  'ADV-106|visit': { requester: 'EMP-PRIYA', text: 'Compare BFA and AMBAL for Rachel and schedule a meeting with her next month' },
  'ADV-101|service': { requester: 'EMP-KIM', text: 'Alex says the link in Priya’s email won’t open' },
  'ADV-101|call': { requester: 'EMP-SAM', text: 'Prep me for my call with Alex tomorrow' },
  'ADV-101|explain': { requester: 'EMP-DANA', text: 'Why has GFA trailed the Vanguard growth index? I need an explanation advisors can use.' },
  'ADV-105|platform': { requester: 'EMP-PRIYA', text: 'Which CG ETFs are available at Wells Fargo for Daniel?' },
  'ADV-105|flows': { requester: 'EMP-PRIYA', text: 'Why are Daniel’s overall sales down when his ETF sales are up?' },
  'ADV-106|changed': { requester: 'EMP-PRIYA', text: 'What has changed since my last meeting with Rachel?' },
  'territory|social': { requester: 'EMP-MARCUS', text: 'Write a LinkedIn post on fee transparency for advisors' },
  'territory|trends': { requester: 'EMP-PRIYA', text: 'Identify the growing trends in LA territory' }
};
/* where an event comes from, as a business user groups engagement */
const SIG_CHANNELS = [
  ['digital', 'Digital', 'eye', t => /^(web|ce)\./.test(t)],
  ['email', 'Email', 'mail', t => /^mc\./.test(t)],
  ['social', 'Social', 'globe', t => /^social\./.test(t)],
  ['content', 'Content', 'doc', t => /^ls\./.test(t)],
  ['people', 'Calls', 'users', t => /^crm\.(call|email)$/.test(t)],
  ['service', 'Service', 'bell', t => /^svc\./.test(t)],
  ['tx', 'Flows', 'chart', t => /^tx\./.test(t)],
  ['practice', 'Practice', 'globe', t => /^(crm\.(practice|deadline|coverage)|dealer|news)/.test(t)]
];
const channelOf = type => (SIG_CHANNELS.find(c => c[3](type)) || ['other'])[0];
const SIG_START = 'Sep 14, 2026', SIG_HISTORY = 'Jul 1, 2026';

/* one engine instance per use: the live stream, and a separate one the advisor view runs to today */
function makeSignals() {
  const DAY = 864e5, MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  /* "Sep 24, 2026" plus a clock time, as a local timestamp */
  const ts = (d, hm = '9:00') => { const m = String(d).match(/([A-Z][a-z]{2})\w* (\d{1,2}),? (\d{4})/); if (!m) return NaN; const [hh, mm] = hm.split(':').map(Number); return new Date(+m[3], MON[m[1]], +m[2], hh, mm).getTime(); };
  const clock12 = s => { const m = String(s).match(/(\d{1,2}):(\d{2})\s*([ap])\.?m/i); if (!m) return null; let hh = +m[1] % 12; if (/p/i.test(m[3])) hh += 12; return `${hh}:${m[2]}`; };
  const DEFAULT_HM = { web: '11:', mc: '9:', crm: '10:', svc: '14:', tx: '18:', dealer: '7:', news: '6:', model: '6:', ls: '13:' };
  const hmFor = (type, k) => DEFAULT_HM[type.split('.')[0]] + String(10 + (k * 7) % 45).padStart(2, '0');
  const empOf = name => Object.keys(EMPLOYEES).find(e => EMPLOYEES[e].name === name);

  /* every event, built from the records the foundation already holds */
  function build() {
    const out = []; let k = 0;
    const push = (adv, at, type, what, src, ref, extra) => out.push(Object.assign({ id: 'SIG-' + (++k), adv, t: at, type, what, src, ref: ref || null, topic: topicOfText(what) }, extra || {}));
    DIGITAL.forEach(([adv, d, kind, item], i) => push(adv, ts(d, hmFor('web', i)), kind === 'Webinar' ? 'mc.webinar' : kind === 'Article open' ? 'web.article' : 'web.page', item, kind === 'Webinar' ? 'Marketing Cloud' : 'Website analytics'));
    CHANGE_EVENTS.forEach(([adv, d, what, src], i) => {
      const type = /news/i.test(src) ? 'news.client' : /dealer/i.test(src) ? 'dealer.platform' : /committee set|meeting set|review set/i.test(what) ? 'crm.deadline' : 'crm.practice';
      const dl = what.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})/);
      push(adv, ts(d, type === 'crm.practice' ? '16:00' : type === 'crm.deadline' ? '16:30' : hmFor(type, i)), type, what, src, null, type === 'crm.deadline' && dl ? { deadline: ts(`${dl[1]} ${dl[2]}, 2026`), deadlineLabel: what } : null);
    });
    INTERACTIONS.forEach(x => { const c = CASES.find(y => y.id === x.case), open = c && c.status === 'Open', n = SIGNAL_NOTES[x.id] || {};
      push(x.adv, ts(x.when, clock12(x.when) || '14:00'), open ? 'svc.issue' : 'svc.question', `${x.caller}: ${x.summary}`, x.channel.replace(/,.*/, ''), x.id, Object.assign({ case: x.case }, n.deadline ? { deadline: ts(n.deadline), deadlineLabel: n.deadlineLabel } : {})); });
    DELIVERIES.forEach(d => {
      push(d.adv, ts(d.sent, clock12(d.sent) || '9:00'), 'ls.sent', `${d.from} sent “${d.title}” (${d.asset})`, 'Seismic LiveSend', d.id, { by: empOf(d.from) });
      d.link_events.forEach(le => { const m = le.match(/^([A-Z][a-z]{2} \d{1,2}), ([^:]+:\d{2} [ap]\.m\.):\s*(.*)$/); if (!m) return;
        const at = ts(`${m[1]}, 2026`, clock12(m[2])), body = m[3] === 'same' ? 'click stopped at the firm’s web gateway' : m[3];
        push(d.adv, at, /stopped|blocked/i.test(body) ? 'ls.blocked' : 'ls.open', `“${d.title}”: ${body}`, 'Seismic LiveSend', d.id); });
    });
    EPISODES.forEach((e, i) => { if (!/Call|Email/.test(e.kind)) return; push(e.adv, ts(e.date, e.kind === 'Email' ? '15:' + String(10 + i % 40).padStart(2, '0') : '10:' + String(10 + i % 40).padStart(2, '0')), e.kind === 'Email' ? 'crm.email' : 'crm.call', `${e.kind === 'Email' ? 'Email' : 'Call'} with ${e.with} logged (${e.id})`, 'Salesforce', e.id, { by: empOf(e.with) || null }); });
    FUND_TRANSACTIONS.forEach(([adv, d, fund, kind, m], i) => push(adv, ts(d, hmFor('tx', i)), kind === 'Purchase' ? 'tx.buy' : 'tx.sell', `${kind} of ${fund}: $${m.toFixed(1)}M`, 'Daily transactions', null, { usd: m }));
    HANDOVERS.forEach(x => { const d = x.src.match(/([A-Z][a-z]{2} \d{1,2}, \d{4})/); push(x.adv, ts(d ? d[1] : x.effective, '17:00'), 'crm.coverage', `Coverage moves to ${EMPLOYEES[x.to].name} on ${x.effective}`, 'Salesforce', x.id, { to: x.to, effective: ts(x.effective, '0:00') }); });
    SIGNAL_EXTRAS.forEach(x => { const [d, hm] = x.at.split(/ (?=\d{1,2}:\d{2}$)/); push(x.adv, ts(d, hm), x.type, x.what, x.src); });
    return out.filter(e => !isNaN(e.t) && e.t >= ts(SIG_HISTORY, '0:00') && e.t <= ts(TODAY.replace(/^\w+, /, ''), '23:59')).sort((a, b) => a.t - b.t);
  }

  /* ---- advisor profiles ---- */
  const S = { events: [], cursor: 0, now: 0, prof: {}, wos: [], seq: 0, cap: JSON.parse(JSON.stringify(CAPACITY)), log: [] };
  const fresh = adv => ({ adv, hits: [], touch: null, friction: 0, frictionEv: [], deadline: null, assetsAt: null, coverage: null, opens: [], clicks: 0, last: null });
  function reset() {
    S.events = build(); S.prof = {}; Object.keys(ADVISORS).forEach(a => { S.prof[a] = fresh(a); }); S.wos = []; S.seq = 0; S.cap = JSON.parse(JSON.stringify(CAPACITY)); S.log = [];
    const start = ts(SIG_START, '0:00'); S.cursor = 0; S.now = start;
    while (S.cursor < S.events.length && S.events[S.cursor].t < start) { apply(S.events[S.cursor]); S.cursor++; }
    S.history = S.cursor;
    return S;
  }
  const decay = (w, t, now) => w * Math.pow(0.5, (now - t) / (POLICY.halfLifeDays * DAY));
  function intentOf(p, now) {
    const by = {}; let total = 0;
    p.hits.forEach(h => { const v = decay(h.w, h.t, now); if (v < 0.05) return; by[h.topic] = (by[h.topic] || 0) + v; total += v; });
    const topics = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, name: TOPIC_NAME[k] || k, v }));
    return { total, topics };
  }
  function apply(e) {
    S.now = Math.max(S.now, e.t); if (!e.adv) return;
    const p = S.prof[e.adv], T = SIG_TYPES[e.type];
    p.last = e;
    if (T.w) p.hits.push({ t: e.t, w: T.w, topic: e.topic, ev: e });
    if (T.touch) p.touch = { t: e.t, by: e.by, what: e.what };
    if (T.friction) { p.friction += T.friction; p.frictionEv.push(e); }
    if (T.assets) p.assetsAt = e.t;
    if (e.deadline) p.deadline = { t: e.deadline, label: e.deadlineLabel };
    if (e.type === 'crm.coverage') p.coverage = { to: e.to, at: e.effective };
    if (e.type === 'mc.open') p.opens.push(e.t);
    if (e.type === 'mc.click') p.clicks++;
  }

  /* ---- the decision ---- */
  const days = (a, b) => (b - a) / DAY;
  const covers = (emp, adv) => EMPLOYEES[emp].covers.includes(adv);
  function urgency(p, now) {
    if (p.deadline && p.deadline.t > now) { const d = days(now, p.deadline.t); if (d <= 14) return { x: 1.6, why: `${p.deadline.label} in ${Math.ceil(d)} days` }; if (d <= 60) return { x: 1.3, why: `${p.deadline.label}: ${Math.ceil(d)} days out` }; }
    if (p.assetsAt && days(p.assetsAt, now) <= 14) return { x: 1.4, why: 'Assets in motion now' };
    return { x: 1, why: 'No deadline' };
  }
  const intentMult = total => Math.min(1.3, 0.7 + 0.06 * total);
  const fmtK = v => v == null ? '–' : '$' + Math.round(v) + 'K';
  /* whether this event asks for a decision; most only update the profile */
  function trigger(e, p, now) {
    const T = SIG_TYPES[e.type], I = intentOf(p, now);
    if (T.strength === 'strong') return { yes: true, why: `${T.label}: a strong signal` };
    const recentOpens = p.opens.filter(t => days(t, now) <= 21).length;
    if (e.type === 'mc.open' && recentOpens >= 3 && !p.clicks) return { yes: true, why: `${recentOpens} opens in 3 weeks, no clicks` };
    if (T.w && I.total >= POLICY.trigger && (p.lastIntentTrig == null || p.lastIntentTrig < POLICY.trigger)) return { yes: true, why: `Interest reached ${I.total.toFixed(1)} (threshold ${POLICY.trigger})` };
    return { yes: false, why: T.w ? `Interest ${I.total.toFixed(1)} of ${POLICY.trigger}` : T.touch ? 'Contact recorded' : T.friction ? `Friction ${p.friction}` : 'Profile updated' };
  }
  function decide(adv, now, e, opts = {}) {
    const p = S.prof[adv], A = ADVISORS[adv], a = VISIT_ALPHA[adv], I = intentOf(p, now), U = urgency(p, now), im = intentMult(I.total);
    const strong = !!(e && SIG_TYPES[e.type].strength === 'strong') || !!opts.cleared;
    const ext = 'EMP-PRIYA', int = 'EMP-SAM';
    const guards = [];
    /* 1. friction comes first: fix it before any selling */
    if (p.friction >= 2 && !opts.cleared) {
      guards.push({ k: 'Friction', ok: false, note: `${p.frictionEv.length} access failures, ${p.frictionEv.map(x => x.ref).filter(Boolean).filter((x, i, s) => s.indexOf(x) === i).join(', ')}` });
      return mk(adv, now, e, { action: 'service', owner: 'EMP-KIM', value: null, I, U, im, guards, options: [{ action: 'service', label: 'Fix the problem first', value: null, ok: true, chosen: true, note: 'An open access issue: selling now would backfire' }], why: 'Service friction outranks any sales action' });
    }
    const handing = p.coverage && p.coverage.at > now && days(now, p.coverage.at) <= 7 && covers(ext, adv) && p.coverage.to !== ext;
    const lastDays = p.touch ? days(p.touch.t, now) : 99;
    const cool = lastDays < POLICY.coolOffDays && !strong;
    const planned = COMMITMENTS.find(c => c.adv === adv && c.status === 'Open' && /Priya|Sam/.test(c.owner) && !isNaN(ts(c.due)) && ts(c.due) > now && days(now, ts(c.due)) <= POLICY.plannedDays);
    const firm = FIRMS[A.firm];
    guards.push({ k: 'Contact cool-off', ok: !cool, note: p.touch ? `Last contact ${Math.floor(lastDays)} day${Math.floor(lastDays) === 1 ? '' : 's'} ago${strong && lastDays < POLICY.coolOffDays ? '; strong signal overrides' : ''}` : 'No recent contact' });
    guards.push({ k: 'Follow-up already planned', ok: !planned, note: planned ? `${planned.id}: ${planned.owner}, due ${planned.due}` : 'None open' });
    if (firm.policy) guards.push({ k: 'Firm rules', ok: true, note: firm.policy.replace(/ \(.*\)$/, '') + ': send PDFs, not links' });
    guards.push({ k: 'Approved content only', ok: true, note: 'Seismic-approved pieces and disclosures' });
    /* 2. value each option */
    const cap = S.cap[ext], open = cap.slots - cap.booked, low = cap.bookedLow[0];
    const vVisit = a.sales * POLICY.visitShare * U.x * im, vCall = a.sales * POLICY.callShare * POLICY.callConnect * U.x * im, vDig = a.digital * Math.min(1.6, 0.6 + 0.1 * I.total);
    const options = [];
    const visitBlock = !covers(ext, adv) ? 'No external wholesaler covers this advisor' : handing ? `Coverage moves to ${EMPLOYEES[p.coverage.to].name} on ${new Date(p.coverage.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : planned ? `Already planned: ${planned.id}` : cool ? `Cool-off: contact ${Math.floor(lastDays)} days ago` : null;
    const cutoff = open > 0 ? null : low ? low.value : Infinity;
    const visitOK = !visitBlock && (cutoff == null || vVisit > cutoff);
    options.push({ action: 'visit', label: 'In-person visit', owner: ext, value: vVisit, ok: visitOK, cutoff: cutoff == null ? (low ? low.value : null) : cutoff, open,
      formula: `Sales Alpha ${fmtK(a.sales)} × ${POLICY.visitShare * 100}% meeting likelihood × ${U.x} urgency × ${im.toFixed(2)} interest`,
      note: visitBlock || (open > 0 ? `${open} open slot${open > 1 ? 's' : ''} ${cap.window}` : vVisit > cutoff ? `Bumps ${low.what} (${fmtK(low.value)}), offered digitally instead` : `Below the capacity cut-off of ${fmtK(cutoff)}`) });
    const callBlock = !covers(int, adv) ? 'No internal coverage' : planned ? `Already planned: ${planned.id}` : cool ? 'Cool-off' : null;
    options.push({ action: 'call', label: 'Internal call', owner: int, value: vCall, ok: !callBlock && vCall >= POLICY.callMin,
      formula: `Sales Alpha ${fmtK(a.sales)} × ${POLICY.callShare * 100}% of a visit (assumed; no internal model yet) × ${POLICY.callConnect * 100}% connect × ${U.x} × ${im.toFixed(2)}`,
      note: callBlock || (vCall >= POLICY.callMin ? `${S.cap[int].perWeek - S.cap[int].booked} call slots this week` : `Below the ${fmtK(POLICY.callMin)} minimum`) });
    const top = I.topics[0], personal = top && top.v >= 2 && OPPORTUNITIES.some(o => o.adv === adv && !/lost/i.test(o.stage));
    options.push({ action: personal ? 'campaign' : 'journey', label: personal ? 'Personalized digital follow-up' : 'Digital journey', owner: personal ? 'EMP-MARCUS' : null, value: vDig, ok: !cool && vDig >= POLICY.digitalMin,
      formula: `Digital Alpha ${fmtK(a.digital)} × ${Math.min(1.6, 0.6 + 0.1 * I.total).toFixed(2)} interest`,
      note: cool ? 'Cool-off applies to all outreach' : personal ? `Built by Marketing from approved Seismic content on ${lc(top.name)}` : 'Pre-approved nurture track; no agents needed' });
    options.push({ action: 'hold', label: 'Hold and keep watching', owner: null, value: 0, ok: true, note: 'Doing nothing is a valid choice' });
    const chosen = options.filter(o => o.ok && o.action !== 'hold').sort((x, y) => y.value - x.value)[0] || options.find(o => o.action === 'hold');
    chosen.chosen = true;
    guards.push({ k: 'Capacity', ok: chosen.action !== 'visit' || open > 0 || vVisit > cutoff, note: chosen.action === 'visit' ? (open > 0 ? `${open} of ${cap.slots} visit slots open, ${cap.window}` : `Full; bumps ${low.what}`) : `${Math.max(0, open)} of ${cap.slots} visit slots open` });
    return mk(adv, now, e, { action: chosen.action, owner: chosen.owner, value: chosen.value, I, U, im, guards, options, why: chosen.action === 'hold' ? (cool ? `Cool-off: ${p.touch.by ? EMPLOYEES[p.touch.by].name : 'the team'} was in touch ${Math.floor(lastDays) || 'less than 1'} day${Math.floor(lastDays) === 1 ? '' : 's'} ago` : 'No option clears its threshold') : `${chosen.label}: highest incremental value that passes the guardrails` });
  }
  function mk(adv, now, e, d) {
    const p = S.prof[adv], A = ADVISORS[adv];
    const evidence = p.hits.concat(p.frictionEv.map(x => ({ ev: x, t: x.t, w: 0 }))).map(h => h.ev).filter((x, i, s) => s.indexOf(x) === i && days(x.t, now) <= 21 && x.t <= now).sort((x, y) => y.t - x.t).slice(0, 5);
    if (e && !evidence.includes(e)) evidence.unshift(e);
    const due = p.deadline && p.deadline.t > now ? Math.min(p.deadline.t - 3 * DAY, now + 14 * DAY) : now + (d.action === 'service' ? 1 : d.action === 'call' ? 2 : 14) * DAY;
    const wo = Object.assign({ id: 'WO-' + (++S.seq), adv, at: now, trigger: e ? e.id : null, evidence, due: Math.max(due, now + DAY), status: 'decided' }, d);
    wo.needsWork = ['visit', 'call', 'campaign', 'service'].includes(wo.action);
    wo.text = workText(wo, A);
    wo.replay = SIGNAL_REPLAYS[`${adv}|${wo.action}`] || null;
    return wo;
  }
  const dstr = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lc = x => x.replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase());
  /* the request the owner would have typed, written for them */
  function workText(wo, A) {
    const firm = FIRMS[A.firm].name, topics = wo.I.topics.filter(x => x.k !== 'access').slice(0, 2).map(x => lc(x.name)).join(' and ') || 'their current priorities';
    const why = wo.evidence.slice(0, 3).map(x => `${dstr(x.t)}: ${x.what}`).join('; ');
    if (wo.action === 'service') return `${A.short} can’t open what we sent (${firm}). ${why}. Fix the access problem, resend in a format the firm allows, and tell the coverage team.`;
    if (wo.action === 'visit') return `Prepare me for an in-person visit with ${A.name} (${firm}) by ${dstr(wo.due)}: schedule it through SSC and build a brief on ${topics} with approved Seismic content. Why now: ${why}.`;
    if (wo.action === 'call') return `Prepare me to call ${A.name} (${firm}) by ${dstr(wo.due)} about ${topics}. Why now: ${why}.`;
    if (wo.action === 'campaign') return `Create a personalized digital follow-up for ${A.name} (${firm}) on ${topics} from approved Seismic content, checked by compliance. Why now: ${why}.`;
    return '';
  }
  /* advance by one event: apply it, then decide if it calls for it */
  function step() {
    if (S.cursor >= S.events.length) return null;
    const e = S.events[S.cursor++]; apply(e);
    const res = { e, outcome: 'profile', note: SIG_TYPES[e.type].label };
    if (!e.adv) { res.note = 'All advisors re-scored'; S.log.push(res); return res; }
    const p = S.prof[e.adv], tr = trigger(e, p, e.t); res.note = tr.why;
    if (tr.yes) {
      const I = intentOf(p, e.t); p.lastIntentTrig = I.total;
      const open = S.wos.find(w => w.adv === e.adv && !['dismissed', 'held'].includes(w.status) && days(w.at, e.t) <= POLICY.dedupeDays && w.action !== 'hold');
      const newFriction = SIG_TYPES[e.type].friction && !(open && open.action === 'service');
      if (open && !newFriction) { res.outcome = 'covered'; res.note = `Already handled by ${open.id} (${actName(open.action)})`; open.evidence.unshift(e); open.evidence = open.evidence.slice(0, 6); }
      else { const wo = decide(e.adv, e.t, e); book(wo); S.wos.push(wo); res.outcome = wo.action === 'hold' ? 'held' : 'decision'; res.wo = wo; res.note = tr.why; }
    } else p.lastIntentTrig = intentOf(p, e.t).total;
    S.log.push(res); return res;
  }
  /* after a work order finishes, the advisor is looked at again (a fix can unblock a sale) */
  /* a visit takes a slot (or bumps the least valuable booked visit); a call takes desk time */
  function book(wo) {
    if (wo.action === 'visit') { const c = S.cap['EMP-PRIYA']; if (c.booked < c.slots) c.booked++; else wo.bumped = c.bookedLow.shift(); }
    if (wo.action === 'call') S.cap['EMP-SAM'].booked++;
  }
  function release(wo) {
    if (wo.action === 'visit') { const c = S.cap['EMP-PRIYA']; if (wo.bumped) c.bookedLow.unshift(wo.bumped); else c.booked--; }
    if (wo.action === 'call') S.cap['EMP-SAM'].booked--;
  }
  function after(wo, now) {
    const p = S.prof[wo.adv];
    if (wo.action === 'visit' || wo.action === 'call') p.touch = { t: now, by: wo.owner, what: wo.action === 'visit' ? 'Visit booked' : 'Call booked' };
    if (wo.action === 'service') { p.friction = 0; const next = decide(wo.adv, now, null, { cleared: true }); next.followsUp = wo.id; next.why = 'Friction cleared; ' + next.why.charAt(0).toLowerCase() + next.why.slice(1); book(next); S.wos.push(next); return next; }
    return null;
  }
  const ACT_NAMES = { visit: 'In-person visit', call: 'Internal call', campaign: 'Personalized digital follow-up', journey: 'Digital journey', service: 'Fix first', hold: 'Hold',
    explain: 'Product explanation', platform: 'Platform availability check', flows: 'Flow diagnosis', changed: 'What changed since we last met', social: 'Social post', trends: 'Territory trends' };
  const actName = a => ACT_NAMES[a] || a;

  /* ---- the advisor view: everything up to today, a takeaway, and the actions ---- */
  function runToToday() {
    reset(); let r;
    while ((r = step())) { if (r.wo && r.wo.action === 'service') after(r.wo, r.e.t + 20 * 60000); if (r.wo && r.wo.action === 'journey') r.wo.status = 'enrolled'; }
    return S;
  }
  const short = adv => ADVISORS[adv].short;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const clip = (x, n = 70) => x.length > n ? x.slice(0, n - 1).replace(/[\s,;:]+\S*$/, '') + '…' : x;
  function engagement(ev) {
    const c = t => ev.filter(e => e.type === t).length, web = ev.filter(e => /^(web|ce)\./.test(e.type));
    const parts = [['web.tool', 'tool'], ['web.download', 'download'], ['web.search', 'search'], ['web.article', 'article'], ['web.page', 'page visit'], ['ce.course', 'CE course'], ['web.login', 'portal login']].map(([t, w]) => c(t) ? plural(c(t), w) : '').filter(Boolean);
    const opens = c('mc.open'), clicks = c('mc.click'), webinars = c('mc.webinar'), noshow = c('mc.noshow'), social = c('social.engage'), seen = c('ls.open');
    const calls = ev.filter(e => e.type === 'crm.call'), mails = ev.filter(e => e.type === 'crm.email'), people = [...new Set(calls.concat(mails).map(e => e.by && EMPLOYEES[e.by] ? EMPLOYEES[e.by].name.split(' ')[0] : null).filter(Boolean))];
    const digital = web.length + clicks + webinars + social + seen, human = calls.length + mails.length + ev.filter(e => /^svc\./.test(e.type)).length;
    const style = digital >= 6 && digital >= human * 2 ? 'Digital-first' : human > digital ? 'Relationship-led' : digital + human <= 3 ? 'Quiet' : 'Balanced';
    const bits = [];
    if (web.length) bits.push(`${plural(web.length, 'web action')} on their own (${parts.join(', ')})`);
    if (opens || clicks || webinars || noshow) bits.push(`email: ${opens} opened, ${clicks} clicked${webinars ? `, ${plural(webinars, 'webinar')} attended` : ''}${noshow ? `, ${noshow} no-show` : ''}`);
    if (social) bits.push(`${plural(social, 'LinkedIn engagement')}`);
    if (seen) bits.push(`opened shared content ${plural(seen, 'time')}`);
    if (calls.length || mails.length) bits.push(`${plural(calls.length, 'call')} and ${plural(mails.length, 'email')} with ${people.join(' and ') || 'the team'}`);
    return { style, text: bits.join('; ') || 'Little recorded activity', digital, human, opens, clicks };
  }
  function momentum(ev, now) {
    const w = (a, b) => ev.filter(e => e.t > now - a * DAY && e.t <= now - b * DAY).reduce((m, e) => m + SIG_TYPES[e.type].w, 0);
    const recent = w(14, 0), before = w(28, 14);
    const dir = recent > before * 1.5 + 1 ? 'Rising' : before > recent * 1.5 + 1 ? 'Cooling' : 'Steady';
    return { dir, text: `${dir}: interest weight ${recent.toFixed(1)} in the last two weeks, ${before.toFixed(1)} the two weeks before` };
  }
  function takeaway(adv) {
    const A = ADVISORS[adv], p = S.prof[adv], now = S.now, ev = S.events.filter(e => e.adv === adv);
    const I = intentOf(p, now), tops = I.topics.filter(x => !['access', 'general'].includes(x.k) && x.v >= 0.5).slice(0, 2);
    const E = engagement(ev), M = momentum(ev, now);
    const wos = S.wos.filter(w => w.adv === adv), acts = wos.filter(w => w.action !== 'hold'), main = acts[0] || wos[0] || null;
    const topicEv = tops.length ? p.hits.filter(h => h.topic === tops[0].k).sort((a, b) => b.w - a.w || b.t - a.t).slice(0, 3).map(h => clip(h.ev.what, 60)) : [];
    const tx = ev.filter(e => /^tx\./.test(e.type)), buy = tx.filter(e => e.type === 'tx.buy').reduce((m, e) => m + e.usd, 0), sell = tx.filter(e => e.type === 'tx.sell').reduce((m, e) => m + e.usd, 0);
    const opps = OPPORTUNITIES.filter(o => o.adv === adv && !/lost/i.test(o.stage));
    const watch = [];
    if (p.frictionEv.length) watch.push(`${plural(p.frictionEv.length, 'access failure')} (${[...new Set(p.frictionEv.map(e => e.ref).filter(Boolean))].join(', ')})`);
    if (FIRMS[A.firm].policy) watch.push(FIRMS[A.firm].policy.replace(/ \(.*\)$/, ''));
    if (p.coverage) watch.push(`Coverage moves to ${EMPLOYEES[p.coverage.to].name} on ${dstr(p.coverage.at)}`);
    if (p.touch && (now - p.touch.t) / DAY < POLICY.coolOffDays) { const d = Math.floor((now - p.touch.t) / DAY); watch.push(`Contacted ${d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'}: avoid piling on`); }
    const held = wos.filter(w => w.action === 'hold'); held.forEach(w => watch.push(`Held on ${dstr(w.at)}: ${w.why.replace(/^Cool-off: /, 'cool-off, ')}`));
    const coming = [];
    if (p.deadline && p.deadline.t > now) coming.push(`${p.deadline.label}: ${dstr(p.deadline.t)}`);
    COMMITMENTS.filter(c => c.adv === adv && c.status === 'Open').forEach(c => coming.push(`${c.id}: ${c.title} (${c.owner}, ${c.due})`));
    const topicTxt = tops.length ? tops.map(x => x.name.replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase())).join(' and ') : 'nothing in particular';
    const H = {
      service: () => `${short(adv)} is engaged, but ${FIRMS[A.firm].name} is blocking what we send. Fix that first; the selling conversation comes after.`,
      visit: () => `${short(adv)} is actively looking at ${topicTxt}${main.U && main.U.x > 1 ? ` (${main.U.why.replace(/^[A-Z]/, c => c.toLowerCase())})` : ''}. An in-person visit is the highest-value next step, worth about ${fmtK(main.value)} in incremental sales.`,
      campaign: () => `${short(adv)} researches ${topicTxt} online, mostly on their own. A human follow-up is already planned, so the next step is a personal digital follow-up.`,
      journey: () => `${short(adv)} opens our emails but doesn’t act on them (${E.opens} opens, ${E.clicks} clicks). Keep it light: a pre-approved digital journey, no agents needed.`,
      call: () => `${short(adv)}’s business is moving (${clip(main.evidence[0] ? main.evidence[0].what : 'new signals', 80)}). ${EMPLOYEES[main.owner].name} should call.`,
      hold: () => `Nothing worth acting on yet. ${short(adv)}’s profile is updated with every event and Intelligence keeps watching.`
    };
    return {
      headline: main ? H[main.action]() : `Quiet: ${short(adv)} has little recent activity. Intelligence keeps watching.`,
      style: E.style, momentum: M.dir, interest: I.total,
      bullets: [
        ['Interest', tops.length ? `${tops.map(x => `${x.name} (${x.v.toFixed(1)})`).join(', ')}: ${topicEv.join('; ')}` : 'No clear topic in the last 90 days'],
        ['How they engage', `${E.style}. ${E.text.replace(/^./, c => c.toUpperCase())}`],
        ['Momentum', M.text],
        ['Business with us', [buy || sell ? `$${buy.toFixed(1)}M bought${sell ? `, $${sell.toFixed(1)}M redeemed` : ''} since Jul 1 (${[...new Set(tx.map(e => e.what.match(/of (\w+)/)[1]))].join(', ')})` : 'No transactions since Jul 1', opps.length ? opps.map(o => `${o.id} ${o.name} (${o.stage})`).join('; ') : ''].filter(Boolean).join('. ')],
        ['Watch-outs', watch.join('. ') || 'None'],
        ['Coming up', coming.join('. ') || 'Nothing scheduled']
      ]
    };
  }
  /* the next best action(s) from the decisions, plus what else the pattern of events calls for */
  function actionsFor(adv) {
    const A = ADVISORS[adv], ev = S.events.filter(e => e.adv === adv), now = S.now, firm = FIRMS[A.firm].name, out = [];
    S.wos.filter(w => w.adv === adv && w.action !== 'hold').forEach(w => { w.primary = true; out.push(w); });
    const sup = (action, owner, evs, why, text) => out.push({ id: `REC-${adv.slice(-3)}-${action.toUpperCase().slice(0, 4)}`, adv, action, owner, evidence: evs, why, text, value: null, replay: SIGNAL_REPLAYS[`${adv}|${action}`] || null, needsWork: true, status: 'decided', at: now, supporting: true });
    const cmp = ev.filter(e => /^(web|ce)\./.test(e.type) && /\bvs\.?\s|attribution|comparison/i.test(e.what));
    if (cmp.length >= 2) { const f = (cmp.map(e => e.what.match(/\b(GFA|AMBAL|BFA|CGGR|CGDV)\b/)).find(Boolean) || ['the fund'])[0];
      sup('explain', 'EMP-DANA', cmp.slice().reverse().slice(0, 3), `${short(adv)} keeps comparing ${f} with an index online (${plural(cmp.length, 'time')}). Product writes the explanation once, for every advisor asking.`,
        `Why has ${f} trailed its index? I need an explanation advisors like ${A.name} can use. What they looked at: ${cmp.map(e => `${dstr(e.t)}: ${e.what}`).join('; ')}.`); }
    const plat = ev.filter(e => e.type === 'dealer.platform' && now - e.t <= 45 * DAY);
    if (plat.length) sup('platform', 'EMP-PRIYA', plat.concat(ev.filter(e => /^web\./.test(e.type) && /platform|cggr/i.test(e.what)).slice(-2).reverse()), `${plat[0].what}, and ${short(adv)} has been looking it up. Confirm exactly what is available at ${firm} before anyone pitches it.`,
      `Which CG ETFs are available at ${firm} for ${A.name}? ${plat[0].what} (${dstr(plat[0].t)}).`);
    const sells = ev.filter(e => e.type === 'tx.sell' && e.usd >= 4), buys = ev.filter(e => e.type === 'tx.buy' && /CGGR|CGDV|CGCP/.test(e.what));
    const shift = sells.find(x => buys.some(b => Math.abs(b.t - x.t) <= 30 * DAY));
    if (shift) { const bs = buys.filter(b => Math.abs(b.t - shift.t) <= 30 * DAY);
      sup('flows', 'EMP-PRIYA', [shift].concat(bs), `${shift.what} next to ${bs.map(b => b.what.replace(/^Purchase of /, '')).join(', ')} in ETFs: a vehicle shift, not a lost relationship. Explain it before the next meeting.`,
        `Why are ${A.short}’s overall sales down when ETF sales are up? ${[shift].concat(bs).map(e => `${dstr(e.t)}: ${e.what}`).join('; ')}.`); }
    const lastCall = ev.filter(e => e.type === 'crm.call').slice(-1)[0], ch = ev.filter(e => e.type === 'crm.practice' && lastCall && e.t > lastCall.t);
    if (ch.length) sup('changed', 'EMP-PRIYA', ch, `${ch[0].what}, after the last call on ${dstr(lastCall.t)}. Catch up on everything that changed before the visit.`, `What has changed since my last meeting with ${A.short}?`);
    return out;
  }
  function territory() {
    const advs = Object.keys(ADVISORS), now = S.now, all = S.events.filter(e => e.adv);
    const topic = {}; advs.forEach(a => intentOf(S.prof[a], now).topics.forEach(x => { if (['access', 'general'].includes(x.k)) return; (topic[x.k] = topic[x.k] || { name: x.name, v: 0, who: [] }); topic[x.k].v += x.v; if (x.v >= 1) topic[x.k].who.push(short(a)); }));
    const tops = Object.values(topic).sort((a, b) => b.v - a.v).slice(0, 3);
    const feeEv = all.filter(e => e.topic === 'fees'), F0 = SERVICE_INSIGHTS.fees, post = ENGAGEMENT.fees[1];
    const la = all.filter(e => TERRITORIES.LA.advisors.includes(e.adv)), laTop = {}; la.forEach(e => { if (SIG_TYPES[e.type].w && !['access', 'general'].includes(e.topic)) laTop[e.topic] = (laTop[e.topic] || 0) + 1; });
    const laList = Object.entries(laTop).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${TOPIC_NAME[k]} (${n})`);
    const byAct = {}; S.wos.forEach(w => { byAct[w.action] = (byAct[w.action] || 0) + 1; });
    const c = S.cap['EMP-PRIYA'];
    const actions = [
      { id: 'REC-TER-SOCI', adv: null, action: 'social', owner: 'EMP-MARCUS', evidence: feeEv.slice().reverse().slice(0, 3), why: `Fee questions to service rose from ${F0.contacts_last_quarter} to ${F0.contacts_this_quarter} this quarter, and advisors are reading fee content. ${post.takeaway}`, text: 'Write a LinkedIn post on fee transparency for advisors: show what a fee costs in dollars, not just percent.', value: null, replay: SIGNAL_REPLAYS['territory|social'], needsWork: true, status: 'decided', at: now, supporting: true },
      { id: 'REC-TER-TRND', adv: null, action: 'trends', owner: 'EMP-PRIYA', evidence: la.filter(e => SIG_TYPES[e.type].w).slice(-3).reverse(), why: `LA activity clusters on ${laList.join(', ')}. Confirm the trend from recorded conversations before planning the territory.`, text: 'Identify the growing trends in LA territory', value: null, replay: SIGNAL_REPLAYS['territory|trends'], needsWork: true, status: 'decided', at: now, supporting: true }
    ];
    return {
      headline: `Across Southern California, ${tops.map(t => t.name.replace(/^[A-Z](?=[a-z])/, x => x.toLowerCase())).join(', ').replace(/, ([^,]*)$/, ' and $1')} lead what advisors are researching, and fee questions to service are up ${Math.round((F0.contacts_this_quarter / F0.contacts_last_quarter - 1) * 100)}% this quarter.`,
      bullets: [
        ['Researching', tops.map(t => `${t.name} (${t.v.toFixed(1)}): ${t.who.join(', ') || 'light'}`).join('; ')],
        ['Fees', `${plural(feeEv.length, 'fee-related event')} from ${[...new Set(feeEv.map(e => short(e.adv)))].join(', ')}. Service: ${F0.contacts_last_quarter} → ${F0.contacts_this_quarter} fee contacts. ${F0.takeaway}`],
        ['Los Angeles', `${plural(la.length, 'event')} from ${TERRITORIES.LA.advisors.map(short).join(', ')}; most active topics ${laList.join(', ')}`],
        ['Decisions so far', Object.entries(byAct).map(([k, n]) => `${actName(k)} ${n}`).join(' · ')],
        ['Capacity', `Priya: ${c.slots - c.booked} of ${c.slots} visit slots open (${c.window}); cut-off ${fmtK(c.bookedLow[0] ? c.bookedLow[0].value : 0)}. Sam: ${S.cap['EMP-SAM'].perWeek - S.cap['EMP-SAM'].booked} call slots this week`]
      ],
      actions
    };
  }
  return { S, reset, step, after, release, decide, intentOf, urgency, actName, fmtK, ts, dstr, DAY, runToToday, takeaway, actionsFor, territory, engagement, momentum };
}
const SIGNALS = makeSignals();
