/* ===== Sales AI: business intents, sub-agents, shared services and the query catalogue =====
   The catalogue holds example requests and the plan each one should produce. It is a set of
   application requirements, not a claim that every integration exists: each [service] says
   whether it is simulated in this demo, built into the foundation, or not connected. */

/* What the person wants done. The intelligence layer picks exactly one per request. */
const INTENTS = {
  retrieve: 'Fetch specific records or facts as they are',
  summarize: 'Condense what is known into a short read',
  compare: 'Put two things side by side on the same basis or across time',
  diagnose: 'Explain why something happened or why the system produced a result',
  prioritize: 'Rank or filter candidates against stated criteria',
  prepare: 'Assemble what someone needs for a meeting, call or decision',
  verify: 'Confirm a fact, status or availability against the system of record',
  draft: 'Write something for review; nothing is sent',
  execute: 'Make a change the person explicitly asked for (still reviewed)',
  remember: 'Store a fact or preference under the memory rules',
  monitor: 'Watch for a condition and report or alert when it occurs'
};
const INTENT_ORDER = Object.keys(INTENTS);

/* The eight fields the intelligence layer must establish before anything runs */
const INTERP_FIELDS = [
  ['subject', 'Subject', 'Advisor, buying unit, firm, territory, plan, opportunity, fund or document'],
  ['intent', 'Business intent', 'Retrieve, summarize, compare, diagnose, prioritize, prepare, verify, draft, execute, remember or monitor'],
  ['scope', 'Scope', 'Wealth or retirement, territory, dealer or platform, vehicle, audience'],
  ['time', 'Time', 'As-of date, comparison period, last meeting or a requested historical date'],
  ['constraints', 'Constraints', 'Exclusions, approved content only, do not send, one page'],
  ['output', 'Requested output', 'Answer, ranked list, comparison, agenda, brief, draft, task or alert'],
  ['missing', 'Missing information', 'Only what materially changes the answer or the action'],
  ['authority', 'Action authority', 'Read-only, draft-only, proposed change, or an explicitly requested external action']
];

/* Action authority, lowest to highest. A tool may run only at or below the run's authority. */
const AUTHORITY = {
  read_only: { n: 0, label: 'Read-only', does: 'Reads and answers. No drafts, no changes.' },
  draft_only: { n: 1, label: 'Draft-only', does: 'May save drafts for review. Nothing is sent or changed.' },
  proposed_change: { n: 2, label: 'Proposed change', does: 'May place holds, update records or create tasks the person asked for; external sends still need approval.' },
  external_action: { n: 3, label: 'External action', does: 'May prepare an explicitly requested send; a person approves the exact payload (POL-1).' }
};
/* What each tool does to the world: read (0), save a draft (1), change a record or calendar (2) */
const TOOL_ACT = { 'mail.draft': 1, 'crm.log_activity': 2, 'crm.create_task': 2, 'calendar.create_event': 2, 'service.update_case': 2 };
const toolAct = name => TOOL_ACT[name] ?? 0;

/* Agents and their sub-agents (skills). Route notation: Prep.Notes = Prep Me → Notes Summarizer. */
const SUBAGENTS = {
  Prep: { agent: 'sales.prep', name: 'Prep Me', subs: {
    Profile: 'Advisor, buying-unit and team profile from CRM',
    Notes: 'Notes Summarizer: meeting notes and dated statements, attributed to who said them',
    Content: 'Selects approved content that fits the meeting and the advisor’s stated needs',
    'Fact Check': 'Checks every claim, number and date against its source; flags conflicts',
    Agenda: 'Builds the agenda from verified topics',
    Themes: 'Themes relevant to this advisor this week',
    News: 'Authorized news, filtered for relevance' } },
  Lead: { agent: 'sales.lead', name: 'Lead Me', subs: {
    Discover: 'Self Service Leads: finds relationships that match explicit criteria',
    Insights: 'Insights Generator: explains changes in assets, flows and pipeline',
    Products: 'Product Recommender: discussion candidates, never suitability conclusions' } },
  Territory: { agent: 'sales.territory', name: 'Territory Planning', subs: {
    'Health Check': 'Coverage and activity health across the territory',
    Calibration: 'Compares relationships with permitted peer cohorts',
    Teaming: 'Who on the internal team and the advisor’s team should be involved',
    Reviews: 'Coverage reviews and balance',
    Strategy: 'Turns priorities into a sequenced plan',
    'Business Planning': 'Goals, capacity and pipeline into a territory plan' } },
  Schedule: { agent: 'sales.schedule', name: 'Schedule Me', subs: {
    Calendar: 'Finds times and proposes or places meetings', Email: 'Drafts scheduling emails',
    Compliance: 'Checks a meeting change against rules before it is made', Zoning: 'Groups visits by geography and travel time' } },
  Engage: { agent: 'sales.engage', name: 'Engage Me', subs: {
    'Q&A': 'Answers live questions from verified sources', Recommendations: 'In-meeting suggestions',
    Capture: 'Captures what the advisor says', Scenario: 'What-if scenarios on approved tools' } },
  Follow: { agent: 'sales.follow', name: 'Follow Me', subs: {
    Dictation: 'Turns dictated notes into a structured record', Tasks: 'Commitments, owners and due dates', Expenses: 'Matches visits to receipts and policy' } },
  Coach: { agent: 'sales.coach', name: 'Coach Me', subs: {
    Simulation: 'Labeled role-play from sourced preferences', Guide: 'Supported responses to objections' } },
  Product: { name: 'Product specialists', subs: {
    'Research Planner': ['product.planner', 'Decides what evidence is needed and where it comes from'],
    'Tool Selection': ['product.tools', 'Runs approved analytics tools'],
    'Response Formatter': ['product.format', 'Formats the verified answer for its audience'],
    QAR: ['product.qar', 'Verified answers; every number traced to a system of record'] } },
  Marketing: { name: 'Marketing specialists', subs: {
    'Resource Gatherer': ['marketing.gather', 'Finds approved content, messaging and pages'],
    'Document Analyzer': ['marketing.analyze', 'Extracts key points from approved documents'],
    Editor: ['marketing.copy', 'Edits and writes from verified findings'],
    'Audience Builder': ['marketing.audience', 'Builds permitted audiences'],
    Distribution: ['marketing.dist', 'Prepares sends; nothing goes out without approval'] } }
};
/* "Prep.Notes" → { route, agent, sub, label, does } */
function routeInfo(route) {
  const m = String(route || '').trim().match(/^(\w+)\.(.+)$/); if (!m) return null;
  const A = SUBAGENTS[m[1]]; if (!A) return null;
  const sub = Object.keys(A.subs).find(s => s.toLowerCase() === m[2].trim().toLowerCase()); if (!sub) return null;
  const v = A.subs[sub], agent = Array.isArray(v) ? v[0] : A.agent, does = Array.isArray(v) ? v[1] : v;
  return { route: m[1] + '.' + sub, family: m[1], agent, sub, label: Array.isArray(v) ? sub : `${A.name} → ${sub}`, does };
}
const routeOfTask = (agent, sub) => { for (const [fam, A] of Object.entries(SUBAGENTS)) for (const [s, v] of Object.entries(A.subs)) { const a = Array.isArray(v) ? v[0] : A.agent; if (a === agent && (Array.isArray(v) || s === sub)) return fam + '.' + s; } return null; };

/* Shared tools and services: [name] in a route. Not autonomous agents. */
const SERVICES = {
  assets: { name: 'Assets', status: 'simulated', tools: ['book.get_assets'], does: 'CG assets by vehicle and fund, as of a date' },
  flows: { name: 'Flows', status: 'simulated', tools: ['book.get_flows'], does: 'Gross sales, redemptions and net flows by vehicle and channel, period over period' },
  'market share': { name: 'Market share', status: 'simulated', tools: ['book.get_market_share'], does: 'Metric definition, numerator, denominator and share by category' },
  taxonomy: { name: 'Taxonomy', status: 'simulated', tools: ['taxonomy.resolve'], does: 'Maps a category (equity funds, ETFs) to the actual funds, with exclusions' },
  'platform eligibility': { name: 'Platform eligibility', status: 'simulated', tools: ['platform.get_availability'], does: 'Dealer platform and program availability with effective dates' },
  pipeline: { name: 'Pipeline', status: 'simulated', tools: ['pipeline.get'], does: 'Opportunities with current status and status history' },
  plans: { name: 'Plans', status: 'simulated', tools: ['crm.get_plan'], does: 'Retirement plan records and lineups' },
  engagements: { name: 'Engagements', status: 'simulated', tools: ['engage.get_history'], does: 'Completed and scheduled interactions per advisor' },
  memory: { name: 'Memory', status: 'foundation', tools: [], does: 'Scoped, sourced advisor memory in the shared foundation' },
  policy: { name: 'Policy', status: 'foundation', tools: [], does: 'Rules applied to every packet and contribution' },
  'task state': { name: 'Task state', status: 'foundation', tools: [], does: 'Open commitments, owners and due dates' },
  'approved search': { name: 'Approved search', status: 'foundation', tools: ['seismic.search_content'], does: 'Search over approved content only' },
  'change history': { name: 'Change history', status: 'foundation', tools: [], does: 'Memory revisions and events since a date' },
  'relationship graph': { name: 'Relationship graph', status: 'foundation', tools: [], does: 'People, firms, units and coverage' },
  'action review': { name: 'Action review', status: 'foundation', tools: [], does: 'Human review of any change before it is made' },
  'service state': { name: 'Service state', status: 'simulated', tools: ['service.get_cases'], does: 'Open and resolved service cases' },
  'peer analytics': { name: 'Peer analytics', status: 'not connected', tools: [], does: 'Permitted peer cohorts and comparisons' },
  'engagement graph': { name: 'Engagement graph', status: 'not connected', tools: [], does: 'Web and content engagement attributable to advisors' },
  'ranking trace': { name: 'Ranking trace', status: 'not connected', tools: [], does: 'Why a ranked list came out the way it did' },
  'recommendation trace': { name: 'Recommendation trace', status: 'not connected', tools: [], does: 'Why a content item was recommended' },
  'evidence resolver': { name: 'Evidence resolver', status: 'not connected', tools: [], does: 'Resolves a claim to the source page and version' },
  positions: { name: 'Positions', status: 'not connected', tools: [], does: 'Position-level holdings' },
  'program rules': { name: 'Program rules', status: 'not connected', tools: [], does: 'Account and program minimums and rules' },
  'allocation versions': { name: 'Allocation versions', status: 'not connected', tools: [], does: 'Dated model allocations by dealer version' },
  'approved comparison tool': { name: 'Approved comparison tool', status: 'not connected', tools: [], does: 'Like-for-like fund comparisons' },
  'coverage analytics': { name: 'Coverage analytics', status: 'not connected', tools: [], does: 'Coverage frequency against priorities' },
  'pipeline scoring': { name: 'Pipeline scoring', status: 'not connected', tools: [], does: 'Scores opportunities for attention' },
  'change events': { name: 'Change events', status: 'not connected', tools: [], does: 'Business events after a date' },
  'expense system': { name: 'Expense system', status: 'not connected', tools: [], does: 'Receipts, policies and allocations' }
};
const SERVICE_ALIASES = { 'flows calculations': 'flows', transactions: 'flows', 'assets history': 'assets', 'metric definitions': 'market share', 'dealer changes': 'platform eligibility', 'pipeline history': 'pipeline', tasks: 'task state', 'plan master': 'plans', 'plans pagination': 'plans', service: 'service state', 'task state': 'task state' };
/* "[assets/pipeline]" → ['assets', 'pipeline'] (known keys, or the raw name when unknown) */
function serviceKeys(raw) {
  const inner = String(raw).replace(/^\[|\]$/g, '').trim();
  return inner.split(/\s*(?:\/|\+)\s*/).map(s => s.trim().toLowerCase()).filter(Boolean).map(s => SERVICES[s] ? s : SERVICE_ALIASES[s] || s);
}
const serviceStatus = k => SERVICES[k] ? SERVICES[k].status : 'not connected';

/* Parse a catalogue route into stages. Items in one stage run together; stages run in order.
   The last stage is the output. Brackets may contain "+" or "/", so split only outside them. */
function parseRoute(route) {
  const splitTop = (s, sep) => { const out = []; let depth = 0, cur = ''; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '[') depth++; if (c === ']') depth--; if (depth === 0 && s.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; continue; } cur += c; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
  const stages = splitTop(String(route).replace(/\.\s*$/, ''), '→');
  const output = stages.length > 1 ? stages.pop() : '';
  return { output, stages: stages.map(st => splitTop(st, ' + ').flatMap(item => {
    if (/^\[.*\]$/.test(item)) return [{ kind: 'service', raw: item, keys: serviceKeys(item) }];
    const m = item.match(/^(\w+)\.(.+)$/);
    if (m && SUBAGENTS[m[1]]) return m[2].split('/').map(s => { const r = routeInfo(m[1] + '.' + s.trim()); return r ? Object.assign({ kind: 'agent', grp: item }, r) : { kind: 'check', raw: m[1] + '.' + s.trim() }; });
    return [{ kind: 'check', raw: item }];
  })).flatMap(st => st.length > 1 && st.every(i => i.grp && i.grp === st[0].grp) ? st.map(i => [i]) : [st]) }; /* "Schedule.Compliance/Calendar" alone in a stage runs in order */
}

/* Same word, different intent: why the catalogue is organized by intent, not keywords */
const ETF_CONTRAST = [
  { ask: 'Find ETF leads.', intent: 'prioritize', route: 'Territory.Health Check + [taxonomy] → Lead.Discover → Lead.Insights → ranked ETF leads with reasons', control: 'Read-only; a score is a signal, not intent' },
  { ask: 'Explain this advisor’s ETF sales.', intent: 'diagnose', route: 'Lead.Insights + [flows] → Prep.Fact Check → contribution analysis with limits', control: 'Read-only; numbers only from the flows tool' },
  { ask: 'Check whether this ETF is available on the advisor’s platform.', intent: 'verify', route: 'Prep.Profile + Product.Research Planner + [platform eligibility] → Product.QAR → scoped availability with effective date', control: 'Read-only; dealer-wide, platform and suitability kept separate' },
  { ask: 'Prepare an ETF discussion.', intent: 'prepare', route: 'Prep.Notes + Lead.Products → Prep.Content → Prep.Agenda → discussion agenda', control: 'Read-only; returns the agenda, no email or CRM update' },
  { ask: 'Send the approved ETF material.', intent: 'execute', route: 'Prep.Content → Marketing.Distribution → reviewable send', control: 'External action; a person approves the exact payload' }
];

const CATALOGUE_GROUPS = {
  A: { title: 'Understand an advisor and prepare for a meeting', note: '“Prepare me” should normally reuse a confirmed meeting context. It should not require the user to name every source or sub-agent.' },
  B: { title: 'Understand assets, flows and market share', note: 'Numerical aggregation comes from validated data tools. The model explains the result; it does not calculate from loosely related narrative snippets.' },
  C: { title: 'Identify leads and prioritize coverage', note: 'A page visit is an observed event. A model score is a signal. Neither becomes “this advisor intends to buy.”' },
  D: { title: 'Verify products, dealer availability and model portfolios', note: 'Dealer-wide availability, availability on a particular platform, and suitability for a particular client are separate questions.' },
  E: { title: 'Select and personalize content', note: 'A recommendation reason distinguishes “relevant because of the advisor’s stated need” from “popular among other users.”' },
  F: { title: 'Retirement plans and pipeline', note: 'An old note about paperwork does not automatically reopen a closed opportunity.' },
  G: { title: 'Scheduling, territory planning and administration', note: 'Calendar, mapping and travel, expense and complete engagement data are integration dependencies, not proven available.' },
  H: { title: 'In-meeting support and coaching', note: '' }
};

/* [n, group, intent, what the user asks, intelligence decomposition, calls and resulting output, authority override,
    executable route when the written route is prose (as in #7)] */
const CATALOGUE = [
  [1, 'A', 'prepare', 'Prepare me for tomorrow’s meeting with this buying unit.', 'Resolve meeting, buying unit, purpose, duration.', 'Prep.Profile + Prep.Notes + [assets/pipeline] → Prep.Content → Prep.Agenda → meeting-specific brief.'],
  [2, 'A', 'summarize', 'I have one minute. What do I need to know before this call?', 'Same subject; compressed internal briefing.', 'Prep.Profile + Prep.Notes → Prep.Fact Check → three priorities, one open commitment, key unknowns.'],
  [3, 'A', 'compare', 'What has changed since my last meeting?', 'Find last completed meeting; compare relevant records after that date.', 'Prep.Notes + [change history] → Lead.Insights → dated changes, not a full profile repeat.'],
  [4, 'A', 'prepare', 'Who on this team should be in the meeting?', 'Identify roles relevant to the meeting purpose.', 'Territory.Teaming + Prep.Profile → [relationship graph] → suggested participants with role evidence.'],
  [5, 'A', 'summarize', 'Explain how this team invests and what they have told us they prefer.', 'Separate recorded statements, holdings, and model classifications.', 'Prep.Notes + Prep.Profile → Prep.Fact Check → source-attributed investment approach.'],
  [6, 'A', 'retrieve', 'What did we promise them that is still outstanding?', 'Retrieve commitments; verify current status.', 'Follow.Tasks + Prep.Notes → [task state] → open commitments, owners, deadlines.'],
  [7, 'A', 'prepare', 'Prepare the retirement discussion separately from their wealth business.', 'Split buying-unit or business-purpose context.', 'Prep.Profile → two scoped Prep.Notes/Content branches → Prep.Agenda → two distinct sections.', null, 'Prep.Profile → Prep.Notes + Prep.Content → Prep.Agenda → two distinct sections.'],
  [8, 'A', 'prepare', 'Give me three product topics and one practice-management topic.', 'Requested topic mix; relevant evidence required.', 'Lead.Products + Prep.Content → Prep.Agenda → supported topics; disclose when fewer qualify.'],
  [9, 'B', 'retrieve', 'How much business do we have with this advisor, and where is it invested?', 'Define CG book, entity level, date, vehicle and fund breakdown.', 'Prep.Profile → [assets] → Prep.Fact Check → dated holdings summary with units and scope.'],
  [10, 'B', 'diagnose', 'Why are overall sales down when ETF sales are up?', 'Compare matching periods; distinguish percentage growth from dollar contribution.', 'Lead.Insights → [flows calculations] → Prep.Fact Check → contribution analysis and limitations.'],
  [11, 'B', 'diagnose', 'Are they redeeming, or are they simply buying less?', 'Separate gross sales, redemptions, and net flows.', 'Lead.Insights → [transactions/flows] → verified movement; unknown when redemption data is unavailable.'],
  [12, 'B', 'retrieve', 'How much of this book is in equity versus fixed income?', 'Resolve asset class independently of vehicle.', 'Product.Tool Selection → [taxonomy] + [positions] → Prep.Fact Check → classified exposure with unmapped items.'],
  [13, 'B', 'compare', 'How has their mutual fund, ETF, and SMA mix changed?', 'Align comparable snapshots and denominators.', 'Lead.Insights → [assets history] → percentage-point and dollar changes, separately labeled.'],
  [14, 'B', 'verify', 'Explain our reported market share. Which assets are included?', 'Retrieve metric definition, eligible numerator, denominator, and date.', 'Prep.Fact Check → [metric definitions] + [market share] → reconciled calculation or discrepancy flag.'],
  [15, 'B', 'compare', 'How does this buying unit compare with similar advisors?', 'Define a permitted peer cohort and comparison measures.', 'Territory.Calibration → [peer analytics] → Lead.Insights → comparison with cohort and coverage caveats.'],
  [16, 'B', 'prioritize', 'What are the three most significant changes in their book?', 'Define significance: dollar change, mix change, or net-flow change.', 'Lead.Insights → [assets/flows] → ranked changes with the ranking basis stated.'],
  [17, 'C', 'prioritize', 'Find my top 10 equity-fund leads.', 'Territory, equity taxonomy, activity window, lead objective, ranking criteria.', 'Territory.Health Check + [taxonomy] → Lead.Discover → Lead.Insights → ranked eligible relationships.'],
  [18, 'C', 'prioritize', 'Who redeemed GFA and then revisited the fund page?', 'Identify posted redemptions and subsequent attributable visits within a window.', 'Lead.Discover → [transactions + engagement graph] → Lead.Insights → matching advisors and event chronology.'],
  [19, 'C', 'prioritize', 'Which advisors could benefit from a discussion about newly available products?', 'Platform change, eligible relationships, relevant business context.', '[platform eligibility] + Territory.Health Check → Lead.Products/Insights → discussion candidates, not suitability conclusions.'],
  [20, 'C', 'prioritize', 'Find advisors with meaningful large-growth assets but low CG share.', 'Category, minimum assets, share threshold, comparable data coverage.', '[taxonomy/market share] → Lead.Discover → Lead.Insights → evidence-backed opportunity list.'],
  [21, 'C', 'prioritize', 'Find relationships similar to this buying unit that I have not contacted in 90 days.', 'Professional similarity criteria plus coverage and last-contact filter.', 'Territory.Calibration + [engagements] → Lead.Discover → matched, uncontacted relationships.'],
  [22, 'C', 'prioritize', 'Separate retention conversations from potential new-business conversations.', 'Classify lead purpose using observed flows, requests, and current relationship state.', 'Lead.Insights + [service/task state] → [policy] → separate queues with reasons.'],
  [23, 'C', 'prioritize', 'Find retirement advisors, but do not include irrelevant wealth-product pitches.', 'Resolve retirement context and permitted vehicle/product scope.', 'Territory.Health Check → Lead.Discover → Lead.Products + [platform eligibility] → retirement-specific shortlist.'],
  [24, 'C', 'diagnose', 'Why did these three advisors rank highest, and who was excluded?', 'Explain the current ranked artifact—not generate a new ranking.', 'Lead.Insights → [ranking trace] → evidence, filters, exclusions, model contribution, and unknowns.'],
  [25, 'D', 'verify', 'Which CG ETFs are available at Wells Fargo for this advisor?', 'Advisor’s actual platform, account context, product vehicle, effective date.', 'Prep.Profile → Product.Research Planner + [platform eligibility] → Product.QAR → scoped availability list.'],
  [26, 'D', 'verify', 'Can I discuss CGUI for their Personalized UMA business?', 'Resolve fund, exact program, purpose, and current availability evidence.', 'Product.Research Planner → [platform eligibility] → Product.QAR → supported status or clarification required.'],
  [27, 'D', 'compare', 'What changed on their dealer shelf since my last visit?', 'Last visit date versus effective-dated availability changes.', 'Prep.Notes + [dealer changes] → Lead.Insights → relevant additions, removals, and restrictions.'],
  [28, 'D', 'verify', 'What minimum applies to this ETF model on their platform?', 'Distinguish product minimum from account/program minimum.', 'Product.Tool Selection → [program rules] → Product.QAR → exact scoped rule and source.'],
  [29, 'D', 'compare', 'What changed in the Moderate Growth model allocation?', 'Select correct model, dealer version, and two allocation dates.', 'Product.Research Planner → [allocation versions] → Product.QAR → component-level change comparison.'],
  [30, 'D', 'prepare', 'They already use a value-oriented core. What should I investigate without duplicating it?', 'Retrieve stated approach; identify complementary research questions—not infer suitability.', 'Prep.Notes → Lead.Products → Product.Research Planner → candidates for investigation and missing facts.'],
  [31, 'D', 'compare', 'Compare these two funds on the same basis.', 'Specify share class, date, currency, measures, and intended use.', 'Product.Tool Selection → [approved comparison tool] → Product.QAR → like-for-like comparison.'],
  [32, 'D', 'verify', 'When I say equity funds, which actual funds are you including?', 'Resolve category-to-fund mapping and relevant restrictions.', '[taxonomy] → Product.Response Formatter → canonical fund list and excluded/unmapped items.'],
  [33, 'E', 'prioritize', 'Which three articles should I use for this meeting?', 'Meeting objective, advisor context, audience, freshness, relevance.', 'Prep.Notes + Prep.Content → [approved search] → Prep.Fact Check → three items with specific reasons.'],
  [34, 'E', 'diagnose', 'Why are you recommending the estate-planning article?', 'Inspect the existing recommendation’s basis.', 'Prep.Content → [recommendation trace] → advisor-specific evidence versus popularity-only rationale.'],
  [35, 'E', 'draft', 'Remove duplicate topics from my agenda.', 'Compare semantic topic overlap while preserving distinct evidence.', 'Prep.Content + Prep.Agenda → consolidated topics with retained source references.'],
  [36, 'E', 'draft', 'Turn these selected articles into concise agenda one-liners.', 'Transform selected content; preserve meaning and audience boundaries.', 'Marketing.Document Analyzer → Marketing.Editor → Prep.Fact Check → concise internal agenda lines.'],
  [37, 'E', 'verify', 'Show the exact page supporting that allocation statement.', 'Trace claim to original document and version.', 'Prep.Fact Check → [evidence resolver] → page/passage; disclose missing original evidence.'],
  [38, 'E', 'prepare', 'Give me something useful for their practice, not another fund pitch.', 'Focus on business problems stated in notes.', 'Prep.Notes → Prep.Content → Marketing.Editor → relevant practice-management discussion.'],
  [39, 'E', 'summarize', 'What themes are relevant to this advisor this week?', 'Time window, authorized sources, advisor context, source freshness.', 'Prep.Themes + Prep.News → Prep.Content → sourced themes with relevance—not a generic news dump.'],
  [40, 'E', 'draft', 'Draft personalized outreach for these ten advisors using only approved material.', 'Ten scoped drafts, recipient context, audience rights, no implied sending.', 'Marketing.Audience Builder → Prep.Content → Marketing.Editor → [policy] → ten reviewable drafts.', 'draft_only'],
  [41, 'F', 'retrieve', 'How many retirement plans does this relationship cover, and which are largest?', 'Entity scope, plan universe, asset definition, as-of date.', 'Prep.Profile → [plans] → Prep.Fact Check → plan count and ranked assets.'],
  [42, 'F', 'retrieve', 'The summary says 15 plans. Show all of them, not just the three displayed.', 'Full underlying dataset versus visible subset.', '[plans pagination] → Prep.Fact Check → complete permitted list or explicit coverage limitation.'],
  [43, 'F', 'retrieve', 'Separate the 401(k) opportunities from the SIMPLE IRA relationships.', 'Resolve plan type, not just text similarity.', '[plan master] → Lead.Insights → separate populations and applicable next questions.'],
  [44, 'F', 'verify', 'Which opportunities are actually open?', 'Current authoritative status and stage; exclude stale narrative-only claims.', '[pipeline] → Prep.Fact Check → Lead.Insights → open/in-progress list with dates.'],
  [45, 'F', 'diagnose', 'Why does the Forsyth narrative mention paperwork while the pipeline says closed?', 'Compare source dates, status history, and record identity.', 'Prep.Notes + [pipeline history] → Prep.Fact Check → chronology or unresolved conflict.'],
  [46, 'F', 'summarize', 'What happened on this opportunity after our last meeting?', 'Opportunity-specific event timeline since the meeting.', 'Prep.Notes + [pipeline/tasks] → Lead.Insights → changes, owner actions, and remaining gaps.'],
  [47, 'F', 'prioritize', 'Which retirement opportunities deserve attention first?', 'Business criteria, verified stage, size, age, and next action.', 'Lead.Insights → [pipeline scoring] → Territory.Strategy → ranked work queue with rationale.'],
  [48, 'F', 'diagnose', 'Has anything changed that justifies revisiting a closed opportunity?', 'New evidence after closure; no automatic reopening.', '[change events] + Prep.Notes → Lead.Insights → review candidates and supporting changes.'],
  [49, 'G', 'prepare', 'Find 30 minutes next week with my internal partner to review these leads.', 'Internal participants, dates, duration, time zone, purpose.', 'Territory.Teaming → Schedule.Calendar → available proposals; no invitation unless requested.'],
  [50, 'G', 'prepare', 'Plan four advisor visits in Savannah next month.', 'Geography, lead priority, availability, travel constraints.', 'Territory.Strategy + Lead.Insights → Schedule.Zoning/Calendar → proposed route and meeting slots.'],
  [51, 'G', 'execute', 'Invite my partner to the selected meeting.', 'Resolve exact meeting and attendee; modify one event.', 'Territory.Teaming → Schedule.Compliance/Calendar → reviewed update and provider result.', 'proposed_change'],
  [52, 'G', 'execute', 'Move that meeting to Thursday afternoon.', 'Resolve “that meeting,” date, time zone, attendees, conflicts.', 'Schedule.Calendar → [action review] → rescheduling proposal or confirmed authorized change.', 'proposed_change'],
  [53, 'G', 'monitor', 'Which assigned advisors have not had meaningful contact in 90 days?', 'Define meaningful contact; distinguish completed from scheduled activity.', 'Territory.Health Check → [engagements] → coverage gaps with last completed interaction.'],
  [54, 'G', 'diagnose', 'Are we over-covering some relationships and neglecting others?', 'Compare engagement frequency with approved coverage priorities.', 'Territory.Reviews/Calibration → [coverage analytics] → imbalances and review recommendations.'],
  [55, 'G', 'prepare', 'What should my territory priorities be for next month?', 'Goals, pipeline, coverage, capacity, and current constraints.', 'Territory.Business Planning + Lead.Insights → Territory.Strategy → proposed territory plan.'],
  [56, 'G', 'draft', 'Prepare my expense report for these visits.', 'Match actual visits to receipts, policies, and allocations.', 'Follow.Expenses → [expense system] → review → draft report; no invented expense amounts.', 'draft_only'],
  [57, 'H', 'prepare', 'Role-play the meeting using the advisor’s recorded fixed-income preferences.', 'Practice scenario; use sourced preferences without impersonation claims.', 'Prep.Notes → Coach.Simulation → labeled role-play with conditional responses.'],
  [58, 'H', 'prepare', 'Help me respond if they challenge the fee.', 'Conditional objection; exact product and fee basis required.', 'Product.Research Planner/QAR → Coach.Guide → supported response and clarifying questions.']
].map(([n, group, intent, ask, decomp, route, auth, exec]) => ({ n, group, intent, ask, decomp, route, auth: auth || null, exec: exec || route }));

/* The catalogue entries closest to a request (word overlap, intent words weigh more). Shown to the planner as reference patterns. */
function cataloguePatterns(text, k = 3) {
  const stop = new Set(['what', 'this', 'that', 'with', 'their', 'they', 'have', 'from', 'about', 'should', 'which', 'when', 'them', 'me', 'my', 'the', 'and', 'for', 'are', 'you', 'your', 'show', 'give']);
  const toks = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w)).map(w => w.replace(/(ing|ed|es|s)$/, '')));
  const q = toks(text);
  return CATALOGUE.map(c => { const t = toks(c.ask + ' ' + c.decomp); let s = 0; q.forEach(w => { if (t.has(w)) s += 1; }); return { c, s: s / Math.sqrt(t.size + 1) }; })
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.c);
}
const catalogueExact = text => CATALOGUE.find(c => c.ask.replace(/[.?]$/, '').toLowerCase() === String(text).trim().replace(/[.?]$/, '').toLowerCase());
