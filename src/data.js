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
  sales: ['Identify the growing trends in LA territory', 'Compare BFA and AMBAL for Rachel and schedule a meeting with her next month', 'Prep me for my call with Alex tomorrow', 'What does Maya care about for her retirement committee?', 'Sofia mentioned ETFs. What should I bring to our next meeting?', 'Alex said on today’s call he wants the numbers in an appendix from now on. Update his profile.'],
  product: ['Compare BFA and AMBAL: costs, approach and who each suits', 'Why has GFA trailed the Vanguard growth index? I need an explanation advisors can use.', 'Compare GFA F-2 costs with VWUAX and VIGAX on $38M', 'Check whether our fee comparison for Maya is still current'],
  marketing: ['Draft the follow-up email to Alex using Product’s verified comparison', 'Create an ETF email campaign for Sofia', 'Write a LinkedIn post on fee transparency for advisors'],
  service: ['Alex says the link in Priya’s email won’t open', 'Maya says the benchmark explanation is still unclear']
};

/* The full registry of 37 specialists. tools = what each may call through the MCP or API gateway. */
const AGENTS = {
  'sales.lead': { name: 'Lead Me', team: 'sales', does: 'Prioritizes advisors and opportunities using model signals', tools: ['models.sales_alpha', 'models.territory_trends', 'crm.get_opportunities'] },
  'sales.schedule': { name: 'Schedule Me', team: 'sales', does: 'Finds meeting times for advisors or colleagues and places calendar holds', tools: ['calendar.find_times', 'calendar.create_event', 'crm.get_contact'] },
  'sales.prep': { name: 'Prep Me', team: 'sales', does: 'Builds meeting briefs and agendas from what is known about the advisor', tools: ['crm.get_call_notes', 'crm.get_opportunities', 'crm.get_contact'] },
  'sales.engage': { name: 'Engage Me', team: 'sales', does: 'Captures what advisors say in meetings and answers live questions', tools: ['crm.get_call_notes', 'crm.log_activity'] },
  'sales.follow': { name: 'Follow Me', team: 'sales', does: 'Logs outcomes, creates tasks and tracks commitments', tools: ['crm.log_activity', 'crm.create_task', 'crm.get_opportunities'] },
  'sales.coach': { name: 'Coach Me', team: 'sales', does: 'Private coaching for the wholesaler, never shared', tools: [] },
  'sales.territory': { name: 'Territory Planning', team: 'sales', does: 'Territory reviews: trends, coverage and business planning across advisors', tools: ['models.territory_trends', 'models.sales_alpha', 'crm.get_opportunities', 'crm.get_call_notes'] },
  'product.clarify': { name: 'Query Clarifier', team: 'product', does: 'Turns loose questions into precise, answerable ones (funds, share classes, periods)', tools: ['fund.get_facts', 'fund.lookup'] },
  'product.planner': { name: 'Research Planner', team: 'product', does: 'Decides what evidence is needed and where it comes from', tools: ['mstar.get_peers'] },
  'product.tools': { name: 'Tool Selection', team: 'product', does: 'Runs analytics: fee math, peer data, portfolio construction', tools: ['fund.get_facts', 'fund.lookup', 'models.cost_on_assets', 'models.portfolio_construction', 'mstar.get_peers'] },
  'product.summary': { name: 'Contact Summarizer', team: 'product', does: 'Summarizes the advisor context Product needs for a question', tools: [] },
  'product.tone': { name: 'Tone/Style Alignment', team: 'product', does: 'Aligns product answers to house style and audience', tools: [] },
  'product.format': { name: 'Response Formatter', team: 'product', does: 'Formats product answers for the channel', tools: [] },
  'product.qar': { name: 'QAR', team: 'product', does: 'Produces verified answers; every number traced to a system of record', tools: ['fund.get_facts', 'fund.lookup', 'fund.get_performance', 'mstar.get_peers', 'models.cost_on_assets', 'seismic.search_content'] },
  'product.institutional': { name: 'Institutional Pitch Books', team: 'product', does: 'Institutional product materials', tools: ['seismic.search_content'] },
  'product.srg': { name: 'SRG Product Pitch Books', team: 'product', does: 'Product pitch books for the retail advisor channel', tools: ['seismic.search_content'] },
  'marketing.gather': { name: 'Resource Gatherer', team: 'marketing', does: 'Finds approved content and templates in Seismic', tools: ['seismic.search_content'] },
  'marketing.analyze': { name: 'Document Analyzer', team: 'marketing', does: 'Extracts key points from approved documents', tools: ['seismic.search_content'] },
  'marketing.copy': { name: 'Copywriter / Editor', team: 'marketing', does: 'Writes drafts in the audience’s preferred format from verified findings', tools: [] },
  'marketing.audit': { name: 'Audit Support', team: 'marketing', does: 'Keeps the audit trail for published material', tools: [] },
  'marketing.legal': { name: 'Legal & Compliance', team: 'marketing', does: 'Reviews claims, performance presentation and disclosures', tools: ['sharepoint.get_disclosures'] },
  'marketing.image': { name: 'Image Analyzer', team: 'marketing', does: 'Checks charts and images in materials', tools: [] },
  'marketing.audience': { name: 'Audience Builder', team: 'marketing', does: 'Builds permitted audiences for campaigns', tools: ['models.sales_alpha', 'models.territory_trends', 'crm.get_contact'] },
  'marketing.dist': { name: 'Distribution', team: 'marketing', does: 'Prepares sends; nothing goes out without human approval', tools: ['mail.draft'] },
  'marketing.voc': { name: 'Voice of Client', team: 'marketing', does: 'Captures explicit advisor statements and feedback', tools: ['crm.get_call_notes'] },
  'marketing.linkedin': { name: 'LinkedIn Post', team: 'marketing', does: 'Drafts approved public posts with no client identifiers', tools: ['seismic.search_content'] },
  'marketing.email': { name: 'Personalized Email', team: 'marketing', does: 'Drafts personalized advisor emails', tools: ['mail.draft', 'seismic.search_content'] },
  'service.classify': { name: 'Inquiry Classifier', team: 'service', does: 'Classifies incoming advisor inquiries', tools: ['service.get_cases'] },
  'service.identity': { name: 'Identity Verifier', team: 'service', does: 'Verifies who is asking and what they may receive', tools: ['crm.get_contact'] },
  'service.priority': { name: 'Priority Scorer', team: 'service', does: 'Scores urgency with service rules', tools: ['service.get_cases'] },
  'service.knowledge': { name: 'Knowledge Retriever', team: 'service', does: 'Retrieves approved procedures and answers', tools: ['seismic.search_content'] },
  'service.account': { name: 'Account Lookup', team: 'service', does: 'Looks up the advisor’s account, deliveries and history', tools: ['crm.get_contact', 'service.get_cases'] },
  'service.resolve': { name: 'Resolve Me', team: 'service', does: 'Resolves access and delivery issues', tools: ['service.get_cases', 'service.update_case', 'seismic.export_pdf'] },
  'service.escalate': { name: 'Escalate Me', team: 'service', does: 'Escalates what it can’t resolve to an owner', tools: ['service.update_case'] },
  'service.sentiment': { name: 'Sentiment Analyzer', team: 'service', does: 'Reads explicit satisfaction signals', tools: [] },
  'service.crosssell': { name: 'Cross-sell Detector', team: 'service', does: 'Flags explicit needs for Sales, never infers', tools: [] },
  'service.qa': { name: 'QA Logger', team: 'service', does: 'Logs service quality outcomes', tools: [] }
};

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
  sf: { name: 'Salesforce', sub: 'CRM · Service Cloud · call transcripts', icon: 'users' },
  m365: { name: 'Microsoft 365', sub: 'Outlook · Calendar · SharePoint', icon: 'mail' },
  seismic: { name: 'Seismic', sub: 'Approved content', icon: 'book' },
  fund: { name: 'Data & model platform', sub: 'Fund facts · models', icon: 'chart' },
  mstar: { name: 'Morningstar', sub: 'Licensed peer data', icon: 'globe' }
};
const SYS_ORDER = ['sf', 'm365', 'seismic', 'fund', 'mstar'];

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
  'ADV-102': [{ fund: 'AMBFX', rel: 'On the retirement plan menu', src: 'Salesforce holdings' }, { fund: 'ABNFX', rel: 'On the retirement plan menu', src: 'Salesforce holdings' }],
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
  { id: 'EMAIL-0811', adv: 'ADV-102', scope: 'BU-102R', date: 'Aug 11, 2026', kind: 'Email', with: 'Priya Shah',
    text: 'Maya: "For anything to do with committee preparation, please email me rather than calling."' },
  { id: 'CALL-0901', adv: 'ADV-102', scope: 'BU-102R', date: 'Sep 1, 2026', kind: 'Call transcript', with: 'Priya Shah',
    text: 'Maya: "This quarter we are reviewing how the committee compares fees." Asked how to interpret the fee-comparison basis and what the benchmark represents.' },
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
  { id: 'CASE-00481', adv: 'ADV-101', status: 'Resolved', text: 'Link to OP-0922 blocked by Morgan Stanley email security; same approved version resent as PDF.' },
  { id: 'CASE-00502', adv: 'ADV-102', status: 'Resolved', text: 'Packet access restored. Benchmark explanation still unclear to Maya (tracked as TASK-302).' }
];

const OPPORTUNITIES = [
  { id: 'OPP-504', adv: 'ADV-105', scope: 'BU-105', name: 'Kim Group model refresh', stage: 'Discovery', note: 'Lower blended cost; core-satellite models' },
  { id: 'OPP-505', adv: 'ADV-106', scope: 'BU-106', name: 'Okafor income sleeve', stage: 'Discovery', note: 'Balanced and bond funds for retirees' },
  { id: 'OPP-506', adv: 'ADV-107', scope: 'BU-107', name: 'Harbor Point core bond', stage: 'Qualified', note: 'Adding fixed income as rates settle' },
  { id: 'OPP-501', adv: 'ADV-101', scope: 'BU-101A', name: 'Rivera growth model', stage: 'Proposal', note: 'Deciding whether GFA stays in the growth sleeve' },
  { id: 'OPP-502', adv: 'ADV-102', scope: 'BU-102R', name: 'Northstar retirement menu review', stage: 'Discovery', note: 'Committee reviewing fee comparisons' },
  { id: 'OPP-503', adv: 'ADV-104', scope: 'BU-104', name: 'Martinez core allocation', stage: 'Discovery', note: 'Moving core to ETFs' }
];

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
  'approval.requested': ['marketing.dist']
};
