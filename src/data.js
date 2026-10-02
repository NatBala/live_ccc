/* ===== Reference data: the enterprise as the foundation sees it =====
   People and firms' teams are fictional. Fund facts marked verified come from
   public fund pages (as of the date shown); anything not verified is left null
   so the fund data platform, not the AI, stays the source of numbers. */

const TEAMS = {
  sales: { name: 'Sales', color: '#82b6ff' },
  product: { name: 'Product', color: '#7fd4ab' },
  marketing: { name: 'Marketing', color: '#f0b870' },
  service: { name: 'Service', color: '#b9a5f5' }
};
const TEAM_ORDER = ['sales', 'product', 'marketing', 'service'];

/* Who can type into the command bar */
const EMPLOYEES = {
  'EMP-PRIYA': { name: 'Priya Shah', team: 'sales', role: 'Wholesaler, Southern California (LA, Orange County, San Diego)', covers: ['ADV-101', 'ADV-102', 'ADV-104', 'ADV-105', 'ADV-106'] },
  'EMP-SAM': { name: 'Sam Lee', team: 'sales', role: 'Internal partner, Southern California', covers: ['ADV-101', 'ADV-102', 'ADV-103', 'ADV-104', 'ADV-105', 'ADV-106', 'ADV-107'] },
  'EMP-DANA': { name: 'Dana Ortiz', team: 'product', role: 'Investment product specialist', covers: [] },
  'EMP-MARCUS': { name: 'Marcus Bell', team: 'marketing', role: 'Advisor marketing lead', covers: [] },
  'EMP-KIM': { name: 'Kim Nguyen', team: 'service', role: 'Advisor service', covers: [] }
};

const SUGGESTIONS = {
  sales: ['Identify the growing trends in LA territory', 'Compare BFA and AMBAL for Rachel and schedule a meeting with her next month', 'Prep me for my call with Alex tomorrow', 'Prepare Maya’s retirement committee fee comparison review', 'Sofia mentioned ETFs. What should I bring to our next meeting?', 'Alex said on today’s call he wants the numbers in an appendix from now on. Update his profile.'],
  product: ['Compare BFA and AMBAL: costs, approach and who each suits', 'Why has GFA trailed the Vanguard growth index? I need an explanation advisors can use.', 'Compare GFA F-2 costs with VWUAX and VIGAX on $38M', 'Check whether our fee comparison for Maya is still current'],
  marketing: ['Draft the follow-up email to Alex using Product’s verified comparison', 'Create an ETF email campaign for Sofia', 'Write a LinkedIn post on fee transparency for advisors'],
  service: ['Alex says the link in Priya’s email won’t open', 'Maya says the benchmark explanation is still unclear']
};

/* The full registry of 37 specialists. tools = what each may call through the MCP or API gateway. */
const AGENTS = {
  'sales.lead': { name: 'Lead Me', team: 'sales', does: 'Prioritizes advisors and opportunities using model signals', tools: ['models.sales_alpha', 'models.territory_trends', 'crm.get_opportunities'] },
  'sales.schedule': { name: 'Schedule Me', team: 'sales', does: 'Finds meeting times for advisors or colleagues and places calendar holds', tools: ['calendar.find_times', 'calendar.create_event', 'crm.get_contact'] },
  'sales.prep': { name: 'Prep Me', team: 'sales', does: 'Builds meeting briefs and agendas from what is known about the advisor', tools: ['crm.get_call_notes', 'crm.get_opportunities', 'crm.get_contact', 'crm.get_plan'] },
  'sales.engage': { name: 'Engage Me', team: 'sales', does: 'Captures what advisors say in meetings and answers live questions', tools: ['crm.get_call_notes', 'crm.log_activity'] },
  'sales.follow': { name: 'Follow Me', team: 'sales', does: 'Logs outcomes, creates tasks and tracks commitments', tools: ['crm.log_activity', 'crm.create_task', 'crm.get_opportunities'] },
  'sales.coach': { name: 'Coach Me', team: 'sales', does: 'Private coaching for the wholesaler, never shared', tools: [] },
  'sales.territory': { name: 'Territory Planning', team: 'sales', does: 'Territory reviews: trends, coverage and business planning across advisors', tools: ['models.territory_trends', 'models.sales_alpha', 'crm.get_opportunities', 'crm.get_call_notes'] },
  'product.clarify': { name: 'Query Clarifier', team: 'product', does: 'Turns loose questions into precise, answerable ones (funds, share classes, periods)', tools: ['fund.get_facts', 'fund.lookup'] },
  'product.planner': { name: 'Research Planner', team: 'product', does: 'Decides what evidence is needed and where it comes from', tools: ['mstar.get_peers'] },
  'product.tools': { name: 'Tool Selection', team: 'product', does: 'Runs analytics: fee math, peer data, portfolio construction', tools: ['fund.get_facts', 'fund.lookup', 'models.cost_on_assets', 'models.portfolio_construction', 'models.plan_fee_comparison', 'mstar.get_peers'] },
  'product.summary': { name: 'Contact Summarizer', team: 'product', does: 'Summarizes the advisor context Product needs for a question', tools: [] },
  'product.tone': { name: 'Tone/Style Alignment', team: 'product', does: 'Turns verified product answers into advisor-ready language using approved messaging', tools: ['seismic.get_approved_language'] },
  'product.format': { name: 'Response Formatter', team: 'product', does: 'Formats product answers for the channel', tools: [] },
  'product.qar': { name: 'QAR', team: 'product', does: 'Produces verified answers; every number traced to a system of record', tools: ['fund.get_facts', 'fund.lookup', 'fund.get_performance', 'mstar.get_peers', 'models.cost_on_assets', 'models.plan_fee_comparison', 'seismic.search_content'] },
  'product.institutional': { name: 'Institutional Pitch Books', team: 'product', does: 'Institutional product materials', tools: ['seismic.search_content'] },
  'product.srg': { name: 'SRG Product Pitch Books', team: 'product', does: 'Product pitch books for the retail advisor channel', tools: ['seismic.search_content'] },
  'marketing.gather': { name: 'Resource Gatherer', team: 'marketing', does: 'Finds approved content, templates, messaging and landing pages', tools: ['seismic.search_content', 'seismic.get_approved_language', 'aem.get_page', 'mcloud.get_engagement'] },
  'marketing.analyze': { name: 'Document Analyzer', team: 'marketing', does: 'Extracts key points from approved documents', tools: ['seismic.search_content', 'service.get_insights'] },
  'marketing.copy': { name: 'Copywriter / Editor', team: 'marketing', does: 'Writes drafts in the audience’s preferred format from verified findings', tools: ['seismic.get_approved_language'] },
  'marketing.audit': { name: 'Audit Support', team: 'marketing', does: 'Keeps the audit trail for published material', tools: [] },
  'marketing.legal': { name: 'Legal & Compliance', team: 'marketing', does: 'Reviews claims, performance presentation and disclosures', tools: ['sharepoint.get_disclosures', 'seismic.get_approved_language'] },
  'marketing.image': { name: 'Image Analyzer', team: 'marketing', does: 'Checks charts and images in materials', tools: [] },
  'marketing.audience': { name: 'Audience Builder', team: 'marketing', does: 'Builds permitted audiences for campaigns', tools: ['models.sales_alpha', 'models.territory_trends', 'crm.get_contact', 'mcloud.get_engagement'] },
  'marketing.dist': { name: 'Distribution', team: 'marketing', does: 'Prepares sends; nothing goes out without human approval', tools: ['mail.draft'] },
  'marketing.voc': { name: 'Voice of Client', team: 'marketing', does: 'Captures explicit advisor statements and feedback, including what advisors ask Service', tools: ['crm.get_call_notes', 'service.get_insights'] },
  'marketing.linkedin': { name: 'LinkedIn Post', team: 'marketing', does: 'Drafts approved public posts with no client identifiers', tools: ['seismic.search_content', 'seismic.get_approved_language', 'mcloud.get_engagement', 'aem.get_page', 'service.get_insights'] },
  'marketing.email': { name: 'Personalized Email', team: 'marketing', does: 'Drafts personalized advisor emails', tools: ['mail.draft', 'seismic.search_content', 'seismic.get_approved_language', 'mcloud.get_engagement'] },
  'service.classify': { name: 'Inquiry Classifier', team: 'service', does: 'Classifies incoming advisor inquiries', tools: ['service.get_cases', 'contact.get_interactions'] },
  'service.identity': { name: 'Identity Verifier', team: 'service', does: 'Verifies who is asking and what they may receive', tools: ['crm.get_contact'] },
  'service.priority': { name: 'Priority Scorer', team: 'service', does: 'Scores urgency with service rules', tools: ['service.get_cases'] },
  'service.knowledge': { name: 'Knowledge Retriever', team: 'service', does: 'Retrieves approved procedures and answers', tools: ['seismic.search_content'] },
  'service.account': { name: 'Account Lookup', team: 'service', does: 'Looks up the advisor’s account, deliveries and history', tools: ['crm.get_contact', 'service.get_cases', 'seismic.get_delivery_log', 'contact.get_interactions'] },
  'service.resolve': { name: 'Resolve Me', team: 'service', does: 'Resolves access and delivery issues', tools: ['service.get_cases', 'service.update_case', 'seismic.export_pdf', 'seismic.get_delivery_log', 'contact.get_interactions'] },
  'service.escalate': { name: 'Escalate Me', team: 'service', does: 'Escalates what it can’t resolve to an owner', tools: ['service.update_case'] },
  'service.sentiment': { name: 'Sentiment Analyzer', team: 'service', does: 'Reads explicit satisfaction signals', tools: ['contact.get_interactions'] },
  'service.crosssell': { name: 'Cross-sell Detector', team: 'service', does: 'Flags explicit needs for Sales, never infers', tools: [] },
  'service.qa': { name: 'QA Logger', team: 'service', does: 'Logs service quality outcomes', tools: [] }
};

/* ---- Workbench: the teams and roles tasks are assigned to ---- */
const ROLES = {
  'sales.wholesalers': { team: 'sales', name: 'Wholesalers', person: 'Priya Shah', does: 'Advisor meetings: preparation, briefs, live conversations' },
  'sales.ssc': { team: 'sales', name: 'SSC', person: 'Nina Alvarez', does: 'Scheduling and follow-up' },
  'sales.internal': { team: 'sales', name: 'Internal wholesalers', person: 'Sam Lee', does: 'Territory insight and prioritization' },
  'product.specialists': { team: 'product', name: 'Product specialists', person: 'Dana Ortiz', does: 'Fund questions, comparisons, verified answers' },
  'product.analytics': { team: 'product', name: 'Investment analytics', person: 'Wei Zhang', does: 'Fee math, peer data, portfolio construction' },
  'marketing.content': { team: 'marketing', name: 'Content & campaigns', person: 'Marcus Bell', does: 'Approved content, drafts, personalized emails' },
  'marketing.compliance': { team: 'marketing', name: 'Compliance review', person: 'Grace Liu', does: 'Claims, disclosures, sign-off' },
  'marketing.distribution': { team: 'marketing', name: 'Distribution', person: 'Omar Haddad', does: 'Audiences and approved sends' },
  'service.advisor': { team: 'service', name: 'Advisor service', person: 'Kim Nguyen', does: 'Access, delivery and service cases' }
};
const AGENT_ROLE = {
  'sales.prep': 'sales.wholesalers', 'sales.engage': 'sales.wholesalers', 'sales.coach': 'sales.wholesalers',
  'sales.schedule': 'sales.ssc', 'sales.follow': 'sales.ssc',
  'sales.lead': 'sales.internal', 'sales.territory': 'sales.internal',
  'product.tools': 'product.analytics',
  'marketing.legal': 'marketing.compliance', 'marketing.audit': 'marketing.compliance',
  'marketing.dist': 'marketing.distribution', 'marketing.audience': 'marketing.distribution',
  'service.classify': 'service.advisor', 'service.identity': 'service.advisor', 'service.priority': 'service.advisor', 'service.knowledge': 'service.advisor', 'service.account': 'service.advisor', 'service.resolve': 'service.advisor', 'service.escalate': 'service.advisor', 'service.sentiment': 'service.advisor', 'service.crosssell': 'service.advisor', 'service.qa': 'service.advisor'
};
const roleOf = agent => AGENT_ROLE[agent] || (AGENTS[agent] ? { sales: 'sales.wholesalers', product: 'product.specialists', marketing: 'marketing.content', service: 'service.advisor' }[AGENTS[agent].team] : null);
/* Deterministic assignment rules the business asked for: they override the AI when they apply. */
const ROLE_RULES = [
  { test: /schedul|follow.?up|book(ing)?\b|calendar|invite|reschedul|reminder|set up (a )?(call|meeting)/i, role: 'sales.ssc', agent: t => /schedul|book|calendar|invite|reschedul|set up/i.test(t) ? 'sales.schedule' : 'sales.follow', why: 'Scheduling and follow-up go to SSC' },
  { test: /\bprep|brief|agenda|talking points|meeting preparation|prepare (me|for)/i, role: 'sales.wholesalers', agent: () => 'sales.prep', why: 'Meeting preparation goes to the wholesaler' }
];
const ROLE_DEFAULT_AGENT = { 'sales.wholesalers': 'sales.prep', 'sales.ssc': 'sales.schedule', 'sales.internal': 'sales.territory', 'product.specialists': 'product.qar', 'product.analytics': 'product.tools', 'marketing.content': 'marketing.email', 'marketing.compliance': 'marketing.legal', 'marketing.distribution': 'marketing.dist', 'service.advisor': 'service.resolve' };

const LAYERS = {
  memory: { name: 'Shared Memory', short: 'Memory', icon: 'memory' },
  knowledge: { name: 'Knowledge & Retrieval', short: 'Knowledge', icon: 'file' },
  policy: { name: 'Verification & Compliance', short: 'Verification', icon: 'shield' },
  models: { name: 'Analytics & Models', short: 'Models', icon: 'chart' },
  feedback: { name: 'Feedback Data', short: 'Feedback', icon: 'loop' },
  events: { name: 'Event-Driven Signals', short: 'Events', icon: 'bolt' },
  graph: { name: 'Graph Knowledge Layer', short: 'Graph', icon: 'network' }
};
const LAYER_ORDER = ['memory', 'knowledge', 'policy', 'models', 'feedback', 'events', 'graph'];

const SYSTEMS = {
  sf: { name: 'Salesforce', sub: 'CRM · Service Cloud cases · plans', icon: 'users' },
  m365: { name: 'Microsoft 365', sub: 'Outlook · Calendar · SharePoint', icon: 'mail' },
  seismic: { name: 'Seismic', sub: 'Approved content', icon: 'book' },
  fund: { name: 'Data & model platform', sub: 'Fund facts · models', icon: 'chart' },
  mstar: { name: 'Morningstar', sub: 'Licensed peer data', icon: 'globe' },
  gen: { name: 'Genesys Cloud', sub: 'Contact center · service insights', icon: 'bell' },
  mcloud: { name: 'Marketing Cloud', sub: 'Campaign engagement', icon: 'mail' },
  aem: { name: 'Adobe Experience Manager', sub: 'Published web pages', icon: 'file' }
};
const SYS_ORDER = ['sf', 'm365', 'seismic', 'fund', 'mstar', 'gen', 'mcloud', 'aem'];

/* ---------------- Enterprise reference records ---------------- */
const FIRMS = {
  'FIRM-MS': { name: 'Morgan Stanley Wealth Management', policy: 'Email security blocks external content links (learned from CASE-00481)' },
  'FIRM-NS': { name: 'Northstar Advisory (RIA)', policy: null },
  'FIRM-ML': { name: 'Merrill', policy: null },
  'FIRM-WF': { name: 'Wells Fargo Advisors', policy: null },
  'FIRM-UBS': { name: 'UBS Wealth Management', policy: null },
  'FIRM-HP': { name: 'Harbor Point Wealth (RIA)', policy: null }
};

const ADVISORS = {
  'ADV-101': { name: 'Alex Rivera, CFP®', short: 'Alex', title: 'Senior Vice President, Wealth Advisor', firm: 'FIRM-MS', office: 'Newport Beach, CA', territory: 'OC', team: 'The Rivera Group (Jamie Cho runs his calendar)',
    practice: '~$1.1B, ~160 households: business owners and tech executives near retirement', coverage: ['EMP-PRIYA', 'EMP-SAM'],
    units: { 'BU-101A': 'Rivera Group discretionary growth model', 'BU-101B': 'Newport Tech 401(k) plan committee (Alex advises)' } },
  'ADV-102': { name: 'Maya Chen', short: 'Maya', title: 'Principal', firm: 'FIRM-NS', office: 'Irvine, CA', territory: 'OC', team: 'Northstar Advisory, with Elena Park as primary contact',
    practice: 'Retirement plan committees and a wealth team', coverage: ['EMP-PRIYA', 'EMP-SAM'],
    units: { 'BU-102R': 'Northstar retirement committee', 'BU-102W': 'Northstar wealth team' } },
  'ADV-103': { name: 'Jordan Patel', short: 'Jordan', title: 'First Vice President', firm: 'FIRM-ML', office: 'Irvine, CA', territory: 'OC', team: 'Patel Retirement Group',
    practice: 'Income-focused retirees', coverage: ['EMP-SAM'], units: { 'BU-103': 'Patel income portfolios' } },
  'ADV-104': { name: 'Sofia Martinez', short: 'Sofia', title: 'Vice President, Financial Advisor', firm: 'FIRM-MS', office: 'San Diego, CA', territory: 'SD', team: 'Martinez Wealth Partners',
    practice: 'Young professionals and small-business owners', coverage: ['EMP-PRIYA', 'EMP-SAM'], units: { 'BU-104': 'Martinez core model portfolios' } },
  'ADV-105': { name: 'Daniel Kim', short: 'Daniel', title: 'Managing Director, Financial Advisor', firm: 'FIRM-WF', office: 'Century City, Los Angeles', territory: 'LA', team: 'The Kim Group',
    practice: 'Entertainment and tech professionals; runs model portfolios', coverage: ['EMP-PRIYA', 'EMP-SAM'], units: { 'BU-105': 'Kim Group model portfolios' } },
  'ADV-106': { name: 'Rachel Okafor', short: 'Rachel', title: 'Senior Vice President, Wealth Advisor', firm: 'FIRM-UBS', office: 'Pasadena, Los Angeles', territory: 'LA', team: 'Okafor Wealth Group',
    practice: 'Retirees and pre-retirees who need income', coverage: ['EMP-PRIYA', 'EMP-SAM'], units: { 'BU-106': 'Okafor retirement income portfolios' } },
  'ADV-107': { name: 'Luis Herrera', short: 'Luis', title: 'Principal', firm: 'FIRM-HP', office: 'Long Beach, Los Angeles', territory: 'LA', team: 'Harbor Point Wealth',
    practice: 'Independent RIA; core portfolios for families and small businesses', coverage: ['EMP-SAM'], units: { 'BU-107': 'Harbor Point core portfolios' } }
};
const TERRITORIES = {
  LA: { name: 'Los Angeles', aliases: ['la', 'los angeles', 'l.a.'], advisors: ['ADV-105', 'ADV-106', 'ADV-107'], wholesaler: 'Priya Shah' },
  OC: { name: 'Orange County', aliases: ['oc', 'orange county'], advisors: ['ADV-101', 'ADV-102', 'ADV-103'], wholesaler: 'Priya Shah' },
  SD: { name: 'San Diego', aliases: ['sd', 'san diego'], advisors: ['ADV-104'], wholesaler: 'Priya Shah' }
};
/* Last quarter's counts, so the territory model can say what is growing */
const TREND_BASELINE = { LA: { etf: 1, income: 0, bonds: 0, models: 1, fees: 1 }, OC: { etf: 0, income: 1, bonds: 0, models: 1, fees: 2 }, SD: { etf: 0, income: 0, bonds: 0, models: 0, fees: 0 } };
const TREND_TOPICS = { etf: ['etf', 'passive', 'index'], income: ['retiree', 'retirement income', 'reliable income', 'dividend'], bonds: ['bond', 'fixed income', 'rates'], models: ['model portfolio', 'model portfolios', 'core-satellite', 'core satellite'], fees: ['fee', 'cost', 'expense'] };
const TREND_NAMES = { etf: 'ETF and index interest', income: 'Retirement income', bonds: 'Core bonds and fixed income', models: 'Model portfolios and core-satellite', fees: 'Fee scrutiny' };

/* Scoped, sourced memory records (semantic memory). access: 'shared' | 'relationship' | 'owner:EMP-…' */
const MEMORY = [
  { id: 'MEM-011', adv: 'ADV-101', cat: 'content_pref', scope: 'BU-101A', attr: 'Committee materials format', value: 'One page, data first, no decks', src: 'CALL-0922', speaker: 'Alex Rivera', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-012', adv: 'ADV-101', cat: 'communication_pref', scope: 'advisor', attr: 'Meetings', value: '30-min Teams video, 7:30 a.m. PT, Tuesdays or Thursdays; book through Jamie Cho', src: 'EMAIL-0719', speaker: 'Jamie Cho (for Alex)', basis: 'Direct statement from his team', rev: 1, access: 'shared' },
  { id: 'MEM-013', adv: 'ADV-101', cat: 'communication_pref', scope: 'FIRM-MS', attr: 'Delivery method', value: 'Send approved PDFs as attachments; firm blocks external content links', src: 'CASE-00481', speaker: 'Jamie Cho', basis: 'Verified service case', rev: 1, access: 'shared' },
  { id: 'MEM-014', adv: 'ADV-101', cat: 'priority', scope: 'BU-101A', attr: 'Current decision', value: 'Keep or replace GFA in the new growth model; committee Oct 1', src: 'CALL-0922', speaker: 'Alex Rivera', basis: 'Direct advisor statement', rev: 1, access: 'shared', reviewBy: '2026-10-02' },
  { id: 'MEM-015', adv: 'ADV-101', cat: 'personal', scope: 'advisor', attr: 'Interests', value: 'Marathon runner; training for the California International Marathon in December', src: 'CALL-0814', speaker: 'Alex Rivera', basis: 'Direct advisor statement', rev: 1, access: 'relationship' },
  { id: 'MEM-016', adv: 'ADV-101', cat: 'coaching', scope: 'advisor', attr: 'Coaching note', value: 'Lead with numbers; Alex disengages when pitched', src: 'COACH-07', speaker: 'Priya Shah', basis: 'Private coaching', rev: 1, access: 'owner:EMP-PRIYA' },
  { id: 'MEM-017', adv: 'ADV-101', cat: 'content_pref', scope: 'BU-101A', attr: 'Fee presentation', value: 'Show fees in dollars on his assets, not only percentages', src: 'CALL-0922', speaker: 'Alex Rivera', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-021', adv: 'ADV-102', cat: 'relationship', scope: 'advisor', attr: 'Buying units', value: 'Participates in the retirement committee and the wealth team', src: 'Salesforce', speaker: 'System of record', basis: 'System of record', rev: 1, access: 'shared' },
  { id: 'MEM-023', adv: 'ADV-102', cat: 'communication_pref', scope: 'BU-102R', attr: 'Contact channel', value: 'For committee preparation, contact by email', src: 'EMAIL-0811', speaker: 'Maya Chen', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-024', adv: 'ADV-102', cat: 'priority', scope: 'BU-102R', attr: 'Current priority', value: 'Reviewing the committee’s fee-comparison process this quarter', src: 'CALL-0901', speaker: 'Maya Chen', basis: 'Direct advisor statement', rev: 1, access: 'shared', reviewBy: '2026-12-31' },
  { id: 'MEM-026', adv: 'ADV-102', cat: 'priority', scope: 'BU-102R', attr: 'Committee objective', value: 'Document a prudent, repeatable fee review in the Nov 12 committee minutes', src: 'CALL-0919', speaker: 'Maya Chen', basis: 'Direct advisor statement', rev: 1, access: 'shared', reviewBy: '2026-11-12' },
  { id: 'MEM-027', adv: 'ADV-102', cat: 'priority', scope: 'BU-102R', attr: 'Committee concern', value: 'Why the active growth option costs more than the growth index option beside it', src: 'CALL-0919', speaker: 'Maya Chen', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-028', adv: 'ADV-102', cat: 'content_pref', scope: 'BU-102R', attr: 'Fee comparison basis', value: 'Compare each option with its Morningstar category median, in dollars and basis points', src: 'CALL-0919', speaker: 'Maya Chen', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-031', adv: 'ADV-103', cat: 'communication_pref', scope: 'advisor', attr: 'Contact channel', value: 'Prefers phone calls, afternoons', src: 'CALL-0910', speaker: 'Jordan Patel', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-032', adv: 'ADV-103', cat: 'priority', scope: 'BU-103', attr: 'Focus', value: 'Income and dividend strategies for retirees', src: 'CALL-0910', speaker: 'Jordan Patel', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-041', adv: 'ADV-104', cat: 'priority', scope: 'BU-104', attr: 'Current priority', value: 'Moving core allocations toward ETFs this year', src: 'CALL-0915', speaker: 'Sofia Martinez', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-051', adv: 'ADV-105', cat: 'priority', scope: 'BU-105', attr: 'Current priority', value: 'Lower-cost model portfolios with a core-satellite structure', src: 'CALL-0918', speaker: 'Daniel Kim', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-061', adv: 'ADV-106', cat: 'priority', scope: 'BU-106', attr: 'Current priority', value: 'Reliable income for retirees; reviewing balanced and bond funds', src: 'CALL-0923', speaker: 'Rachel Okafor', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-071', adv: 'ADV-107', cat: 'priority', scope: 'BU-107', attr: 'Current priority', value: 'Adding fixed income as rates settle; watching fees', src: 'EMAIL-0925', speaker: 'Luis Herrera', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-025', adv: 'ADV-102', cat: 'personal', scope: 'advisor', attr: 'Interests', value: 'Serves on a local nonprofit board; plays tennis on weekends', src: 'Priya’s notes', speaker: 'Maya Chen', basis: 'Relationship note', rev: 1, access: 'relationship' },
  { id: 'MEM-033', adv: 'ADV-103', cat: 'personal', scope: 'advisor', attr: 'Interests', value: 'Golfer; talks often about his grandchildren', src: 'Sam’s notes', speaker: 'Jordan Patel', basis: 'Relationship note', rev: 1, access: 'relationship' },
  { id: 'MEM-043', adv: 'ADV-104', cat: 'personal', scope: 'advisor', attr: 'Interests', value: 'Trail runner; joined Morgan Stanley two years ago', src: 'Priya’s notes', speaker: 'Sofia Martinez', basis: 'Relationship note', rev: 1, access: 'relationship' },
  { id: 'MEM-052', adv: 'ADV-105', cat: 'personal', scope: 'advisor', attr: 'Interests', value: 'Many clients in film and TV; plays pickup basketball', src: 'Priya’s notes', speaker: 'Daniel Kim', basis: 'Relationship note', rev: 1, access: 'relationship' },
  { id: 'MEM-053', adv: 'ADV-105', cat: 'content_pref', scope: 'BU-105', attr: 'Review cadence', value: 'Reviews satellite funds every quarter', src: 'CALL-0826', speaker: 'Daniel Kim', basis: 'Direct advisor statement', rev: 1, access: 'shared' },
  { id: 'MEM-062', adv: 'ADV-106', cat: 'personal', scope: 'advisor', attr: 'Interests', value: 'Volunteers with a financial literacy program in Pasadena', src: 'Priya’s notes', speaker: 'Rachel Okafor', basis: 'Relationship note', rev: 1, access: 'relationship' },
  { id: 'MEM-072', adv: 'ADV-107', cat: 'personal', scope: 'advisor', attr: 'Interests', value: 'Sails out of Long Beach', src: 'Sam’s notes', speaker: 'Luis Herrera', basis: 'Relationship note', rev: 1, access: 'relationship' },
  { id: 'MEM-042', adv: 'ADV-104', cat: 'communication_pref', scope: 'advisor', attr: 'Contact channel', value: 'Email first; usually replies in the evening', src: 'Salesforce', speaker: 'Activity pattern', basis: 'Observed pattern', rev: 1, access: 'shared' }
];
/* Products each advisor holds, uses or is weighing (from Salesforce holdings and recorded calls) */
const ADVISOR_PRODUCTS = {
  'ADV-101': [{ fund: 'GFFFX', rel: 'Holds ~$38M in legacy accounts', src: 'Salesforce holdings' }, { fund: 'VIGAX', rel: 'Weighing as an index core', src: 'CALL-0922' }, { fund: 'VWUAX', rel: 'Comparing against GFA', src: 'CALL-0922' }],
  'ADV-102': [{ fund: 'GFFFX', rel: 'Large-cap growth (active) option, PLAN-102', src: 'Salesforce plan record' }, { fund: 'VIGAX', rel: 'Large-cap growth (index) option, PLAN-102', src: 'Salesforce plan record' }, { fund: 'AMBFX', rel: 'Balanced option, PLAN-102', src: 'Salesforce plan record' }, { fund: 'ABNFX', rel: 'Core bond option, PLAN-102', src: 'Salesforce plan record' }],
  'ADV-103': [{ fund: 'AMECX', rel: 'Core income holding for retirees', src: 'Salesforce holdings' }, { fund: 'AWSHX', rel: 'Holds for dividend growth', src: 'Salesforce holdings' }],
  'ADV-104': [{ fund: 'GFFFX', rel: 'Satellite in two model portfolios', src: 'Salesforce holdings' }],
  'ADV-105': [{ fund: 'GFFFX', rel: 'Active satellite in client models', src: 'CALL-0826' }, { fund: 'VIGAX', rel: 'Index core in client models', src: 'CALL-0826' }],
  'ADV-106': [{ fund: 'AMBFX', rel: 'Reviewing for retiree income', src: 'CALL-0923' }, { fund: 'ABNFX', rel: 'Reviewing for retiree income', src: 'CALL-0923' }],
  'ADV-107': [{ fund: 'ABNFX', rel: 'Considering as core bond', src: 'EMAIL-0925' }]
};
/* Things the foundation knows it does NOT know yet (shown on purpose) */
const UNKNOWNS = {
  'ADV-102': ['Ongoing committee-pack format for BU-102R: not confirmed', 'Any format preference for the wealth team (BU-102W): none recorded'],
  'ADV-104': ['Whether Sofia wants Capital Group ETF material specifically: not stated']
};

/* Episodes: call transcripts and emails in Salesforce (episodic memory) */
const EPISODES = [
  { id: 'CALL-0922', adv: 'ADV-101', scope: 'BU-101A', date: 'Sep 22, 2026', kind: 'Call transcript', with: 'Priya Shah',
    text: 'Alex asked for (1) a fee comparison of GFA against the Vanguard growth funds, (2) options for his growth sleeve, (3) why GFA has trailed. Alex: "Going forward, send me one page, data first. No decks." Alex: "Show me the fees in dollars on my $38 million." Committee meets Thursday Oct 1.' },
  { id: 'CALL-0814', adv: 'ADV-101', scope: 'BU-101A', date: 'Aug 14, 2026', kind: 'Call transcript', with: 'Priya Shah',
    text: 'Quarterly review. Alex is launching a new discretionary growth model this quarter. Mentioned he is training for the California International Marathon.' },
  { id: 'EMAIL-0719', adv: 'ADV-101', scope: 'advisor', date: 'Jul 19, 2026', kind: 'Email', with: 'Jamie Cho',
    text: 'Jamie: "Alex prefers 30-minute Teams calls at 7:30 a.m. Pacific, Tuesdays or Thursdays. Please book through me."' },
  { id: 'EMAIL-0928', adv: 'ADV-102', scope: 'BU-102R', date: 'Sep 28, 2026', kind: 'Email', with: 'Priya Shah',
    text: 'Elena Park (for Maya): "Committee materials go to members on November 5 for the November 12 meeting. Maya wants to review a draft first."' },
  { id: 'CALL-0919', adv: 'ADV-102', scope: 'BU-102R', date: 'Sep 19, 2026', kind: 'Call transcript', with: 'Priya Shah',
    text: 'Maya: "For November 12 the committee wants a prudent fee review documented in the minutes." Maya: "Compare every option with its Morningstar category median, in dollars as well as basis points." Two committee members asked why the active growth option costs more than the growth index option beside it. She still wants the benchmark question from September answered.' },
  { id: 'CALL-0901', adv: 'ADV-102', scope: 'BU-102R', date: 'Sep 1, 2026', kind: 'Call transcript', with: 'Priya Shah',
    text: 'Maya: "This quarter we are reviewing how the committee compares fees." Asked how to interpret the fee-comparison basis and what the benchmark represents.' },
  { id: 'EMAIL-0811', adv: 'ADV-102', scope: 'BU-102R', date: 'Aug 11, 2026', kind: 'Email', with: 'Priya Shah',
    text: 'Maya: "For anything to do with committee preparation, please email me rather than calling."' },
  { id: 'CALL-0910', adv: 'ADV-103', scope: 'BU-103', date: 'Sep 10, 2026', kind: 'Call transcript', with: 'Sam Lee',
    text: 'Jordan: "Call me in the afternoons; I do not read long emails." Focus on income and dividend strategies for retirees.' },
  { id: 'CALL-0915', adv: 'ADV-104', scope: 'BU-104', date: 'Sep 15, 2026', kind: 'Call transcript', with: 'Priya Shah',
    text: 'Sofia: "We are moving more of our core allocations to ETFs this year." Asked what active managers still add in a core-satellite setup.' },
  { id: 'CALL-0918', adv: 'ADV-105', scope: 'BU-105', date: 'Sep 18, 2026', kind: 'Call transcript', with: 'Priya Shah',
    text: 'Daniel: "Clients keep asking about ETFs versus active funds." Wants model portfolio options with a lower blended cost. Asked for a core-satellite example.' },
  { id: 'CALL-0923', adv: 'ADV-106', scope: 'BU-106', date: 'Sep 23, 2026', kind: 'Call transcript', with: 'Priya Shah',
    text: 'Rachel: "My retirees want reliable income, and I am reviewing balanced and bond funds for them." Asked how American Balanced and The Bond Fund of America fit an income plan.' },
  { id: 'EMAIL-0925', adv: 'ADV-107', scope: 'BU-107', date: 'Sep 25, 2026', kind: 'Email', with: 'Sam Lee',
    text: 'Luis: "We are adding more fixed income as rates settle. Send me your core bond story, and keep an eye on fees."' },
  { id: 'CALL-0826', adv: 'ADV-105', scope: 'BU-105', date: 'Aug 26, 2026', kind: 'Call transcript', with: 'Sam Lee',
    text: 'Daniel moved two client models to a core-satellite structure with an index core. Wants to review the satellite funds each quarter.' }
];

/* Durable commitments (workflow state, not memory) */
const COMMITMENTS = [
  { id: 'TASK-301', adv: 'ADV-101', scope: 'BU-101A', title: 'Send quarterly attribution in the one-page format', owner: 'Priya Shah', due: 'Jan 8, 2027', status: 'Open' },
  { id: 'TASK-302', adv: 'ADV-102', scope: 'BU-102R', title: 'Clarify what the benchmark represents', owner: 'Product specialist', due: 'Before next committee', status: 'Open' },
  { id: 'TASK-303', adv: 'ADV-104', scope: 'BU-104', title: 'Follow up on the role of active managers in her core-satellite model', owner: 'Priya Shah', due: 'Oct 9, 2026', status: 'Open' }
];

const CASES = [
  { id: 'CASE-00517', adv: 'ADV-101', status: 'Open', opened: 'Sep 29, 2026', owner: 'Kim Nguyen', text: 'Opened from Jamie Cho’s call INT-7731: Alex can’t open the link in Priya’s Sep 28 email (Seismic LiveSend LS-0928, fund comparison one-pager). Category: access and delivery.' },
  { id: 'CASE-00481', adv: 'ADV-101', status: 'Resolved', opened: 'Jul 2026', owner: 'Kim Nguyen', text: 'Link to OP-0922 blocked by Morgan Stanley email security; same approved version resent as PDF. Root cause: the firm’s web gateway blocks external file-sharing links.' },
  { id: 'CASE-00502', adv: 'ADV-102', status: 'Resolved', text: 'Packet access restored. Benchmark explanation still unclear to Maya (tracked as TASK-302).' }
];

const OPPORTUNITIES = [
  { id: 'OPP-504', adv: 'ADV-105', scope: 'BU-105', name: 'Kim Group model refresh', stage: 'Discovery', note: 'Lower blended cost; core-satellite models' },
  { id: 'OPP-505', adv: 'ADV-106', scope: 'BU-106', name: 'Okafor income sleeve', stage: 'Discovery', note: 'Balanced and bond funds for retirees' },
  { id: 'OPP-506', adv: 'ADV-107', scope: 'BU-107', name: 'Harbor Point core bond', stage: 'Qualified', note: 'Adding fixed income as rates settle' },
  { id: 'OPP-501', adv: 'ADV-101', scope: 'BU-101A', name: 'Rivera growth model', stage: 'Proposal', note: 'Deciding whether GFA stays in the growth sleeve' },
  { id: 'OPP-502', adv: 'ADV-102', scope: 'BU-102R', name: 'Northstar retirement menu review', stage: 'Discovery', note: 'Committee reviewing fee comparisons for PLAN-102 before the Nov 12 meeting' },
  { id: 'OPP-503', adv: 'ADV-104', scope: 'BU-104', name: 'Martinez core allocation', stage: 'Discovery', note: 'Moving core to ETFs' }
];

/* Retirement plans an advisor's committee oversees (Salesforce plan record). Plan and assets are fictional. */
const PLANS = {
  'PLAN-102': { adv: 'ADV-102', unit: 'BU-102R', name: 'Irvine Precision Manufacturing 401(k) Plan', assets_usd: 62000000, participants: 540,
    committee: 'Five-member investment committee; Northstar Advisory (Maya Chen) advises; Elena Park coordinates materials', next_meeting: 'Nov 12, 2026', materials_due: 'Nov 5, 2026',
    lineup: [
      { option: 'Large-cap growth (active)', fund: 'GFFFX', assets_usd: 18500000, category: 'Large Growth' },
      { option: 'Large-cap growth (index)', fund: 'VIGAX', assets_usd: 9000000, category: 'Large Growth' },
      { option: 'Balanced', fund: 'AMBFX', assets_usd: 14200000, category: 'Moderate Allocation' },
      { option: 'Core bond', fund: 'ABNFX', assets_usd: 6800000, category: 'Intermediate Core Bond' }],
    other: { label: 'Target-date series and stable value', assets_usd: 13500000, note: 'Expense data not in reference data' } }
};
/* Coverage changes between wholesalers (Salesforce) */
const HANDOVERS = [
  { id: 'HO-101', adv: 'ADV-101', from: 'EMP-PRIYA', to: 'EMP-SAM', effective: 'Oct 1, 2026', src: 'Salesforce coverage change, Sep 24, 2026',
    note: 'Sam Lee becomes primary coverage for Alex Rivera as Priya Shah rebalances her book toward San Diego. Priya stays on the account through the Oct 1 committee to hand over; her call notes and commitments carry over.' }
];

/* Genesys Cloud: advisor contacts with the service center */
const INTERACTIONS = [
  { id: 'INT-7731', adv: 'ADV-101', when: 'Sep 29, 2026, 8:14 a.m. PT', channel: 'Phone, advisor service line', caller: 'Jamie Cho, for Alex Rivera', handled_by: 'Kim Nguyen', case: 'CASE-00517',
    summary: 'Alex tried the link in Priya’s Sep 28 email three times from the office and got a grey page: “This site is blocked by your organization’s security policy.” It opened on his personal phone, but he can’t forward from there.',
    sentiment: 'Mildly frustrated; his committee meets Thursday' }
];
/* Seismic LiveSend: delivery and link activity for content sent to advisors */
const DELIVERIES = [
  { id: 'LS-0928', adv: 'ADV-101', sent: 'Sep 28, 2026, 4:12 p.m. PT', from: 'Priya Shah', to: 'Alex Rivera (cc Jamie Cho)', asset: 'SEIS-110', title: 'Fund comparison one-pager',
    email: 'Delivered; opened 3 times', link_status: 'Active', link_expires: 'Oct 28, 2026', recipient_access: 'Permitted: Alex Rivera and Jamie Cho are on the recipient list',
    link_events: ['Sep 28, 4:31 p.m.: click from the Morgan Stanley network, stopped at the firm’s web gateway (category: file sharing)', 'Sep 29, 8:02 a.m.: same', 'Sep 29, 8:05 a.m.: same', 'Sep 29, 7:48 p.m.: opened from a mobile carrier network'],
    content_views: 1 }
];
/* Genesys + Service Cloud, aggregated by topic; never advisor identifiers */
const SERVICE_INSIGHTS = {
  fees: { period: 'Q3 2026 (Jul 1 to Sep 28)', source: 'Genesys Cloud contact reasons and Service Cloud cases, aggregated; no advisor identifiers', contacts_this_quarter: 46, contacts_last_quarter: 27,
    top_questions: ['Why does the expense ratio on a client statement differ from the fact sheet? (usually the share class)', 'What is the cost difference between F-2 and Class A shares?', 'How do I show a client what a fee costs in dollars, not just percent?', 'Where is the current prospectus expense ratio published?'],
    takeaway: 'Advisors ask how to explain fees to clients, not whether fees are too high.' },
  access: { period: 'Q3 2026', source: 'Service Cloud cases, aggregated', contacts_this_quarter: 9, takeaway: 'Link-access cases come from firms whose web gateways block external file-sharing links; a PDF attachment resolves them.' }
};
/* Salesforce Marketing Cloud: how past fee content performed */
const ENGAGEMENT = {
  fees: [
    { name: 'Fee transparency email (SEIS-115), Q2', audience: 'Financial professionals', open_rate_pct: 41, click_rate_pct: 6.2 },
    { name: 'LinkedIn fee-education posts, Q1 to Q3', audience: 'Public', best_post: 'What a fee costs in dollars', engagement_rate_pct: 3.8, average_engagement_rate_pct: 1.6, takeaway: 'Posts that showed a fee in dollars outperformed percent-only posts.' }]
};
/* Adobe Experience Manager: published, approved web pages that posts may link to */
const AEM_PAGES = [
  { id: 'AEM-FEES', title: 'Understanding fund expenses', path: '/advisor/insights/understanding-fund-expenses', status: 'Published', audience: 'Public', last_reviewed: 'Aug 2026', tags: 'fees expenses expense ratio share class transparency' },
  { id: 'AEM-CAPSYS', title: 'How The Capital System works', path: '/advisor/insights/capital-system', status: 'Published', audience: 'Public', last_reviewed: 'Jun 2026', tags: 'capital system active managers' }
];
/* Seismic messaging library: approved language, cited by id */
const APPROVED_LANGUAGE = [
  { id: 'MSG-201', topic: 'fees', text: 'Costs matter. We show what each share class costs, in dollars as well as percentages, so there are no surprises.', use: 'Social, email, presentations' },
  { id: 'MSG-202', topic: 'fees', text: 'A lower fee is one input. What you get for the fee (the approach, the people, the long-term results) is the rest of the story.', use: 'Advisor-facing' },
  { id: 'MSG-203', topic: 'fees', text: 'Ask for the expense ratio, the share class and the as-of date. All three belong in any fee comparison.', use: 'Social, education' },
  { id: 'MSG-211', topic: 'active index', text: 'Active and index funds do different jobs. An index fund aims to match its benchmark; an active fund aims to do something different, so it will lead and lag at different times.', use: 'Advisor-facing' },
  { id: 'MSG-212', topic: 'active index capital system', text: 'The Capital System divides each portfolio among several managers who invest independently, so no single view dominates.', use: 'Advisor-facing, investor' },
  { id: 'MSG-213', topic: 'active index performance benchmark', text: 'Judge a fund over a full market cycle and against the benchmark it is managed to, not a single period or a different index.', use: 'Advisor-facing' }
];
/* SharePoint compliance library: disclosures and rules by channel */
const DISCLOSURES = {
  email: { required: ['Past results are not predictive of results in future periods.', 'Expense ratios are as of each fund’s prospectus.', 'Indexes are unmanaged; investors cannot invest directly in an index.', 'For financial professional use only.'], rules: ['Attach approved PDFs where the firm blocks links.', 'No performance figures unless inserted from the system of record at approval (POL-3).'] },
  social: { required: ['Investing involves risk, including loss of principal.', 'Expense ratios are as of each fund’s current prospectus.', 'Educational content, not investment advice.'],
    rules: ['Public audience: no advisor, firm or client names (POL-8).', 'Name the share class whenever an expense ratio appears.', 'No performance figures, rankings, ratings or forecasts.', 'Fee claims use approved messaging (MSG- ids); no new claims.', 'Link only to a published, approved page.', 'Disclosures go in the post itself, not in a comment.'] },
  committee: { required: ['Past results are not predictive of results in future periods.', 'Expense ratios are as of each fund’s prospectus; share class shown.', 'Category medians are Morningstar data as of the date shown.', 'For financial professional and plan sponsor use only.'], rules: ['Show each option’s share class and as-of date.', 'Name the comparison category and data source.'] }
};

/* Fund facts: the only source of fund numbers. null = not in reference data. */
const FUNDS = {
  GFFFX: { name: 'The Growth Fund of America, Class F-2', family: 'Capital Group', er: 0.40, mgmt: 0.25, other: 0.15, bench: 'S&P 500', approach: 'Active, multi-manager (The Capital System); 282 issuers; up to 25% outside the U.S. (10.8% non-U.S. equities)', asOf: '8/31/26', src: 'capitalgroup.com fund page; prospectus 11/1/25', verified: true },
  AGTHX: { name: 'The Growth Fund of America, Class A', family: 'Capital Group', er: 0.59, bench: 'S&P 500', approach: 'Same portfolio as F-2; sales charge may apply', asOf: '8/31/26', src: 'capitalgroup.com fund page', verified: true },
  VWUAX: { name: 'Vanguard U.S. Growth Fund Admiral Shares', family: 'Vanguard', er: 0.25, bench: 'Russell 1000 Growth', approach: 'Active, multi-manager (Wellington, Baillie Gifford, Jennison)', asOf: '8/31/26', src: 'investor.vanguard.com', verified: true },
  VIGAX: { name: 'Vanguard Growth Index Fund Admiral Shares', family: 'Vanguard', er: 0.05, bench: 'CRSP US Large Cap Growth', approach: 'Index; about 166 stocks; top three holdings roughly a third of assets', asOf: 'latest', src: 'investor.vanguard.com', verified: true },
  ABNFX: { name: 'The Bond Fund of America, Class F-2', family: 'Capital Group', er: 0.34, bench: 'Bloomberg U.S. Aggregate', category: 'Intermediate Core Bond', approach: 'Active, multi-manager core bond; managers run sleeves against the Aggregate index', asOf: 'Apr 2026', src: 'Morningstar prospectus-adjusted expense ratio', verified: true },
  ABNDX: { name: 'The Bond Fund of America, Class A', family: 'Capital Group', er: 0.59, bench: 'Bloomberg U.S. Aggregate', category: 'Intermediate Core Bond', approach: 'Same portfolio as F-2; sales charge may apply', asOf: 'Apr 2026', src: 'Morningstar prospectus-adjusted expense ratio', verified: true },
  AMBFX: { name: 'American Balanced Fund, Class F-2', family: 'Capital Group', er: 0.35, bench: '60% S&P 500 / 40% Bloomberg U.S. Aggregate', category: 'Moderate Allocation', approach: 'Active balanced: at least 50% stocks (mostly dividend payers) and at least 25% bonds; multi-manager', asOf: 'Apr 2026', src: 'Morningstar prospectus-adjusted expense ratio', verified: true },
  AWSHX: { name: 'Washington Mutual Investors Fund', family: 'Capital Group', er: null, bench: 'S&P 500', approach: 'Active growth-and-income', asOf: null, src: 'Expense ratio not in reference data', verified: false },
  ABALX: { name: 'American Balanced Fund, Class A', family: 'Capital Group', er: null, bench: '60% S&P 500 / 40% Bloomberg U.S. Aggregate', category: 'Moderate Allocation', approach: 'Same portfolio as F-2; sales charge may apply', asOf: null, src: 'Class A expense ratio not in reference data', verified: false },
  AMECX: { name: 'The Income Fund of America', family: 'Capital Group', er: null, bench: 'Blended equity/bond index', approach: 'Active income-focused', asOf: null, src: 'Expense ratio not in reference data', verified: false }
};
const PEERS = {
  'Large Growth': { medianEr: 0.75, note: 'Morningstar Large Cap No Load median expense ratio, as of 6/30/26', peers: ['VWUAX', 'VIGAX'] },
  'Moderate Allocation': { medianEr: 0.9, note: 'Morningstar US Moderate Allocation category median fee', peers: ['AMBFX'] },
  'Intermediate Core Bond': { medianEr: 0.46, note: 'Morningstar US Intermediate Core Bond category median fee', peers: ['ABNFX'] }
};
/* What people actually call the funds */
const FUND_ALIASES = { gfa: 'GFFFX', 'growth fund of america': 'GFFFX', 'growth fund': 'GFFFX', bfa: 'ABNFX', 'bond fund of america': 'ABNFX', 'bond fund': 'ABNFX', ambal: 'AMBFX', 'american balanced': 'AMBFX', 'balanced fund': 'AMBFX', wmif: 'AWSHX', 'washington mutual': 'AWSHX', ifa: 'AMECX', 'income fund of america': 'AMECX', vwuax: 'VWUAX', 'vanguard u.s. growth': 'VWUAX', vigax: 'VIGAX', 'growth index': 'VIGAX' };
const ALPHA = { 'ADV-101': { score: 92, note: 'Top decile growth-sleeve opportunity' }, 'ADV-102': { score: 71, note: 'Mid: retirement menu review' }, 'ADV-103': { score: 64, note: 'Mid: income focus' }, 'ADV-104': { score: 88, note: 'High: core allocation shift' } };

/* Seismic content */
const CONTENT = [
  { id: 'SEIS-110', title: 'Fund comparison one-pager', audience: 'Financial professional', format: '1 page', status: 'Approved', tags: 'comparison fees one-page gfa vanguard' },
  { id: 'SEIS-111', title: 'GFA product presentation', audience: 'Financial professional', format: '12 pages', status: 'Approved', tags: 'gfa deck presentation' },
  { id: 'SEIS-112', title: 'GFA fact sheet', audience: 'Investor (retail)', format: '2 pages', status: 'Approved', tags: 'gfa fact sheet' },
  { id: 'SEIS-113', title: 'GFA quarterly attribution report (9/26)', audience: 'Financial professional', format: '4 pages', status: 'Approved', tags: 'gfa attribution performance why trailed' },
  { id: 'SEIS-114', title: 'The Capital System explainer', audience: 'Financial professional and investor', format: '2 pages', status: 'Approved', tags: 'capital system managers active' },
  { id: 'SEIS-115', title: 'Fee transparency email template', audience: 'Financial professional', format: 'Email', status: 'Approved', tags: 'email fees transparency template' },
  { id: 'SEIS-116', title: 'Retirement committee pack template', audience: 'Plan committee', format: '2 pages + appendix', status: 'Approved', tags: 'retirement committee pack benchmark' },
  { id: 'SEIS-117', title: 'Core-satellite: where active management fits', audience: 'Financial professional', format: '3 pages', status: 'Approved', tags: 'core satellite active passive etf index' },
  { id: 'SEIS-118', title: 'LinkedIn post template: fee disclosure education', audience: 'Public', format: 'Social post', status: 'Approved', tags: 'linkedin public fees education' },
  { id: 'SEIS-119', title: 'Income strategies for retirees', audience: 'Financial professional', format: '4 pages', status: 'Approved', tags: 'income dividend retirees' },
  { id: 'SEIS-120', title: 'Capital Group ETF lineup overview', audience: 'Financial professional', format: '2 pages', status: 'Approved', tags: 'etf lineup capital group etfs' },
  { id: 'SEIS-121', title: 'The Bond Fund of America: core bond story', audience: 'Financial professional', format: '2 pages', status: 'Approved', tags: 'bfa bond fund core fixed income rates' },
  { id: 'SEIS-122', title: 'American Balanced Fund overview', audience: 'Financial professional', format: '2 pages', status: 'Approved', tags: 'ambal balanced fund income retirees 60/40' },
  { id: 'SEIS-123', title: 'Balanced vs. bond funds in a retirement income plan', audience: 'Financial professional', format: '1 page', status: 'Approved', tags: 'comparison balanced bond income retirement bfa ambal' }
];

/* Verified findings already in the foundation (reusable) */
const FINDINGS = [
  { id: 'K-201', label: 'Why GFA has trailed the Vanguard large-growth funds', value: 'Different mandates: GFA is benchmarked to the S&P 500 and invests flexibly (282 issuers, some non-U.S.); the growth index holds roughly a third in three stocks, so it leads when a few mega-caps lead; and GFA F-2 costs 0.35 points more a year than VIGAX.', by: 'product.qar', evidence: ['GFFFX', 'VIGAX', 'SEIS-113'], date: 'Sep 22, 2026' }
];

const POLICIES = [
  { id: 'POL-1', text: 'Nothing is sent outside Capital Group without human approval of the exact payload.' },
  { id: 'POL-2', text: 'Fund numbers come only from the data platform or licensed data, never from generated text.' },
  { id: 'POL-3', text: 'Performance is standardized and inserted from the system of record at approval.' },
  { id: 'POL-4', text: 'Personal notes are for the relationship team only and never appear in client-facing content.' },
  { id: 'POL-5', text: 'Private coaching is visible only to its owner.' },
  { id: 'POL-6', text: 'An employee’s request is not an advisor preference. Lasting preferences need a direct advisor statement.' },
  { id: 'POL-7', text: 'Preferences apply only to the buying unit or scope they were stated for.' },
  { id: 'POL-8', text: 'Public content never includes advisor or client identifiers.' }
];

/* Who hears which event */
const SUBSCRIPTIONS = {
  'knowledge.published': ['sales.prep', 'marketing.copy', 'sales.engage', 'service.knowledge'],
  'memory.committed': ['sales.prep', 'marketing.email', 'sales.schedule', 'marketing.audience'],
  'memory.pending': ['marketing.voc'],
  'commitment.created': ['sales.follow'],
  'content.drafted': ['marketing.legal', 'marketing.dist'],
  'approval.requested': ['marketing.dist'],
  'content.revised': ['marketing.legal', 'marketing.dist']
};
