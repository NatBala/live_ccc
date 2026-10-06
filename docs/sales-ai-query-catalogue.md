# Sales AI query catalogue

What users ask, how the request is decomposed, and which sub-agents run.

A wholesaler can ask about relationship history, changes in the advisor’s business, investment preferences, sales performance, dealer eligibility, retirement opportunities, relevant content and follow-up actions, all within the same conversation. The application is organized around **business intents, not keywords**. The word “ETF” can appear in five very different requests:

| Request | Intent | Plan (proposed for this app) |
|---|---|---|
| “Find ETF leads.” | prioritize | Territory.Health Check + [taxonomy] → Lead.Discover → Lead.Insights |
| “Explain this advisor’s ETF sales.” | diagnose | Lead.Insights + [flows] → Prep.Fact Check |
| “Check whether this ETF is available on the advisor’s platform.” | verify | Prep.Profile + Product.Research Planner + [platform eligibility] → Product.QAR |
| “Prepare an ETF discussion.” | prepare | Prep.Notes + Lead.Products → Prep.Content → Prep.Agenda |
| “Send the approved ETF material.” | execute | Prep.Content → Marketing.Distribution (a person approves the exact payload) |

Those requests need different plans, data and controls.

The catalogue below is a set of application requirements and example prompts, not a claim that every integration exists. The screenshots it was built from are dated, sometimes cropped snapshots; their product availability, amounts and statuses are not verified current facts.

## 1. Ground the catalogue in the information the application contains

| Information visible in the screenshots | What users should be able to ask |
|---|---|
| Meeting notes and investment preferences, including buying-unit context and dated statements (4491.jpg) | “How does this team invest?” “What did they tell us?” “What should I avoid repeating?” |
| CG assets, vehicle mix, industry-book information and market-share categories (4493.jpg, 4496.jpg) | “Where are we strong?” “What changed?” “Which category deserves further investigation?” |
| Sales and year-over-year changes by vehicle and business channel (4492.jpg) | “Why are total sales down while ETF sales are growing?” “Which segment explains the decline?” |
| Dealer and platform intelligence, including effective dates and availability (4499.jpg) | “What changed at Wells Fargo?” “Is this product available on this specific platform?” |
| Retirement-plan information and pipeline status (4503.jpg, 4497.jpg) | “Which plans should we review?” “What is still open?” “Why does the narrative conflict with the opportunity status?” |
| Recommended articles, agenda one-liners, recommendation reasons and references (4501.jpg, 4500.jpg) | “Why this article?” “Which three pieces are relevant to this meeting?” “What evidence supports the summary?” |

The system works from the underlying records behind these screens. It does not scrape its own generated summaries and treat them as authoritative data.

## 2. Separate intelligence from orchestration

### Intelligence: determine what the user actually wants

The intelligence layer produces a structured interpretation:

| Field | What it establishes |
|---|---|
| Subject | Advisor, buying unit, firm, territory, plan, opportunity, fund or document |
| Business intent | Retrieve, summarize, compare, diagnose, prioritize, prepare, verify, draft, execute, remember or monitor |
| Scope | Wealth versus retirement, assigned territory, dealer/platform, vehicle, audience |
| Time | Current as-of date, comparison period, last meeting or requested historical date |
| Constraints | Exclude certain vehicles; use approved content; do not send; keep to one page |
| Requested output | Answer, ranked list, comparison, agenda, brief, draft, task or alert configuration |
| Missing information | Only the questions that materially affect the answer or action |
| Action authority | Read-only, draft-only, proposed change, or an explicitly requested external action |

“Help me prepare” should not silently mean “book a meeting and send an email.”

### Orchestration: turn the interpretation into an executable plan

The orchestrator decides which sub-agents and tools run, which can run together, and which must wait for earlier results. For example:

```
Resolve advisor and buying unit
             ↓
Run independent reads in parallel:
    Notes + assets/flows + pipeline + dealer intelligence
             ↓
Check scope, dates, conflicts and missing data
             ↓
Select relevant topics and approved content
             ↓
Build the requested agenda
             ↓
Return the agenda, not an unsolicited email or CRM update
```

Every step returns its output, source references, as-of dates, unresolved issues and completion status.

### Route notation

`Prep.Notes` means Prep Me → Notes Summarizer.

| Agent | Sub-agents / skills |
|---|---|
| Prep Me | Profile, Notes, Content, Fact Check, Agenda, Themes, News |
| Lead Me | Discover (Self Service Leads), Insights (Insights Generator), Products (Product Recommender) |
| Territory Planning | Health Check, Calibration, Teaming, Reviews, Strategy, Business Planning |
| Schedule Me | Calendar, Email, Compliance, Zoning |
| Engage Me | Q&A, Recommendations, Capture, Scenario |
| Follow Me | Dictation, Tasks, Expenses |
| Coach Me | Simulation, Guide |
| Product specialists | Research Planner, Tool Selection, Response Formatter, QAR |
| Marketing specialists | Resource Gatherer, Document Analyzer, Editor, Audience Builder, Distribution |

Names in `[brackets]` are shared tools or services, such as `[flows]`, `[platform eligibility]` or `[memory]`. They are not additional autonomous agents.

## 3. The queries

The full catalogue, with the decomposition and route for each query, lives in `src/catalogue.js` and is browsable in the app’s **Catalogue** tab. Groups:

| Group | Queries | Note |
|---|---|---|
| A. Understand an advisor and prepare for a meeting | 1–8 | “Prepare me” should reuse a confirmed meeting context, not require the user to name every source or sub-agent. |
| B. Understand assets, flows and market share | 9–16 | Numerical aggregation comes from validated data tools; the model explains the result. |
| C. Identify leads and prioritize coverage | 17–24 | A page visit is an observed event; a model score is a signal; neither becomes “intends to buy.” |
| D. Verify products, dealer availability and model portfolios | 25–32 | Dealer-wide availability, platform availability and client suitability are separate questions. |
| E. Select and personalize content | 33–40 | “Relevant because of the advisor’s stated need” is different from “popular among other users.” |
| F. Retirement plans and pipeline | 41–48 | An old note about paperwork does not automatically reopen a closed opportunity. |
| G. Scheduling, territory planning and administration | 49–56 | Calendar, travel, expense and complete engagement data are integration dependencies. |
| H. In-meeting support and coaching | 57–58 | |

Queries 59 to 80 and the detailed walkthroughs of compound requests were not part of the material provided for this branch; add them to `CATALOGUE` in `src/catalogue.js` in the same shape.

## 4. How the application implements this

| Requirement | Where |
|---|---|
| Structured interpretation (eight fields) | The orchestrator emits an `interpretation` decision first; shown as the **Intelligence** card. Saved runs and fallbacks get one built from rules (`ruleInterpretation`). |
| Eleven business intents | `INTENTS` in `src/catalogue.js`; the orchestrator must pick one. |
| Action authority | Settled by rule from the request’s own words (`authorityFromText`), capped below whatever the AI asks for. Tools above it are removed at the gateway (`TOOL_ACT`). Under read-only authority, follow-ups are proposed, not created; the person can create them. |
| Sub-agent routes | `SUBAGENTS`; each task runs one route such as `Prep.Notes`. |
| Shared services | `SERVICES`, each marked **simulated** (demo data here), **foundation** (built in) or **not connected**. Every service in the catalogue now has simulated data; a service marked not connected would make its step report partial results instead of inventing them. |
| Data per sub-agent | `SUB_USES` lists the services each sub-agent reads by default (for example Lead.Insights reads assets, flows, transactions, pipeline, change events and the ranking trace). A planned step that names no data gets these. Shown in the Catalogue tab and in each agent’s details. |
| Parallel waves | A step’s wave is one after the latest step it depends on. Steps in a wave run concurrently; each wave’s output stays on screen for 5 seconds before the next wave. |
| Step contract | Every step shows status, sources, as-of dates and unresolved issues. |
| Catalogue-guided planning | The live planner sees the three closest catalogue entries as reference patterns. **Decompose** in the Catalogue tab turns a route into a plan without an AI call; **Plan only** shows the live AI’s decomposition without running it. |

## 5. The data behind each sub-agent

All of it is fictional and lives in `src/data.js`; amounts are in $ millions so every figure an agent quotes traces to a tool result.

| Sub-agent | What it reads |
|---|---|
| Prep.Profile | Advisor and coverage teams with roles, CG book by vehicle and fund, retirement plans (Maya’s PLAN-102, Alex’s PLAN-101), dealer programs |
| Prep.Notes, Follow.Dictation, Coach.Simulation | Dated calls, meeting notes and emails (including older notes on how each team invests) |
| Prep.Content, Engage.Recommendations | Approved content plus the recommendation trace: stated need (with the call that shows it) or popularity |
| Prep.Fact Check | Fund facts and the evidence resolver (page, passage and version in approved documents) |
| Prep.Themes, Prep.News | This week’s approved themes ranked for the advisor; authorized news from the last two weeks |
| Lead.Discover | Ranks advisors by headroom (industry book minus CG assets) against explicit criteria; saves the trace with exclusions; engagement graph and fund-level transactions |
| Lead.Insights | Assets and flows for all seven advisors, transactions, pipeline with history, change events, the ranking trace |
| Lead.Products, Product.Research Planner | Dealer shelves for every firm (custodian platforms for the RIAs), program rules, dated model allocations, taxonomy |
| Territory.Health Check, Reviews | Coverage tiers and completed contacts in the last 90 days |
| Territory.Calibration | Permitted peer cohorts and medians |
| Territory.Strategy, Business Planning | Pipeline scoring with its basis; sales goals, year-to-date sales, capacity and priorities |
| Schedule.Calendar, Zoning, Compliance | Open slots; visits grouped by zone with drive times; firm meeting rules plus Capital Group policy |
| Follow.Tasks | Open commitments with owners and due dates |
| Follow.Expenses | September receipts matched to visits, with policy checks |
| Coach.Guide | Objection playbooks built on approved messaging |
| Product.Tool Selection, QAR | Like-for-like fund comparison with basis flags; fee and cost models |
