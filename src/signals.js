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
/* activity the existing records do not hold: email engagement and the weekly model runs */
const SIGNAL_EXTRAS = [
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
  'ADV-101|call': { requester: 'EMP-SAM', text: 'Prep me for my call with Alex tomorrow' }
};
const SIG_START = 'Sep 14, 2026', SIG_HISTORY = 'Sep 1, 2026';

const SIGNALS = (() => {
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
  const actName = a => ({ visit: 'In-person visit', call: 'Internal call', campaign: 'Personalized digital follow-up', journey: 'Digital journey', service: 'Fix first', hold: 'Hold' }[a] || a);
  return { S, reset, step, after, release, decide, intentOf, urgency, actName, fmtK, ts, dstr, DAY };
})();
