/* ===== Agent Harness: the business user's view =====
   A conversation, not a dashboard. The person asks in their own words; the
   harness asks only what it needs (clarifying options), then shows each system
   it connects to, what it fetched, what it passed on, which template it used,
   and builds the answer as live components. Data comes from the same tools
   (data.js + engine.js) the agents use, so every number is traceable. */
(() => {
const $ = id => document.getElementById(id);
const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const QS = new URLSearchParams(location.search);
const SPEED = QS.has('fast') ? 0.04 : 1;
const wait = ms => new Promise(r => setTimeout(r, ms * SPEED));
const m$ = v => v == null ? '—' : `$${Math.abs(v) >= 100 ? Math.round(v) : (+v).toFixed(1)}M`;
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + m$(Math.abs(v)).replace('$', '$');
const pct = v => v == null ? '—' : `${(+v).toFixed(1)}%`;
const first = s => String(s).split(/[ ,]/)[0];
const initials = n => String(n).replace(/,.*$/, '').split(' ').map(x => x[0]).join('').slice(0, 2);

/* ---------- systems the harness connects to ---------- */
const SYS = {
  sf: { name: 'Salesforce', sub: 'CRM, call notes, opportunities', color: '#1b8ef2', abbr: 'SF', via: 'MCP gateway' },
  fund: { name: 'Data platform', sub: 'Assets, flows, transactions, fund facts', color: '#11a37f', abbr: 'DP', via: 'Data API' },
  seismic: { name: 'Seismic', sub: 'Approved content, messaging, templates', color: '#e5533c', abbr: 'Se', via: 'MCP gateway' },
  news: { name: 'Insights feed', sub: 'Market themes and news', color: '#d4890f', abbr: 'IN', via: 'Data API' },
  sp: { name: 'SharePoint', sub: 'Disclosures and channel rules', color: '#0b7d8c', abbr: 'SP', via: 'Graph API' },
  m365: { name: 'Outlook', sub: 'Calendars, holds and drafts', color: '#2f6fd6', abbr: 'Ou', via: 'Graph API' },
  dealer: { name: 'Dealer platform feed', sub: 'What each firm offers, by program', color: '#7c5cd6', abbr: 'DF', via: 'Data API' },
  changes: { name: 'Change history', sub: 'Activity since the last meeting', color: '#a1662f', abbr: 'CH', via: 'Foundation' }
};
const TOOL_SYS = t => /^(crm|engage)\./.test(t) ? 'sf' : /^(book|fund|models|mstar)\./.test(t) ? 'fund' : /^seismic\./.test(t) ? 'seismic' : /^(content|news)\./.test(t) ? 'news' : /^sharepoint\./.test(t) ? 'sp' : /^(calendar|mail)\./.test(t) ? 'm365' : /^platform\./.test(t) ? 'dealer' : t === 'insights.changes_since' ? 'changes' : 'fund';
const TOOL_LABEL = {
  'crm.get_contact': 'advisor profile', 'crm.get_call_notes': 'call notes', 'crm.get_opportunities': 'open opportunities', 'crm.get_team': 'advisor and coverage team',
  'book.get_assets': 'assets by vehicle and fund', 'book.get_flows': 'twelve-month sales and redemptions', 'book.get_fund_transactions': 'fund transactions',
  'insights.changes_since': 'activity since the last meeting', 'platform.get_availability': 'platform availability', 'content.get_themes': 'this week’s themes',
  'news.get_items': 'news items', 'seismic.search_content': 'approved content', 'seismic.get_approved_language': 'approved messaging', 'sharepoint.get_disclosures': 'required disclosures',
  'calendar.find_times': 'free times', 'calendar.create_event': 'calendar hold', 'fund.get_facts': 'verified fund facts'
};
/* Seismic template library (what the answer is poured into) */
const TEMPLATES = {
  brief: { id: 'TPL-MB-04', name: 'Meeting brief, one page', ver: 'v4 · approved Aug 2026', slots: ['Who’s in the room', 'Relationship at a glance', 'What they told us', 'Since the last meeting', 'Talking points', 'Suggested agenda', 'Next steps'] },
  agenda: { id: 'TPL-AG-02', name: 'Timed meeting agenda', ver: 'v2 · approved Jul 2026', slots: ['Attendees', 'Objectives', 'Timed agenda', 'Materials', 'Next steps'] },
  points: { id: 'TPL-TP-01', name: 'Talking points card', ver: 'v3 · approved Sep 2026', slots: ['Open with', 'Their numbers', 'What they told us', 'Themes to raise', 'Ask'] },
  email: { id: 'TPL-EM-07', name: 'Advisor market update email', ver: 'v7 · approved Sep 2026', slots: ['Subject', 'Greeting', 'This week’s theme', 'Approved messaging', 'Attachments', 'Disclosures'] },
  linkedin: { id: 'SEIS-118', name: 'LinkedIn post: education', ver: 'v2 · approved Jun 2026', slots: ['Hook', 'Approved messaging', 'Call to action', 'Disclosures'] },
  pbStd: { id: 'TPL-PB-11', name: 'Standard pitch book', ver: 'v11 · approved Sep 2026', slots: ['Cover', 'Why Capital Group', 'Lineup on your platform', 'Fund facts', 'Where active fits', 'Disclosures'] },
  pbCustom: { id: 'TPL-PB-20', name: 'Custom pitch book', ver: 'v3 · approved Aug 2026', slots: ['Cover', 'Your book today', 'Lineup on your platform', 'Fund facts', 'Where active fits', 'Disclosures'] }
};

/* ---------- people ---------- */
const PERSONAS = {
  'EMP-PRIYA': ['Prep me for my meeting with Daniel’s team tomorrow', 'What market update can I share with Rachel this week?', 'Why are Sofia’s mutual fund sales down?', 'Set up a meeting with Maya next week', 'What has changed since my last meeting with Rachel?'],
  'EMP-MARCUS': ['Draft a market update email for LA advisors', 'Create a custom pitch book on CG ETFs for Daniel’s team', 'Write a LinkedIn post on fee conversations'],
  'EMP-DANA': ['Which CG ETFs are available at Wells Fargo for Daniel?', 'Build a standard pitch book on Capital Group ETFs', 'Prep the investment director for Daniel’s team meeting']
};
let ME = 'EMP-PRIYA';
const meName = () => EMPLOYEES[ME].name;

/* ---------- understanding the request ---------- */
function findAdvisor(text) {
  const t = ' ' + text.toLowerCase().replace(/[’']s\b/g, '') + ' ';
  return Object.keys(ADVISORS).find(id => { const a = ADVISORS[id]; return t.includes(' ' + a.short.toLowerCase() + ' ') || t.includes(a.name.toLowerCase().replace(/,.*$/, '')) || t.includes(' ' + a.short.toLowerCase() + ',') || t.includes(' ' + a.short.toLowerCase() + '?'); }) || null;
}
function classify(text) {
  const t = text.toLowerCase();
  if (/\b(schedule|set up|book (a|an|the)|find (a )?time|calendar|invite)\b/.test(t)) return 'schedule';
  if (/pitch ?book/.test(t)) return 'pitch';
  if (/\b(prep|prepare|brief|agenda|changed since|talking points)\b/.test(t)) return 'prep';
  if (/\b(available|availability|platform|shelf)\b/.test(t)) return 'platform';
  if (/\b(market|commentary|outlook|insight|theme|news|linkedin|post|campaign)\b/.test(t) || /update .*share|share .*update/.test(t)) return 'market';
  if (/\b(why|sales|redemption|redemptions|flows?|down|declin\w*|drop\w*)\b/.test(t)) return 'flows';
  if (/\b(meeting|call with)\b/.test(t)) return 'prep';
  return null;
}
const INTENT_NAME = { prep: 'Prepare', market: 'Draft', flows: 'Diagnose', schedule: 'Execute (with approval)', pitch: 'Draft', platform: 'Verify' };
const AUTH = { prep: 'Read-only', market: 'Draft only, nothing is sent', flows: 'Read-only', schedule: 'Proposed change, needs your approval', pitch: 'Draft only, nothing is sent', platform: 'Read-only' };

/* ---------- the playbooks: what to ask, then what to run ---------- */
const coveredAdvisors = () => (EMPLOYEES[ME].covers.length ? EMPLOYEES[ME].covers : ['ADV-105', 'ADV-106', 'ADV-101', 'ADV-104']).slice(0, 4);
const advisorQ = (title = 'Who is this for?') => ({ key: 'adv', title, options: coveredAdvisors().map((id, k) => ({ value: id, label: ADVISORS[id].name.replace(/,.*$/, ''), desc: `${ADVISORS[id].team.replace(/\s*\(.*\)/, '')} · ${FIRMS[ADVISORS[id].firm].name}`, rec: k === 0 })) });

const PLAYBOOKS = {
  prep: {
    questions: (ctx) => {
      const a = ADVISORS[ctx.adv], team = a ? a.team.replace(/\s*\(.*\)/, '') : '';
      const changes = /changed since/i.test(ctx.text), forID = /investment director|\bID\b/i.test(ctx.text);
      return [
        !ctx.adv && advisorQ('Who is the meeting with?'),
        { key: 'mtg', title: forID ? 'Which meeting is the investment director joining?' : 'Which meeting is this for?', options: c => { const t2 = ADVISORS[c.adv].team.replace(/\s*\(.*\)/, ''); return [
          { value: 'Wed Sep 30, 10:00 a.m. PT', label: `Tomorrow, 10:00 a.m. · Quarterly review`, desc: `${t2}, in person at their office`, rec: true },
          { value: 'Fri Oct 2, 2:00 p.m. PT', label: 'Friday, 2:00 p.m. · Model portfolio check-in', desc: 'Video call, 45 minutes' },
          { value: 'No meeting booked', label: 'Nothing booked yet', desc: 'Prepare me anyway' }]; } },
        { key: 'focus', title: 'What should I focus on?', multi: true, hint: 'Pick any', options: [
          { value: 'sales', label: 'Sales and redemptions', desc: 'Twelve months by vehicle, from the data platform', rec: true },
          { value: 'changes', label: 'What changed since the last meeting', desc: 'Transactions, engagement and cases', rec: changes || !forID },
          { value: 'platform', label: 'What’s available on their platform', desc: 'Dealer platform feed, by program' },
          { value: 'market', label: 'Market talking points', desc: 'This week’s approved themes in Seismic', rec: true }] },
        { key: 'out', title: 'What do you want back?', options: [
          { value: 'brief', label: 'One-page meeting brief', desc: 'Seismic template TPL-MB-04', rec: !changes },
          { value: 'agenda', label: 'Timed agenda', desc: 'Seismic template TPL-AG-02' },
          { value: 'points', label: 'Talking points card', desc: 'Seismic template TPL-TP-01', rec: changes }] }
      ].filter(Boolean);
    },
    steps: (ctx) => {
      const A = ctx.adv, f = ctx.ans.focus || [], S = [];
      S.push({ id: 'crm', wave: 1, sys: 'sf', title: 'Advisor snapshot', calls: [['crm.get_contact', { advisor_id: A }], ['crm.get_team', { advisor_id: A }], ['crm.get_call_notes', { advisor_id: A }], ['crm.get_opportunities', { advisor_id: A }]], render: cAdvisor, passes: d => ['advisor and firm', `${(d['crm.get_contact'].platform_programs || []).length} platform programs`, `last contact ${(d['crm.get_call_notes'][0] || {}).date || '—'}`, 'what they told us'] });
      if (f.includes('sales')) S.push({ id: 'book', wave: 1, sys: 'fund', title: 'Sales and redemptions', calls: [['book.get_assets', { advisor_id: A }], ['book.get_flows', { advisor_id: A }], ['book.get_fund_transactions', { advisor_id: A }]], render: cSales, passes: d => [`CG assets ${m$(d['book.get_assets'].total_usd_m)}`, `net flows ${m$(d['book.get_flows'].totals.net_flows.current_usd_m)}`, 'vehicle mix'] });
      if (f.includes('changes')) S.push({ id: 'chg', wave: 2, sys: 'changes', title: 'Since the last meeting', calls: [['insights.changes_since', { advisor_id: A }]], render: cChanges, passes: d => [`${(d['insights.changes_since'].highlights || []).length} highlights`, `${d['insights.changes_since'].days} days of activity`] });
      if (f.includes('platform')) S.push({ id: 'plat', wave: 2, sys: 'dealer', title: 'Platform availability', calls: [['platform.get_availability', { advisor_id: A }]], render: cPlatform, passes: d => [`${new Set(d['platform.get_availability'].items.map(i => i.ticker)).size} funds available`] });
      if (f.includes('market')) S.push({ id: 'mkt', wave: 2, sys: 'news', title: 'Market talking points', calls: [['content.get_themes', { advisor_id: A }], ['news.get_items', { advisor_id: A }]], also: { sys: 'seismic', calls: d => [['seismic.search_content', { query: d['content.get_themes'].themes.slice(0, 2).map(t => t.title).join(' ') }]] }, render: cThemes, passes: d => ['top 3 themes with Seismic sources'] });
      S.push({ id: 'tpl', wave: 3, sys: 'seismic', title: 'Compose from template', template: ctx.ans.out || 'brief', render: cBrief });
      return S;
    },
    finish: (ctx, d) => {
      const a = ADVISORS[ctx.adv], fl = d['book.get_flows'];
      const ve = n => fl && fl.gross_sales_by_vehicle.find(v => v.name === n), e = ve('ETF'), mf = ve('Mutual fund');
      const head = e && mf ? `Over twelve months, ETF sales ${e.change_usd_m >= 0 ? 'rose' : 'fell'} ${m$(Math.abs(e.change_usd_m))} and mutual fund sales ${mf.change_usd_m >= 0 ? 'rose' : 'fell'} ${m$(Math.abs(mf.change_usd_m))}.` : '';
      const what = ({ brief: 'meeting brief is', agenda: 'agenda is', points: 'talking points are' })[ctx.ans.out || 'brief'];
      return { text: `Your ${what} ready for ${a.name.replace(/,.*$/, '')}${ctx.ans.mtg && ctx.ans.mtg !== 'No meeting booked' ? ` (${ctx.ans.mtg})` : ''}. ${head} Nothing was booked or sent.`,
        actions: [{ label: 'Export PDF', kind: 'ok', done: 'Exported to PDF (simulated)' }, { label: 'Copy to Outlook', kind: 'ghost', done: 'Copied as an Outlook draft to you' }, { label: 'Schedule a follow-up', kind: 'ghost', ask: `Set up a follow-up meeting with ${a.short} next week` }] };
    }
  },

  market: {
    questions: (ctx) => {
      const li = /linkedin|post/i.test(ctx.text), terr = /\b(LA|OC|SD|territory|advisors)\b/.test(ctx.text) && !ctx.adv;
      return [
        !li && { key: 'aud', title: 'Who is this for?', options: [
          ...(ctx.adv ? [{ value: ctx.adv, label: ADVISORS[ctx.adv].name.replace(/,.*$/, ''), desc: `${FIRMS[ADVISORS[ctx.adv].firm].name}, personalized to what they told us`, rec: true }] : []),
          { value: 'LA', label: 'All my LA advisors', desc: `${TERRITORIES.LA.advisors.length} advisors, merge fields per advisor`, rec: !ctx.adv && terr },
          { value: 'internal', label: 'Internal team only', desc: 'For Sam and the desk; no client-facing rules', rec: !ctx.adv && !terr }] },
        { key: 'topics', title: 'Which themes should it cover?', multi: true, hint: 'From this week’s approved themes', options: [
          { value: 'TH-1', label: 'Mega-cap concentration in growth indexes', desc: 'Source SEIS-113', rec: true },
          { value: 'TH-2', label: 'Core bonds as rates settle', desc: 'Source SEIS-121' },
          { value: 'TH-3', label: 'ETFs inside model portfolios', desc: 'Source SEIS-117', rec: !!ctx.adv },
          { value: 'TH-4', label: 'Fee conversations clients understand', desc: 'Source AEM-FEES', rec: li }] },
        !li && { key: 'fmt', title: 'What format?', options: [
          { value: 'email', label: 'Advisor email', desc: 'Seismic template TPL-EM-07', rec: true },
          { value: 'points', label: 'Talking points', desc: 'Seismic template TPL-TP-01' }] }
      ].filter(Boolean);
    },
    steps: (ctx) => {
      const li = /linkedin|post/i.test(ctx.text); if (li) ctx.ans.fmt = 'linkedin';
      const A = ctx.ans.aud && ADVISORS[ctx.ans.aud] ? ctx.ans.aud : null, topics = ctx.ans.topics && ctx.ans.topics.length ? ctx.ans.topics : ['TH-1'];
      const words = topics.map(id => (THEMES.find(t => t[0] === id) || [])[2] || '').join(' ');
      return [
        { id: 'themes', wave: 1, sys: 'news', title: 'This week’s themes and news', calls: [['content.get_themes', { advisor_id: A || '' }], ['news.get_items', { topics: words }]], render: cThemes, passes: () => [`${topics.length} chosen theme${topics.length > 1 ? 's' : ''}`, 'related news'] },
        ...(A ? [{ id: 'crm', wave: 1, sys: 'sf', title: 'What the advisor told us', calls: [['crm.get_contact', { advisor_id: A }], ['crm.get_call_notes', { advisor_id: A }]], render: cNotes, passes: d => ['firm email policy', 'latest stated need'] }] : []),
        { id: 'seis', wave: 2, sys: 'seismic', title: 'Approved content in Seismic', calls: [['seismic.search_content', { query: words }], ['seismic.get_approved_language', { topic: words + (li ? ' fees' : '') }]], render: cSeismic, passes: d => [`${d['seismic.search_content'].length} approved pieces`, `${d['seismic.get_approved_language'].length} approved messages`] },
        { id: 'disc', wave: 2, sys: 'sp', title: 'Disclosures and channel rules', calls: [['sharepoint.get_disclosures', { content_type: li ? 'social' : 'email' }]], render: cDisclosures, passes: d => [`${d['sharepoint.get_disclosures'].required_disclosures.length} required disclosures`] },
        { id: 'tpl', wave: 3, sys: 'seismic', title: 'Compose from template', template: li ? 'linkedin' : ctx.ans.fmt === 'points' ? 'points' : 'email', render: cEmail },
        { id: 'qc', wave: 4, sys: 'sp', title: 'Compliance pre-check', render: cCompliance }
      ];
    },
    finish: (ctx) => ({ text: `The ${ctx.ans.fmt === 'linkedin' ? 'LinkedIn post' : ctx.ans.fmt === 'points' ? 'talking points' : 'email'} is drafted from approved Seismic content and passed the pre-check. It goes to compliance review before anything is sent.`,
      actions: [{ label: 'Send to compliance review', kind: 'ok', done: 'Sent to Grace Liu (Compliance review). You’ll be notified when it’s approved.' }, { label: 'Open as Outlook draft', kind: 'ghost', done: 'Saved as a draft in your Outlook. Not sent.' }] })
  },

  flows: {
    questions: (ctx) => [
      !ctx.adv && advisorQ('Whose sales should I look at?'),
      { key: 'period', title: 'Over what period?', options: [
        { value: '12m', label: 'Last 12 months vs the prior 12', desc: 'Sep 2025 to Aug 2026', rec: true },
        { value: 'since', label: 'Since our last meeting', desc: 'From the change history service' },
        { value: 'q3', label: 'July to September transactions', desc: 'Fund-level purchases and redemptions' }] },
      { key: 'cut', title: 'How should I break it down?', options: [
        { value: 'vehicle', label: 'Mutual funds vs ETFs', desc: 'Where most shifts show up', rec: true },
        { value: 'fund', label: 'By fund', desc: 'Largest purchases and redemptions' },
        { value: 'channel', label: 'By channel', desc: 'Models vs advisor-directed' }] }
    ].filter(Boolean),
    steps: (ctx) => { const A = ctx.adv; return [
      { id: 'book', wave: 1, sys: 'fund', title: 'Sales and redemptions', calls: [['book.get_assets', { advisor_id: A }], ['book.get_flows', { advisor_id: A }], ['book.get_fund_transactions', { advisor_id: A }]], render: cSales, passes: d => ['sales and redemptions by vehicle', 'largest transactions'] },
      ...(ctx.ans.period === 'since' ? [{ id: 'chg', wave: 1, sys: 'changes', title: 'Since the last meeting', calls: [['insights.changes_since', { advisor_id: A }]], render: cChanges, passes: () => ['recent transactions'] }] : []),
      { id: 'crm', wave: 1, sys: 'sf', title: 'What the advisor told us', calls: [['crm.get_contact', { advisor_id: A }], ['crm.get_call_notes', { advisor_id: A }]], render: cNotes, passes: () => ['stated plans in their own words'] },
      { id: 'why', wave: 2, sys: 'fund', title: 'Why it happened', render: cWhy }
    ]; },
    finish: (ctx) => ({ text: `That’s the explanation for ${ADVISORS[ctx.adv].short}, traced to the data platform and recorded calls. Want it as talking points for your next meeting?`,
      actions: [{ label: 'Turn into talking points', kind: 'ok', ask: `Prep me for my meeting with ${ADVISORS[ctx.adv].short}` }, { label: 'Share with Sam', kind: 'ghost', done: 'Shared with Sam Lee in Salesforce (internal note).' }] })
  },

  schedule: {
    questions: (ctx) => [
      !ctx.adv && advisorQ('Who is the meeting with?'),
      { key: 'len', title: 'How long?', options: [{ value: '30', label: '30 minutes', desc: 'Check-in', rec: true }, { value: '45', label: '45 minutes', desc: 'Review' }, { value: '60', label: '60 minutes', desc: 'Deep dive' }] },
      { key: 'who', title: 'Who else should join?', multi: true, hint: 'Optional', options: [
        { value: 'Sam Lee', label: 'Sam Lee', desc: 'Internal partner' }, { value: 'Dana Ortiz', label: 'Dana Ortiz', desc: 'Product Q&A' },
        { value: 'Ravi Menon', label: 'Ravi Menon', desc: 'Retirement plan specialist', rec: ctx.adv === 'ADV-102' }] },
      { key: 'topic', title: 'What’s it about?', options: [
        { value: 'follow', label: 'Follow up on our last conversation', desc: 'Uses the latest call notes', rec: true },
        { value: 'review', label: 'Quarterly review', desc: 'Book, flows and next steps' },
        { value: 'product', label: 'Product deep dive', desc: 'Bring Product Q&A' }] }
    ].filter(Boolean),
    steps: (ctx) => { const A = ctx.adv; return [
      { id: 'crm', wave: 1, sys: 'sf', title: 'Who books their calendar', calls: [['crm.get_contact', { advisor_id: A }], ['crm.get_team', { advisor_id: A }], ['crm.get_call_notes', { advisor_id: A }]], render: cWhoBooks, passes: () => ['scheduling contact', 'meeting rules'] },
      { id: 'cal', wave: 2, sys: 'm365', title: 'Find times that work', calls: [['calendar.find_times', { attendees: [ADVISORS[A].name.replace(/,.*$/, ''), meName(), ...(ctx.ans.who || [])], when: 'next week' }]], render: cSlots }
    ]; },
    finish: () => null
  },

  pitch: {
    questions: (ctx) => [
      { key: 'kind', title: 'Standard or custom?', options: [
        { value: 'custom', label: 'Custom for an advisor', desc: 'Their book, their platform, their questions', rec: !!ctx.adv || /custom/i.test(ctx.text) },
        { value: 'std', label: 'Standardized', desc: 'Approved template with the latest data', rec: !ctx.adv && !/custom/i.test(ctx.text) }] },
      { key: 'adv', title: 'Which advisor?', when: c => c.ans.kind === 'custom' && !c.adv, options: advisorQ().options },
      { key: 'focus', title: 'What should it feature?', multi: true, options: [
        { value: 'etf', label: 'Capital Group ETFs', desc: 'Filtered to what their platform offers', rec: true },
        { value: 'gfa', label: 'The Growth Fund of America', desc: 'Fund facts from the data platform' },
        { value: 'bonds', label: 'Core bonds (BFA)', desc: 'The Bond Fund of America' }] },
      { key: 'aud', title: 'Who will see it?', options: [
        { value: 'fp', label: 'Financial professionals', desc: 'Advisor-facing disclosures', rec: true },
        { value: 'inv', label: 'Their clients', desc: 'Investor-approved pages only' }] }
    ],
    steps: (ctx) => { const custom = ctx.ans.kind === 'custom', A = ctx.adv || ctx.ans.adv || null, S = [];
      if (custom && A) S.push({ id: 'crm', wave: 1, sys: 'sf', title: 'Advisor snapshot', calls: [['crm.get_contact', { advisor_id: A }], ['crm.get_team', { advisor_id: A }], ['crm.get_call_notes', { advisor_id: A }], ['crm.get_opportunities', { advisor_id: A }]], render: cAdvisor, passes: () => ['firm and programs', 'what they asked for'] });
      if (custom && A) S.push({ id: 'book', wave: 1, sys: 'fund', title: 'Their book today', calls: [['book.get_assets', { advisor_id: A }], ['book.get_flows', { advisor_id: A }]], render: cSales, passes: () => ['current holdings'] });
      S.push({ id: 'plat', wave: 2, sys: 'dealer', title: 'Lineup on their platform', calls: [['platform.get_availability', { advisor_id: A || 'ADV-105' }]], render: cPlatform, passes: d => [`${new Set(d['platform.get_availability'].items.map(i => i.ticker)).size} funds available`] });
      S.push({ id: 'facts', wave: 2, sys: 'fund', title: 'Verified fund facts', calls: [['fund.get_facts', { ticker: 'GFFFX' }], ['fund.get_facts', { ticker: 'ABNFX' }]], render: cFacts, passes: () => ['expense ratios with as-of dates'] });
      S.push({ id: 'disc', wave: 2, sys: 'sp', title: 'Disclosures', calls: [['sharepoint.get_disclosures', { content_type: 'presentation' }]], render: cDisclosures, passes: () => ['presentation disclosures'] });
      S.push({ id: 'tpl', wave: 3, sys: 'seismic', title: 'Build from template', template: custom ? 'pbCustom' : 'pbStd', calls: [['seismic.search_content', { query: 'etf core satellite active lineup' }]], render: cPitch });
      ctx.adv = A; return S; },
    finish: (ctx) => ({ text: `The ${ctx.ans.kind === 'custom' ? 'custom' : 'standard'} pitch book is assembled from template ${ctx.ans.kind === 'custom' ? 'TPL-PB-20' : 'TPL-PB-11'} with verified data. It needs compliance review before it’s shared.`,
      actions: [{ label: 'Send to compliance review', kind: 'ok', done: 'Sent to Compliance review with the source list attached.' }, { label: 'Download draft PDF', kind: 'ghost', done: 'Draft PDF downloaded (watermarked “Not for distribution”).' }] })
  },

  platform: {
    questions: (ctx) => [
      !ctx.adv && advisorQ('For which advisor’s platform?'),
      { key: 'scope', title: 'What should I check?', options: [
        { value: 'etf', label: 'Capital Group ETFs only', desc: 'Matches your question', rec: /etf/i.test(ctx.text) },
        { value: 'all', label: 'All Capital Group funds', desc: 'ETFs and mutual funds', rec: !/etf/i.test(ctx.text) }] }
    ].filter(Boolean),
    steps: (ctx) => { const A = ctx.adv; return [
      { id: 'crm', wave: 1, sys: 'sf', title: 'Advisor programs', calls: [['crm.get_contact', { advisor_id: A }]], render: cPrograms, passes: d => [`${(d['crm.get_contact'].platform_programs || []).length} programs to check`] },
      { id: 'plat', wave: 2, sys: 'dealer', title: 'Platform availability', calls: [['platform.get_availability', { advisor_id: A }]], render: cPlatform, passes: () => ['availability by program'] },
      { id: 'book', wave: 2, sys: 'fund', title: 'What they already hold', calls: [['book.get_assets', { advisor_id: A }]], render: cHeld }
    ]; },
    finish: (ctx) => ({ text: `Checked against the dealer platform feed as of its latest date. Availability isn’t a suitability conclusion for any client.`, actions: [{ label: 'Add to my meeting brief', kind: 'ok', ask: `Prep me for my meeting with ${ADVISORS[ctx.adv].short}` }] })
  }
};

/* ---------- state ---------- */
const S = { busy: false, rail: { sys: {}, hand: [], tpl: [] }, pending: null };
function resetRail() { S.rail = { sys: {}, hand: [], tpl: [] }; renderRail(); }

/* ---------- thread helpers ---------- */
const thread = () => $('thread');
let stick = true;
function add(html, cls = '') { const el = document.createElement('div'); el.className = 'turn ' + cls; el.innerHTML = html; thread().appendChild(el); scrollDown(); return el; }
function scrollDown() { if (stick) requestAnimationFrame(() => { const w = document.querySelector('.thread-wrap'); w.scrollTop = w.scrollHeight; }); }
const sysChip = (k, extra = '') => `<span class="sys" style="--c:${SYS[k].color}"><i>${SYS[k].abbr}</i>${h(SYS[k].name)}${extra}</span>`;

/* ---------- welcome ---------- */
function welcome() {
  thread().innerHTML = '';
  const E = EMPLOYEES[ME];
  add(`<div class="hello"><h1>Good morning, ${h(first(E.name))}.</h1><p>Ask for what you need. I’ll ask a quick question or two, then show you every system I connect to and what I bring back.</p>
    <div class="sugs">${PERSONAS[ME].map(s => `<button class="sug" type="button" data-ask="${h(s)}">${h(s)}</button>`).join('')}</div>
    <div class="conn">${Object.keys(SYS).filter(k => k !== 'changes').map(k => sysChip(k)).join('')}</div></div>`, 'welcome');
  resetRail();
}

/* ---------- run a request ---------- */
async function ask(text) {
  text = text.trim(); if (!text || S.busy) return;
  S.busy = true; setBusy(true);
  document.querySelector('.turn.welcome .sugs')?.remove();
  add(`<div class="bubble">${h(text)}</div>`, 'user');
  const kind = classify(text), ctx = { text, kind, adv: findAdvisor(text), ans: {} };
  /* understanding */
  const u = add(`<div class="arow"><span class="ava">✦</span><div class="abody"><div class="think"><span class="dots"><i></i><i></i><i></i></span> Understanding your request…</div></div></div>`, 'asst');
  await wait(900);
  if (!kind) {
    u.querySelector('.abody').innerHTML = `<p>I can help with that in a few ways. Which is closest?</p><div class="sugs">${[['prep', 'Prepare me for a meeting'], ['flows', 'Explain an advisor’s sales'], ['market', 'Draft a market update'], ['schedule', 'Set up a meeting'], ['pitch', 'Build a pitch book'], ['platform', 'Check platform availability']].map(([k, l]) => `<button class="sug" type="button" data-ask="${h(l + (ctx.adv ? ' with ' + ADVISORS[ctx.adv].short : ''))}">${h(l)}</button>`).join('')}</div>`;
    S.busy = false; setBusy(false); return;
  }
  const a = ADVISORS[ctx.adv];
  u.querySelector('.abody').innerHTML = `<div class="understood"><span class="lbl">Understood</span>
    <span class="tag">${h(INTENT_NAME[kind])}</span>${a ? `<span class="tag ghost">${h(a.name.replace(/,.*$/, ''))} · ${h(FIRMS[a.firm].name)}</span>` : '<span class="tag warn">Advisor not named</span>'}
    <span class="tag lock">🔒 ${h(AUTH[kind])}</span></div>`;
  $('modeTag').textContent = AUTH[kind];
  /* clarify */
  const pb = PLAYBOOKS[kind];
  const qs = pb.questions(ctx);
  if (qs.length) await clarify(ctx, qs);
  if (!ctx.adv && ctx.ans.adv) ctx.adv = ctx.ans.adv;
  /* plan + run */
  const steps = pb.steps(ctx);
  await runPlan(ctx, steps, pb);
  S.busy = false; setBusy(false);
}

/* ---------- clarifying questions (one card, one question at a time) ---------- */
function clarify(ctx, qs) {
  return new Promise(resolve => {
    const card = add(`<div class="arow"><span class="ava">✦</span><div class="abody"><div class="qcard" tabindex="-1"></div></div></div>`, 'asst');
    const box = card.querySelector('.qcard'); let i = 0;
    const answered = [];
    const next = () => {
      while (i < qs.length && qs[i].when && !qs[i].when(ctx)) i++;
      if (i >= qs.length) { S.pending = null; box.classList.add('done'); box.innerHTML = `<div class="qsum"><span class="lbl">Got it</span>${answered.map(x => `<span class="ans"><small>${h(x[0])}</small>${h(x[1])}</span>`).join('')}</div>`; scrollDown(); return resolve(); }
      const q = qs[i], opts = typeof q.options === 'function' ? q.options(ctx) : q.options, total = qs.filter(x => !x.when || x.when(ctx)).length;
      const sel = new Set(q.multi ? opts.filter(o => o.rec).map(o => o.value) : []);
      box.innerHTML = `<div class="qhead"><span class="qn">Question ${answered.length + 1} of ${total}</span>${q.hint ? `<span class="qhint">${h(q.hint)}</span>` : ''}</div><div class="qt">${h(q.title)}</div>
        <div class="opts">${opts.map((o, k) => `<button type="button" class="opt${q.multi && sel.has(o.value) ? ' on' : ''}" data-v="${h(o.value)}"><span class="key">${k + 1}</span><span class="ol"><b>${h(o.label)}${o.rec ? ' <em>Recommended</em>' : ''}</b><small>${h(o.desc || '')}</small></span>${q.multi ? '<span class="box"></span>' : '<span class="go">→</span>'}</button>`).join('')}
        <div class="other"><input type="text" placeholder="Or type your own answer…" aria-label="Other answer"><button type="button" class="ghost sm">${q.multi ? 'Add' : 'Use'}</button></div></div>
        ${q.multi ? `<div class="qfoot"><button type="button" class="primary sm" data-confirm>Continue</button><span>${sel.size} selected</span></div>` : ''}`;
      box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
      const choose = vals => { const labels = vals.map(v => (opts.find(o => o.value === v) || { label: v }).label); ctx.ans[q.key] = q.multi ? vals : vals[0]; if (q.key === 'adv' && ADVISORS[vals[0]]) ctx.adv = vals[0]; answered.push([q.title.replace(/\?$/, ''), labels.join(', ') || 'None']); i++; next(); };
      S.pending = k => { const o = opts[k]; if (!o) return; if (q.multi) toggle(o.value); else choose([o.value]); };
      const toggle = v => { sel.has(v) ? sel.delete(v) : sel.add(v); box.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', sel.has(b.dataset.v))); box.querySelector('.qfoot span').textContent = `${sel.size} selected`; };
      box.querySelectorAll('.opt').forEach(b => b.onclick = () => q.multi ? toggle(b.dataset.v) : choose([b.dataset.v]));
      const inp = box.querySelector('.other input'), use = () => { const v = inp.value.trim(); if (!v) return; if (q.multi) { opts.push({ value: v, label: v }); sel.add(v); choose([...sel]); } else choose([v]); };
      box.querySelector('.other button').onclick = use; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); use(); } };
      if (q.multi) box.querySelector('[data-confirm]').onclick = () => choose([...sel]);
      scrollDown();
    };
    next();
  });
}

/* ---------- plan and execution ---------- */
async function runPlan(ctx, steps, pb) {
  const run = { ctx, data: {}, steps, t0: performance.now(), calls: 0 };
  const waves = [...new Set(steps.map(s => s.wave))].sort((x, y) => x - y);
  const plan = add(`<div class="arow"><span class="ava">✦</span><div class="abody"><div class="plan"><div class="ph"><span class="lbl">Plan</span><span>${steps.length} steps · ${waves.length} wave${waves.length > 1 ? 's' : ''} · ${[...new Set(steps.flatMap(s => [s.sys, s.also && s.also.sys]).filter(Boolean))].length} systems</span></div>
    <ol>${steps.map(s => `<li id="pl-${s.id}" class="todo"><span class="ck"></span>${sysChip(s.sys)}<span class="pt">${h(s.title)}</span>${s.template ? `<span class="tplchip">${h(TEMPLATES[s.template].id)}</span>` : ''}<span class="pw">W${s.wave}</span></li>`).join('')}</ol></div></div></div>`, 'asst');
  await wait(500);
  for (const w of waves) {
    const ws = steps.filter(s => s.wave === w);
    if (ws.length > 1) add(`<div class="wavebar"><span>Wave ${w}</span>${ws.length} steps run together</div>`, 'meta');
    await Promise.all(ws.map(s => runStep(run, s)));
  }
  const fin = pb.finish(ctx, run.data);
  if (fin) finale(run, fin);
}

async function runStep(run, s) {
  const li = $('pl-' + s.id); li.className = 'doing';
  const sysList = [s.sys, s.also && s.also.sys].filter(Boolean);
  const el = add(`<div class="step" style="--c:${SYS[s.sys].color}">
    <div class="sh">${sysList.map(k => sysChip(k)).join('<span class="plus">+</span>')}<b>${h(s.title)}</b><span class="st live"><span class="spin"></span>Working</span></div>
    <div class="log"></div><div class="comp"></div><div class="hand"></div></div>`, 'stepturn');
  const log = el.querySelector('.log'), line = (html, cls = '') => { const d = document.createElement('div'); d.className = 'll ' + cls; d.innerHTML = html; log.appendChild(d); scrollDown(); return d; };
  const t0 = performance.now(); let n = 0;
  const callSet = async (sys, calls) => {
    railSys(sys, 'connecting');
    const c = line(`<span class="spin"></span>Connecting to <b>${h(SYS[sys].name)}</b> via ${h(SYS[sys].via)}…`); await wait(520);
    c.innerHTML = `<span class="okd">✓</span>Connected to <b>${h(SYS[sys].name)}</b> · ${SYS[sys].via === 'Foundation' ? 'shared foundation' : 'read-only'} · as ${h(meName())}`;
    railSys(sys, 'reading');
    for (const [tool, args] of calls) {
      const shown = Object.entries(args).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length + ' names' : String(v).length > 34 ? String(v).slice(0, 32) + '…' : v}`).join(', ');
      const r = line(`<span class="spin"></span>Fetching ${h(TOOL_LABEL[tool] || tool)} <code>${h(tool)}(${h(shown)})</code>`);
      await wait(420 + Math.random() * 380);
      const tt = performance.now(); let out;
      try { out = TOOLS[tool].run(args, {}); } catch (e) { out = { error: e.message }; }
      run.data[tool === 'fund.get_facts' ? tool + ':' + args.ticker : tool] = out;
      n++; run.calls++; railSys(sys, 'reading', 1);
      r.innerHTML = `<span class="okd">✓</span>${h(TOOL_LABEL[tool] || tool)} <code>${h(tool)}</code> <span class="recv">${h(summarize(out))} · ${Math.round(80 + (performance.now() - tt) + Math.random() * 160)} ms</span>`;
    }
    railSys(sys, 'done');
  };
  if (s.calls) await callSet(s.sys, s.calls);
  if (s.also) await callSet(s.also.sys, s.also.calls(run.data));
  if (s.template) await useTemplate(run, s, line);
  /* the component */
  const comp = el.querySelector('.comp');
  comp.innerHTML = s.render(run.data, run.ctx, run) || ''; comp.classList.add('in');
  wireComp(comp, run);
  const st = el.querySelector('.st'); st.className = 'st ok'; st.innerHTML = `✓ ${n ? `${n} call${n > 1 ? 's' : ''} · ` : ''}${((performance.now() - t0) / 1000 / (SPEED < 1 ? SPEED * 25 : 1)).toFixed(1)} s`;
  if (n) { log.classList.add('fold'); const t = document.createElement('button'); t.type = 'button'; t.className = 'logtoggle'; t.textContent = `Show ${n} system call${n > 1 ? 's' : ''}`; t.onclick = () => { log.classList.toggle('fold'); t.textContent = log.classList.contains('fold') ? `Show ${n} system call${n > 1 ? 's' : ''}` : 'Hide system calls'; }; log.before(t); }
  if (s.passes) { const p = s.passes(run.data); const to = run.steps.filter(x => x.wave > s.wave); const tgt = to.length ? to.filter(x => x.wave === Math.min(...to.map(y => y.wave))).map(x => x.title) : ['your answer'];
    el.querySelector('.hand').innerHTML = `<span class="harrow">↳</span><span>Passed to <b>${h(tgt.join(' and '))}</b>:</span>${p.map(x => `<span class="pill">${h(x)}</span>`).join('')}`;
    S.rail.hand.push({ from: s.title, sys: s.sys, to: tgt.join(', '), what: p }); renderRail(); }
  li.className = 'done'; scrollDown();
  await wait(650);
}

async function useTemplate(run, s, line) {
  const T = TEMPLATES[s.template];
  railSys('seismic', 'connecting');
  const c = line(`<span class="spin"></span>Opening template library in <b>Seismic</b>…`); await wait(500);
  c.innerHTML = `<span class="okd">✓</span>Template <b>${h(T.id)}</b> · ${h(T.name)} <span class="recv">${h(T.ver)}</span>`;
  railSys('seismic', 'reading', 1); S.rail.tpl.push(T); renderRail();
  if (s.calls) { /* handled by callSet */ }
  const tp = line(`<div class="tpl"><div class="tplh"><span class="tplic">▤</span><b>${h(T.name)}</b><small>${h(T.id)} · ${h(T.ver)}</small></div><div class="slots">${T.slots.map((x, k) => `<span class="slot" data-k="${k}">${h(x)}</span>`).join('')}</div></div>`, 'tplline');
  const srcSys = [...new Set(run.steps.filter(x => x !== s && x.calls).map(x => x.sys))];
  for (const sl of tp.querySelectorAll('.slot')) { await wait(260); const k = srcSys[+sl.dataset.k % Math.max(1, srcSys.length)] || 'seismic'; sl.classList.add('fill'); sl.style.setProperty('--c', SYS[k].color); sl.title = 'Filled from ' + SYS[k].name; }
  railSys('seismic', 'done');
  await wait(300);
}

function summarize(o) {
  if (o && o.error) return 'error: ' + o.error;
  if (Array.isArray(o)) return `${o.length} record${o.length === 1 ? '' : 's'}`;
  const arr = o && Object.entries(o).find(([, v]) => Array.isArray(v) && v.length);
  if (arr) return `${arr[1].length} ${arr[0].replace(/_/g, ' ')}`;
  return `${Object.keys(o || {}).length} fields`;
}

function finale(run, fin) {
  const secs = ((performance.now() - run.t0) / 1000 / (SPEED < 1 ? SPEED * 25 : 1)).toFixed(0);
  const used = [...new Set(run.steps.flatMap(s => [s.calls && s.sys, s.also && s.also.sys, s.template && 'seismic']).filter(Boolean))];
  const el = add(`<div class="arow"><span class="ava">✦</span><div class="abody"><div class="final"><p>${h(fin.text)}</p>
    <div class="acts">${fin.actions.map((a, k) => `<button type="button" class="${a.kind === 'ok' ? 'primary' : 'ghost'}" data-k="${k}">${h(a.label)}</button>`).join('')}</div>
    <div class="srcs"><span>${run.calls} system calls · ${used.length} systems · ${secs} s</span>${used.map(k => sysChip(k)).join('')}</div></div></div></div>`, 'asst');
  el.querySelectorAll('.acts button').forEach(b => b.onclick = () => { const a = fin.actions[+b.dataset.k]; if (a.ask) { $('ask').value = a.ask; ask(a.ask); $('ask').value = ''; return; } b.disabled = true; b.textContent = '✓ ' + a.label; add(`<div class="note">✓ ${h(a.done)}</div>`, 'meta'); });
}

/* ---------- components ---------- */
const card = (title, sub, body, cls = '') => `<div class="cc ${cls}"><div class="cch"><b>${h(title)}</b>${sub ? `<small>${sub}</small>` : ''}</div>${body}</div>`;
const src = (...ids) => `<span class="srcid">${ids.map(h).join(' · ')}</span>`;

function cAdvisor(d) {
  const c = d['crm.get_contact'], tm = d['crm.get_team'] || {}, notes = d['crm.get_call_notes'] || [], opp = (d['crm.get_opportunities'] || [])[0], n0 = notes[0];
  return card('Advisor snapshot', `Salesforce ${src('CRM')}`, `<div class="snap"><div class="savatar">${h(initials(c.name))}</div><div class="sinfo"><b>${h(c.name)}</b><span>${h(c.title)}</span><span>${h(c.firm)} · ${h(c.office)}</span></div></div>
    <div class="kv">
      <div><small>Team</small><span>${h(c.team)}</span></div>
      <div><small>Programs</small><span>${(c.platform_programs || []).map(p => `<em class="chip">${h(p)}</em>`).join(' ') || '—'}</span></div>
      <div><small>Coverage</small><span>${h((c.coverage || []).join(', '))}</span></div>
      <div><small>Last contact</small><span>${n0 ? `${h(n0.date)} · ${h(n0.kind)} ${src(n0.id)}` : '—'}</span></div>
      ${opp ? `<div><small>Open opportunity</small><span>${h(opp.name)} · <em class="chip">${h(opp.stage)}</em> ${src(opp.id)}</span></div>` : ''}
    </div>
    ${(tm.advisor_team || []).length ? `<div class="people">${tm.advisor_team.slice(0, 4).map(p => `<span class="person"><i>${h(initials(p.name))}</i><span><b>${h(p.name.replace(/,.*$/, ''))}</b><small>${h(p.role.split(';')[0])}</small></span></span>`).join('')}</div>` : ''}
    ${n0 ? `<blockquote>${h(n0.text.length > 220 ? n0.text.slice(0, 218) + '…' : n0.text)} ${src(n0.id)}</blockquote>` : ''}`, 'snapcard');
}

function bars(rows, max) { return rows.map(r => `<div class="brow"><span class="bl">${h(r.label)}</span><span class="bt"><i class="prior" style="width:${(r.prior / max * 100).toFixed(1)}%"></i><i class="cur" style="width:${(r.cur / max * 100).toFixed(1)}%;--c:${r.color}"></i></span><span class="bv">${m$(r.cur)} <small class="${r.cur >= r.prior ? 'up' : 'dn'}">${r.cur >= r.prior ? '▲' : '▼'} ${m$(Math.abs(r.cur - r.prior))}</small></span></div>`).join(''); }
function cSales(d) {
  const as = d['book.get_assets'], fl = d['book.get_flows'], tx = (d['book.get_fund_transactions'] || {}).transactions || [];
  if (!fl || !as) return '';
  const T = fl.totals, gs = fl.gross_sales_by_vehicle, rd = fl.redemptions_by_vehicle;
  const max = Math.max(...gs.concat(rd).flatMap(v => [v.current_usd_m, v.prior_usd_m]), 0.1);
  const vcol = { 'Mutual fund': '#2f6fd6', ETF: '#11a37f' };
  const etf = as.by_vehicle.find(v => v.vehicle === 'ETF') || {};
  return card('Sales and redemptions', `Data platform · ${h(fl.current_period)} vs prior ${src('Flows', 'Assets')}`, `
    <div class="kpis">
      <div class="kpi"><small>CG assets</small><b>${m$(as.total_usd_m)}</b><span class="${as.total_usd_m >= as.prior_total_usd_m ? 'up' : 'dn'}">${as.total_usd_m >= as.prior_total_usd_m ? '▲' : '▼'} ${m$(Math.abs(as.total_usd_m - as.prior_total_usd_m))} vs ${h(as.prior_as_of)}</span></div>
      <div class="kpi"><small>Gross sales</small><b>${m$(T.gross_sales.current_usd_m)}</b><span class="${T.gross_sales.change_usd_m >= 0 ? 'up' : 'dn'}">${T.gross_sales.change_usd_m >= 0 ? '▲' : '▼'} ${pct(Math.abs(T.gross_sales.change_pct))}</span></div>
      <div class="kpi"><small>Redemptions</small><b>${m$(T.redemptions.current_usd_m)}</b><span class="${T.redemptions.change_usd_m <= 0 ? 'up' : 'dn'}">${T.redemptions.change_usd_m >= 0 ? '▲' : '▼'} ${pct(Math.abs(T.redemptions.change_pct))}</span></div>
      <div class="kpi"><small>Net flows</small><b>${m$(T.net_flows.current_usd_m)}</b><span class="muted">prior ${m$(T.net_flows.prior_usd_m)}</span></div>
    </div>
    <div class="twocol">
      <div><div class="sublbl">Gross sales by vehicle <span class="legend"><i class="lp"></i>prior <i class="lc"></i>current</span></div>${bars(gs.map(v => ({ label: v.name, cur: v.current_usd_m, prior: v.prior_usd_m, color: vcol[v.name] })), max)}
        <div class="sublbl">Redemptions by vehicle</div>${bars(rd.map(v => ({ label: v.name, cur: v.current_usd_m, prior: v.prior_usd_m, color: '#d9534f' })), max)}</div>
      <div><div class="sublbl">Vehicle mix of assets</div>
        <div class="mix"><span>Now</span><span class="mixbar"><i style="width:${100 - (etf.share_pct || 0)}%;background:#2f6fd6"></i><i style="width:${etf.share_pct || 0}%;background:#11a37f"></i></span><span>${pct(etf.share_pct)} ETF</span></div>
        <div class="mix"><span>Year ago</span><span class="mixbar"><i style="width:${100 - (etf.prior_share_pct || 0)}%;background:#2f6fd6"></i><i style="width:${etf.prior_share_pct || 0}%;background:#11a37f"></i></span><span>${pct(etf.prior_share_pct)} ETF</span></div>
        <div class="sublbl">Largest holdings</div><table class="mini">${as.by_fund.slice().sort((x, y) => y.assets_usd_m - x.assets_usd_m).slice(0, 4).map(f => `<tr><td><b>${h(f.fund)}</b> <small>${h(f.vehicle)}</small></td><td class="r">${m$(f.assets_usd_m)}</td></tr>`).join('')}</table>
        ${tx.length ? `<div class="sublbl">Recent transactions</div><table class="mini">${tx.slice(0, 3).map(t => `<tr><td>${h(t.date)}</td><td><b>${h(t.fund)}</b></td><td class="${t.type === 'Redemption' ? 'dn' : 'up'}">${h(t.type)}</td><td class="r">${m$(t.amount_usd_m)}</td></tr>`).join('')}</table>` : ''}
      </div></div>`, 'salescard');
}

function cChanges(d) {
  const c = d['insights.changes_since']; if (!c) return '';
  return card('Since the last meeting', `${h(c.period)} · ${c.days} days ${src(c.last_meeting ? c.last_meeting.id : '')}`, `
    <ul class="hl">${(c.highlights || []).map(x => `<li>${h(x)}</li>`).join('')}</ul>
    <div class="tl">${(c.transactions || []).slice(0, 6).map(t => `<div class="tli ${t.type === 'Redemption' ? 'dn' : 'up'}"><span class="td">${h(t.date.replace(', 2026', ''))}</span><span class="dot"></span><span><b>${h(t.fund)}</b> ${h(t.type.toLowerCase())} ${m$(t.amount_usd_m)}</span></div>`).join('')}
    ${(c.digital_engagement || []).slice(0, 2).map(e => `<div class="tli dig"><span class="td">${h(e.date.replace(', 2026', ''))}</span><span class="dot"></span><span>${h(e.kind)}: ${h(e.item)}</span></div>`).join('')}</div>
    <p class="fine">${h(c.source || '')}</p>`);
}

function cPlatform(d) {
  const p = d['platform.get_availability']; if (!p) return '';
  const progs = [...new Set(p.items.map(i => i.program))], tick = [...new Set(p.items.map(i => i.ticker))];
  return card('Platform availability', `${h(p.firm)} · ${h(p.source)} · as of ${h(p.as_of)}`, `<table class="grid"><thead><tr><th>Fund</th>${progs.map(x => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${tick.map(t => { const nm = p.items.find(i => i.ticker === t).name; return `<tr><td><b>${h(t)}</b><small>${h(nm.replace('Capital Group ', ''))}</small></td>${progs.map(pr => { const it = p.items.find(i => i.ticker === t && i.program === pr); return `<td>${it ? `<span class="av ok">✓</span><small>${h(it.effective)}</small>` : '<span class="av no">—</span>'}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table><p class="fine">${h(p.note)}</p>`);
}

function cThemes(d) {
  const th = d['content.get_themes'], nw = d['news.get_items'], hits = d['seismic.search_content'] || [];
  return card('This week’s themes', `Insights feed · week of ${h(th.week_of)}${hits.length ? ' · matched in Seismic' : ''}`, `<div class="themes">${th.themes.slice(0, 3).map((t, k) => `<div class="theme"><span class="rank">${k + 1}</span><div><b>${h(t.title)}</b><small>${h(t.why)}</small></div>${src(t.source)}</div>`).join('')}</div>
    ${nw && nw.items.length ? `<div class="sublbl">In the news</div><div class="news">${nw.items.slice(0, 3).map(n => `<div class="ni"><small>${h(n.date)} · ${h(n.source)}</small><span>${h(n.title)}</span></div>`).join('')}</div>` : ''}
    ${hits.length ? `<div class="sublbl">Approved pieces to bring</div><div class="docs">${hits.slice(0, 3).map(docCard).join('')}</div>` : ''}`);
}
const docCard = x => `<div class="doc"><div class="dthumb"><i></i><i></i><i></i></div><div><b>${h(x.title)}</b><small>${h(x.id)} · ${h(x.format)} · ${h(x.audience)}</small><em class="chip ok">${h(x.status)}</em></div></div>`;

function cNotes(d) {
  const c = d['crm.get_contact'], n = d['crm.get_call_notes'] || [];
  const firm = Object.values(FIRMS).find(f => f.name === c.firm);
  return card('What the advisor told us', `Salesforce · ${n.length} recorded conversations`, `${n.slice(0, 2).map(x => `<blockquote>${h(x.text.length > 260 ? x.text.slice(0, 258) + '…' : x.text)}<cite>${h(x.date)} · ${h(x.kind)} ${src(x.id)}</cite></blockquote>`).join('')}
    ${firm && firm.policy ? `<div class="flag">⚑ ${h(c.firm)}: ${h(firm.policy)}</div>` : ''}`);
}

function cSeismic(d) {
  const docs = d['seismic.search_content'] || [], msg = d['seismic.get_approved_language'] || [];
  return card('Approved content in Seismic', `${docs.length} pieces · ${msg.length} approved messages`, `<div class="docs">${docs.slice(0, 4).map(docCard).join('')}</div>
    <div class="sublbl">Approved messaging</div>${msg.slice(0, 2).map(m => `<div class="msg">“${h(m.text)}” ${src(m.id)}</div>`).join('')}`);
}

function cDisclosures(d) {
  const x = d['sharepoint.get_disclosures']; if (!x) return '';
  return card('Disclosures and channel rules', `SharePoint · ${h(x.channel || 'policy library')}`, `<ul class="checks">${x.required_disclosures.map(t => `<li>${h(t)}</li>`).join('')}</ul>${(x.channel_rules || []).length ? `<div class="sublbl">Channel rules</div><ul class="hl">${x.channel_rules.map(t => `<li>${h(t)}</li>`).join('')}</ul>` : ''}`);
}

function cBrief(d, ctx) {
  const a = ADVISORS[ctx.adv], c = d['crm.get_contact'], tm = d['crm.get_team'] || {}, notes = d['crm.get_call_notes'] || [], as = d['book.get_assets'], fl = d['book.get_flows'], ch = d['insights.changes_since'], th = d['content.get_themes'], pl = d['platform.get_availability'], hits = d['seismic.search_content'] || [];
  const out = ctx.ans.out || 'brief', T = TEMPLATES[out], f = ctx.ans.focus || [];
  const etf = as ? as.by_vehicle.find(v => v.vehicle === 'ETF') : null;
  const glance = as && fl ? `CG assets ${m$(as.total_usd_m)} as of ${as.as_of}${etf ? `, ${pct(etf.share_pct)} in ETFs (from ${pct(etf.prior_share_pct)} a year ago)` : ''}. Twelve-month gross sales ${m$(fl.totals.gross_sales.current_usd_m)}, redemptions ${m$(fl.totals.redemptions.current_usd_m)}, net ${m$(fl.totals.net_flows.current_usd_m)}.` : '';
  const told = notes.slice(0, 2).map(n => `${n.text.split(/(?<=[.!?])\s/)[0]} (${n.id})`);
  const themes = th ? th.themes.slice(0, 2).map(t => `${t.title} (${t.source})`) : [];
  const avail = pl ? new Set(pl.items.map(i => i.ticker)).size : 0;
  const agenda = [['5', 'Check-in and what’s changed for them'], ...(f.includes('sales') ? [['10', 'Their book: vehicle mix and flows']] : []), ...(f.includes('changes') ? [['5', 'Since we last met']] : []), ...(themes.length ? [['15', `Theme: ${th.themes[0].title}`]] : []), ...(f.includes('platform') ? [['5', `What’s available on ${FIRMS[a.firm].name.replace(/ (Wealth Management|Advisors)$/, '')}`]] : []), ['5', 'Agree next steps']];
  let t0 = 0; const timed = agenda.map(([m, x]) => { const s = `0:${String(t0).padStart(2, '0')}`; t0 += +m; return [s, m, x]; });
  const sec = (title, body) => body ? `<section><h4>${h(title)}</h4>${body}</section>` : '';
  const people = (tm.advisor_team || []).slice(0, 4).map(p => `${p.name.replace(/,.*$/, '')}, ${p.role.split(';')[0].toLowerCase()}`);
  let body;
  if (out === 'agenda') body = sec('Attendees', `<p>${h(people.join(' · '))} · ${h(meName())}</p>`) + sec('Objectives', `<ul>${told.slice(0, 1).map(x => `<li>Respond to: ${h(x)}</li>`).join('')}<li>Leave with an agreed next step</li></ul>`) + sec('Timed agenda', `<table class="agenda">${timed.map(r => `<tr><td>${r[0]}</td><td>${r[1]} min</td><td>${h(r[2])}</td></tr>`).join('')}</table>`) + sec('Materials', hits.length ? `<ul>${hits.slice(0, 2).map(x => `<li>${h(x.title)} (${h(x.id)})</li>`).join('')}</ul>` : '<p>No approved pieces selected.</p>') + sec('Next steps', '<p>Send approved material after the meeting (needs your approval).</p>');
  else if (out === 'points') body = sec('Open with', `<p>${h(told[0] ? 'Last time you told us: ' + told[0] : 'How the year is going for the team.')}</p>`) + sec('Their numbers', glance ? `<p>${h(glance)}</p>` : '') + sec('Since we last met', ch ? `<ul>${ch.highlights.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : '') + sec('Themes to raise', themes.length ? `<ul>${themes.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : '') + sec('Ask', '<p>What would make the next quarter a success for your clients?</p>');
  else body = sec('Who’s in the room', `<p>${h(people.join(' · ') || c.team)}</p>`) + sec('Relationship at a glance', glance ? `<p>${h(glance)}</p>` : '') + sec('What they told us', told.length ? `<ul>${told.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : '') + sec('Since the last meeting', ch ? `<ul>${ch.highlights.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : '') + sec('Talking points', themes.length ? `<ul>${themes.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : '') + (avail ? sec('Platform', `<p>${avail} Capital Group funds available on their programs (dealer feed).</p>`) : '') + sec('Suggested agenda', `<table class="agenda">${timed.map(r => `<tr><td>${r[0]}</td><td>${h(r[2])}</td></tr>`).join('')}</table>`) + sec('Next steps', '<p>Send approved material after the meeting. Nothing is booked or sent without your approval.</p>');
  return `<div class="docprev"><div class="dochead"><span class="tplbadge">${h(T.id)}</span><div><b>${h(({ brief: 'Meeting brief', agenda: 'Agenda', points: 'Talking points' })[out])} · ${h(a.name.replace(/,.*$/, ''))}, ${h(c.team)}</b><small>${h(ctx.ans.mtg || 'Upcoming meeting')} · prepared for ${h(meName())}</small></div></div><div class="docbody">${body}</div><div class="docfoot">Every number traces to the data platform or Salesforce · For internal use</div></div>`;
}

function cEmail(d, ctx) {
  const A = ctx.ans.aud && ADVISORS[ctx.ans.aud] ? ADVISORS[ctx.ans.aud] : null, docs = d['seismic.search_content'] || [], msg = d['seismic.get_approved_language'] || [], disc = d['sharepoint.get_disclosures'], th = d['content.get_themes'];
  const chosen = (ctx.ans.topics && ctx.ans.topics.length ? ctx.ans.topics : ['TH-1']).map(id => th.themes.find(t => t.id === id) || { title: (THEMES.find(t => t[0] === id) || [])[1], source: (THEMES.find(t => t[0] === id) || [])[3] });
  const firm = A ? FIRMS[A.firm] : null, blocks = firm && firm.policy && /blocks/.test(firm.policy);
  const notes = d['crm.get_call_notes'] || [];
  const fmt = ctx.ans.fmt, T = TEMPLATES[fmt === 'linkedin' ? 'linkedin' : fmt === 'points' ? 'points' : 'email'];
  if (fmt === 'linkedin') return `<div class="docprev li"><div class="dochead"><span class="tplbadge">${h(T.id)}</span><div><b>LinkedIn post draft</b><small>Public · no client identifiers</small></div></div><div class="docbody"><p><b>${h(chosen[0].title)}:</b> ${h((msg[0] || {}).text || '')}</p><p>${h((msg[2] || msg[1] || {}).text || '')}</p><p class="cta">What questions do your clients ask about fees? #FinancialAdvice</p><p class="disc">${h(disc.required_disclosures.join(' '))}</p></div></div>`;
  if (fmt === 'points') return `<div class="docprev"><div class="dochead"><span class="tplbadge">${h(T.id)}</span><div><b>Talking points</b><small>${A ? h(A.name.replace(/,.*$/, '')) : 'Territory'} · approved sources only</small></div></div><div class="docbody"><section><h4>Themes</h4><ul>${chosen.map(c => `<li>${h(c.title)} (${h(c.source)})</li>`).join('')}</ul></section><section><h4>Approved messaging</h4><ul>${msg.slice(0, 2).map(m => `<li>${h(m.text)} (${h(m.id)})</li>`).join('')}</ul></section></div></div>`;
  const to = A ? `${A.name.replace(/,.*$/, '')} <${A.short.toLowerCase()}@${A.firm.slice(5).toLowerCase()}.example>` : ctx.ans.aud === 'internal' ? 'Sam Lee; Southern California desk' : `${TERRITORIES.LA.advisors.length} LA advisors (merge per recipient)`;
  return `<div class="docprev mail"><div class="dochead"><span class="tplbadge">${h(T.id)}</span><div><b>Email draft</b><small>Draft only · nothing is sent</small></div></div>
    <div class="mailmeta"><div><small>To</small><span>${h(to)}</span></div><div><small>Subject</small><span>This week: ${h(chosen[0].title.toLowerCase())}</span></div></div>
    <div class="docbody"><p>Hi ${A ? h(A.short) : '{{First name}}'},</p>
    ${A && notes[0] ? `<p>Following up on our ${h(notes[0].date)} conversation, where you said: “${h(((notes[0].text.match(/"([^"]+)"/) || [])[1] || notes[0].text.split(/(?<=[.!?])\s/)[0]).replace(/[.]$/, ''))}.”</p>` : ''}
    <p>Here’s what we’re watching this week: <b>${h(chosen.map(c => c.title).join('; '))}</b>.</p>
    ${msg.slice(0, 2).map(m => `<p class="approved">${h(m.text)} <span class="srcid">${h(m.id)}</span></p>`).join('')}
    <p>${blocks ? 'I’ve attached the approved pieces as PDFs:' : 'Approved pieces you can use:'}</p>
    <div class="atts">${docs.slice(0, 2).map(x => `<span class="att">${blocks ? '📎' : '🔗'} ${h(x.title)} <small>${h(x.id)}</small></span>`).join('')}</div>
    <p>Best,<br>${h(meName())}</p><p class="disc">${h(disc.required_disclosures.join(' '))}</p></div></div>`;
}

function cCompliance(d, ctx) {
  const A = ctx.ans.aud && ADVISORS[ctx.ans.aud] ? ADVISORS[ctx.ans.aud] : null, firm = A ? FIRMS[A.firm] : null;
  const checks = [['Approved messaging only', `${(d['seismic.get_approved_language'] || []).slice(0, 2).map(m => m.id).join(', ')} used verbatim`], ['No performance figures', 'None inserted (POL-3)'], ['Required disclosures present', `${d['sharepoint.get_disclosures'].required_disclosures.length} of ${d['sharepoint.get_disclosures'].required_disclosures.length}`], ['Personal notes kept out', 'No internal notes in client-facing text'], ...(firm && firm.policy ? [['Firm email policy', 'Links replaced with attached PDFs']] : []), ['Human approval before sending', 'Routed to Compliance review']];
  return card('Compliance pre-check', 'Rules from SharePoint and the policy library', `<ul class="qc">${checks.map(([t, x]) => `<li><span class="okd">✓</span><b>${h(t)}</b><small>${h(x)}</small></li>`).join('')}</ul>`);
}

function cWhy(d, ctx) {
  const fl = d['book.get_flows'], tx = (d['book.get_fund_transactions'] || {}).transactions || [], notes = d['crm.get_call_notes'] || [], a = ADVISORS[ctx.adv];
  const mf = fl.gross_sales_by_vehicle.find(v => v.name === 'Mutual fund'), etf = fl.gross_sales_by_vehicle.find(v => v.name === 'ETF'), mfr = fl.redemptions_by_vehicle.find(v => v.name === 'Mutual fund');
  const big = tx.slice().sort((x, y) => y.amount_usd_m - x.amount_usd_m)[0];
  const said = notes.find(n => /etf|index|passive|fee|model/i.test(n.text));
  const shift = mf && etf && mf.change_usd_m < 0 && etf.change_usd_m > 0;
  return card('Why it happened', 'Reasoning from the evidence above', `<div class="why">
    <div><h5>What I checked</h5><p>Twelve-month sales and redemptions by vehicle (data platform), fund transactions Jul to Sep, and ${notes.length} recorded conversations (Salesforce).</p></div>
    <div><h5>What changed</h5><p>Mutual fund gross sales went from ${m$(mf.prior_usd_m)} to ${m$(mf.current_usd_m)}${etf ? `, while ETF sales went from ${m$(etf.prior_usd_m)} to ${m$(etf.current_usd_m)}` : ''}. Mutual fund redemptions were ${m$(mfr.current_usd_m)} against ${m$(mfr.prior_usd_m)} the year before.${big ? ` The largest single transaction was a ${big.type.toLowerCase()} of ${m$(big.amount_usd_m)} in ${big.fund} on ${big.date}.` : ''}</p></div>
    <div><h5>What it means</h5><p>${shift ? `This looks like a vehicle shift rather than lost business: net flows are still ${m$(fl.totals.net_flows.current_usd_m)}.` : `Net flows were ${m$(fl.totals.net_flows.current_usd_m)} against ${m$(fl.totals.net_flows.prior_usd_m)} the year before.`}${said ? ` ${a.short} told us why: “${said.text.replace(/^[^:]*:\s*"?/, '').split(/(?<=[.!?])\s/)[0].replace(/"$/, '')}” (${said.id}).` : ''}</p></div></div>`, 'whycard');
}

function cWhoBooks(d, ctx) {
  const tm = d['crm.get_team'] || {}, a = ADVISORS[ctx.adv], booker = (tm.advisor_team || []).find(p => /book|calendar|schedul|coordinat/i.test(p.role));
  const rules = MEETING_RULES[a.firm];
  return card('Who books their calendar', 'Salesforce · team and meeting rules', `<div class="kv"><div><small>Advisor</small><span>${h(a.name)}</span></div><div><small>Scheduling contact</small><span>${booker ? `${h(booker.name)} · ${h(booker.role.split(';')[0])}` : 'Directly with the advisor'}</span></div>${rules ? `<div><small>Firm meeting rules</small><span>${h(rules.join(' · '))}</span></div>` : ''}</div>`);
}

function cSlots(d, ctx, run) {
  const c = d['calendar.find_times'];
  return card('Times that work', `Outlook · ${h(c.note)} · ${ctx.ans.len || 30} minutes`, `<div class="slots2">${c.slots.map(s => `<button type="button" class="slotbtn" data-slot="${h(s)}"><b>${h(s.split(',')[0])}</b><span>${h(s.split(',').slice(1).join(',').trim())}</span></button>`).join('')}</div><p class="fine">Attendees: ${h(c.attendees.join(', '))}. Pick a time to review the hold before anything is placed.</p>`);
}

function cPrograms(d) { const c = d['crm.get_contact']; return card('Advisor programs', 'Salesforce', `<div class="kv"><div><small>Advisor</small><span>${h(c.name)} · ${h(c.firm)}</span></div><div><small>Programs</small><span>${(c.platform_programs || []).map(p => `<em class="chip">${h(p)}</em>`).join(' ')}</span></div></div>`); }
function cHeld(d) { const as = d['book.get_assets']; return card('What they already hold', `Data platform · as of ${h(as.as_of)}`, `<table class="mini">${as.by_fund.map(f => `<tr><td><b>${h(f.fund)}</b> <small>${h(f.name)}</small></td><td>${h(f.vehicle)}</td><td class="r">${m$(f.assets_usd_m)}</td></tr>`).join('')}</table>`); }
function cFacts(d) { const fs = Object.entries(d).filter(([k]) => k.startsWith('fund.get_facts:')).map(([, v]) => v); return card('Verified fund facts', 'Data platform', `<table class="mini">${fs.map(f => `<tr><td><b>${h(f.ticker)}</b> <small>${h(f.name)}</small></td><td class="r">${f.er != null ? f.er.toFixed(2) + '%' : '—'} <small>ER, as of ${h(f.asOf)}</small></td></tr>`).join('')}</table>`); }

function cPitch(d, ctx) {
  const custom = ctx.ans.kind === 'custom', A = ctx.adv ? ADVISORS[ctx.adv] : null, pl = d['platform.get_availability'], as = d['book.get_assets'], docs = d['seismic.search_content'] || [], T = TEMPLATES[custom ? 'pbCustom' : 'pbStd'];
  const fs = Object.entries(d).filter(([k]) => k.startsWith('fund.get_facts:')).map(([, v]) => v);
  const etfs = pl ? [...new Set(pl.items.filter(i => /ETF/.test(i.name)).map(i => i.ticker))] : [];
  const pages = [
    ['Cover', `<b>${custom && A ? `Prepared for ${h(A.team.replace(/\s*\(.*\)/, ''))}` : 'Capital Group ETFs'}</b><br><small>${h(FIRMS[(A || ADVISORS['ADV-105']).firm].name)}</small>`],
    custom && as ? ['Your book today', `${m$(as.total_usd_m)} with Capital Group<br><small>${as.by_vehicle.map(v => `${v.vehicle} ${pct(v.share_pct)}`).join(' · ')}</small>`] : ['Why Capital Group', '<small>The Capital System: multiple managers, long-term view</small>'],
    ['Lineup on your platform', `${etfs.map(t => `<em class="chip">${h(t)}</em>`).join(' ')}`],
    ['Fund facts', fs.map(f => `${h(f.ticker)} ${f.er != null ? f.er.toFixed(2) + '%' : ''}`).join('<br>')],
    ['Where active fits', `<small>${h((docs[0] || {}).title || 'Core-satellite')}</small>`],
    ['Disclosures', '<small>Presentation disclosures from SharePoint</small>']];
  return `<div class="docprev"><div class="dochead"><span class="tplbadge">${h(T.id)}</span><div><b>${custom ? 'Custom' : 'Standard'} pitch book · ${pages.length} pages</b><small>${h(T.name)} · ${h(T.ver)} · ${ctx.ans.aud === 'inv' ? 'investor-approved pages' : 'financial professional use'}</small></div></div>
    <div class="pages">${pages.map((p, k) => `<div class="page" style="animation-delay:${k * 90}ms"><span class="pn">${k + 1}</span><div class="ptitle">${h(p[0])}</div><div class="pbody">${p[1]}</div></div>`).join('')}</div></div>`;
}

/* interactive bits inside components */
function wireComp(comp, run) {
  comp.querySelectorAll('.slotbtn').forEach(b => b.onclick = () => {
    comp.querySelectorAll('.slotbtn').forEach(x => x.classList.toggle('on', x === b));
    const a = ADVISORS[run.ctx.adv], slot = b.dataset.slot, tm = run.data['crm.get_team'] || {}, booker = (tm.advisor_team || []).find(p => /book|calendar|schedul|coordinat/i.test(p.role));
    const old = thread().querySelector('.approve:not(.done)'); if (old) old.closest('.turn').remove();
    const el = add(`<div class="arow"><span class="ava">✦</span><div class="abody"><div class="approve"><div class="aph"><span class="lbl warn">Needs your approval</span>This changes a calendar</div>
      <div class="kv"><div><small>What</small><span>${({ follow: 'Follow-up', review: 'Quarterly review', product: 'Product deep dive' })[run.ctx.ans.topic] || 'Meeting'} with ${h(a.name.replace(/,.*$/, ''))}</span></div><div><small>When</small><span>${h(slot)} · ${run.ctx.ans.len || 30} min</span></div><div><small>Invite goes to</small><span>${h(booker ? booker.name + ' (books for ' + a.short + ')' : a.name)}${(run.ctx.ans.who || []).length ? ' · ' + h(run.ctx.ans.who.join(', ')) : ''}</span></div></div>
      <div class="acts"><button type="button" class="primary" data-ok>Place hold and draft invite</button><button type="button" class="ghost" data-no>Not now</button></div></div></div></div>`, 'asst');
    el.querySelector('[data-no]').onclick = () => { el.querySelector('.approve').classList.add('done'); el.querySelector('.acts').innerHTML = '<span class="muted">Nothing changed.</span>'; };
    el.querySelector('[data-ok]').onclick = async () => {
      el.querySelector('.approve').classList.add('done'); el.querySelector('.acts').innerHTML = '<span class="spin"></span> Writing to Outlook…'; railSys('m365', 'reading');
      try { TOOLS['calendar.create_event'].run({ title: 'Meeting with ' + a.name, attendees: [a.name], time: slot }, {}); } catch (e) { /* demo */ }
      await wait(900); railSys('m365', 'done', 1);
      el.querySelector('.acts').innerHTML = `<span class="okd">✓</span> Hold placed on your calendar for ${h(slot)}. Invite drafted to ${h(booker ? booker.name : a.short)} in Outlook, waiting for you to send. Logged to Salesforce.`;
      scrollDown();
    };
  });
}

/* ---------- right rail: what's connected, what was passed ---------- */
function railSys(k, state, inc = 0) { const r = S.rail.sys[k] || (S.rail.sys[k] = { state: 'idle', calls: 0 }); r.state = state; r.calls += inc; renderRail(); }
function renderRail() {
  const R = S.rail, used = Object.keys(SYS).filter(k => R.sys[k]);
  $('rail').innerHTML = `<div class="rblock"><div class="rh">Connected systems <small>${used.length ? used.length + ' in use' : 'idle'}</small></div>
    ${Object.keys(SYS).map(k => { const r = R.sys[k] || { state: 'idle', calls: 0 }; return `<div class="rsys ${r.state}" style="--c:${SYS[k].color}"><i>${SYS[k].abbr}</i><span><b>${h(SYS[k].name)}</b><small>${h(SYS[k].sub)}</small></span><em>${r.state === 'connecting' ? 'Connecting' : r.state === 'reading' ? 'Reading' : r.state === 'done' ? `${r.calls} call${r.calls === 1 ? '' : 's'}` : ''}</em></div>`; }).join('')}</div>
    <div class="rblock"><div class="rh">Information passed <small>${R.hand.length}</small></div>${R.hand.length ? R.hand.slice(-6).map(x => `<div class="rhand" style="--c:${SYS[x.sys].color}"><b>${h(x.from)}</b> → ${h(x.to)}<div>${x.what.map(w => `<span>${h(w)}</span>`).join('')}</div></div>`).join('') : '<p class="rempty">As steps finish, what each one hands to the next shows here.</p>'}</div>
    <div class="rblock"><div class="rh">Templates <small>${R.tpl.length}</small></div>${R.tpl.length ? R.tpl.map(t => `<div class="rtpl"><span>▤</span><span><b>${h(t.name)}</b><small>${h(t.id)} · Seismic</small></span></div>`).join('') : '<p class="rempty">None yet.</p>'}</div>
    <div class="rblock"><div class="rh">Controls</div><p class="rctl">🔒 Reads use your permissions. Anything that sends, books or changes a record waits for your approval.</p></div>`;
}

/* ---------- chrome ---------- */
function setBusy(b) { $('send').disabled = b; document.body.classList.toggle('busy', b); }
function renderWho() {
  $('who').innerHTML = Object.keys(PERSONAS).map(id => { const e = EMPLOYEES[id]; return `<button type="button" class="wchip${id === ME ? ' on' : ''}" data-who="${id}" style="--c:${TEAMS[e.team].color}"><i>${h(initials(e.name))}</i><span>${h(e.name)}<small>${h(TEAMS[e.team].short || TEAMS[e.team].name)}</small></span></button>`; }).join('');
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-ask]'); if (s) { ask(s.dataset.ask); return; }
  const w = e.target.closest('[data-who]'); if (w && !S.busy) { ME = w.dataset.who; renderWho(); welcome(); }
});
$('newChat').onclick = () => { if (!S.busy) welcome(); };
$('composer').onsubmit = e => { e.preventDefault(); const v = $('ask').value; $('ask').value = ''; autosize(); ask(v); };
const autosize = () => { const t = $('ask'); t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; };
$('ask').addEventListener('input', autosize);
$('ask').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composer').requestSubmit(); } });
document.addEventListener('keydown', e => { if (S.pending && /^[1-4]$/.test(e.key) && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); S.pending(+e.key - 1); } });
document.querySelector('.thread-wrap').addEventListener('scroll', e => { const w = e.target; stick = w.scrollHeight - w.scrollTop - w.clientHeight < 120; });

renderWho(); welcome();
window.HARNESS = { ask, S, classify, findAdvisor, PLAYBOOKS };
})();
