/* ===== Advisor knowledge graph ===== */
const KG_CLUSTERS = {
  firm: { label: 'Firm & team', color: '#9fb6cc', icon: 'users' },
  units: { label: 'Buying units', color: '#82b6ff', icon: 'network' },
  people: { label: 'Capital Group coverage', color: '#ffd27a', icon: 'users' },
  priorities: { label: 'Priorities', color: '#f0b870', icon: 'bolt' },
  prefs: { label: 'Preferences', color: '#7fd4ab', icon: 'check' },
  interests: { label: 'Interests', color: '#ff9fc3', icon: 'globe' },
  products: { label: 'Products', color: '#6fd3e8', icon: 'chart' },
  activity: { label: 'Recent activity', color: '#b9a5f5', icon: 'mail' },
  work: { label: 'Work & commitments', color: '#ffb27a', icon: 'file' }
};
const KG_ORDER = ['firm', 'units', 'people', 'priorities', 'prefs', 'interests', 'products', 'activity', 'work'];
const STATE_TXT = { new: 'Added in the latest request', updated: 'Updated in the latest request', session: 'Changed earlier in this session', read: 'Read by a specialist in the latest request; unchanged', pending: 'Pending validation: not yet memory', superseded: 'Superseded by a newer revision', locked: 'Hidden from you by access rules', none: 'Unchanged' };
const KG = { open: false, adv: null, hide: new Set(), changesOnly: false, vb: null, sel: null, sig: '', data: null };

function kgBuild(advId) {
  const A = ADVISORS[advId], viewer = UI.requester, run = UI.run, latest = run ? run.id : null;
  const readIds = new Set(run ? run.tasks.flatMap(t => t.packet ? t.packet.items.map(i => i.id) : []) : []);
  const sessionRuns = new Set(F.runs.map(r => r.id));
  const st = (id, rec) => {
    if (rec && rec.status === 'superseded') return 'superseded';
    if (rec && rec.run && rec.run === latest) return rec.rev > 1 ? 'updated' : 'new';
    if (rec && rec.run && sessionRuns.has(rec.run)) return 'session';
    return readIds.has(id) ? 'read' : 'none';
  };
  const nodes = [], links = [];
  const add = (cluster, id, label, sub, state, detail) => nodes.push({ cluster, id, label, sub, state, detail });
  const vis = m => m.access === 'shared' || (m.access === 'relationship' && A.coverage.includes(viewer)) || m.access === 'owner:' + viewer;
  const F0 = FIRMS[A.firm];
  add('firm', A.firm, F0.name, 'Firm', st(A.firm), [`${A.name} works here as ${A.title}.`, F0.policy ? 'Firm-wide rule: ' + F0.policy : null]);
  add('firm', 'office-' + advId, A.office, 'Office', st('office'), [`Territory: ${TERRITORIES[A.territory] ? TERRITORIES[A.territory].name : '—'}`]);
  add('firm', 'team-' + advId, A.team.split('(')[0].trim(), 'Team', st('team'), [A.team, A.practice]);
  for (const [u, l] of Object.entries(A.units)) add('units', u, l, u + (F.session.unit === u && F.session.advisor === advId ? ' · active' : ''), st(u), [`Buying unit ${u}. Preferences stated for this unit apply only here.`]);
  for (const [id, p] of Object.entries(PLANS).filter(([, p]) => p.adv === advId)) add('units', id, p.name, `Plan · ${p.unit} · meets ${p.next_meeting}`, st(id), [`$${p.assets_usd / 1e6}M, ${p.participants} participants. ${p.committee}.`, `Options: ${p.lineup.map(o => `${o.option} (${o.fund})`).join('; ')}`]);
  const ho = HANDOVERS.find(h => h.adv === advId);
  A.coverage.forEach(c => add('people', c, EMPLOYEES[c].name, ho && ho.to === c ? `Primary from ${ho.effective}` : ho && ho.from === c ? `Handing over ${ho.effective}` : EMPLOYEES[c].role, st(c), [`${EMPLOYEES[c].name} covers ${A.short}.`, ho && (ho.to === c || ho.from === c) ? `${ho.note} (${ho.src})` : null]));
  for (const m of F.memory.filter(m => m.adv === advId)) {
    const cl = m.cat === 'personal' || m.cat === 'coaching' ? 'interests' : m.cat === 'priority' || m.cat === 'relationship' ? 'priorities' : 'prefs';
    if (!vis(m)) { add(cl, m.id, 'Hidden note', m.access === 'relationship' ? 'Relationship team only' : 'Private to its owner', 'locked', [`${EMPLOYEES[viewer].name} can’t see this record. Access rules apply to the graph too.`]); continue; }
    add(cl, m.status === 'superseded' ? `${m.id}@r${m.rev}` : m.id, m.value.length > 44 ? m.value.slice(0, 42) + '…' : m.value, `${m.attr}${m.rev > 1 ? ' · rev ' + m.rev : ''} · ${m.scope}`, st(m.id, m),
      [m.value, `Scope: ${m.scope}`, `Basis: ${m.basis} (${m.src})`, m.origin ? `Captured by ${agentName(m.origin)}` : `From ${m.speaker}`]);
    if (/^(CALL|EMAIL)-/.test(m.src) && m.status !== 'superseded') links.push({ a: m.id, b: m.src, label: 'supported by' });
  }
  for (const p of F.pending.filter(p => p.adv === advId)) add('prefs', p.id, p.value.length > 44 ? p.value.slice(0, 42) + '…' : p.value, `${p.attr} · pending`, 'pending', [p.value, p.reason, `Proposed by ${agentName(p.by)} · scope ${p.scope}`]);
  (UNKNOWNS[advId] || []).forEach((u, k) => add('prefs', 'unk-' + k, u.split(':')[0], 'Not known yet', 'unknown', [u, 'The foundation shows what it does not know, instead of guessing.']));
  for (const p of (ADVISOR_PRODUCTS[advId] || [])) { const f = FUNDS[p.fund]; const nick = Object.entries(FUND_ALIASES).find(([k, v]) => v === p.fund && k.length <= 5); add('products', 'prod-' + p.fund, (nick ? nick[0].toUpperCase() + ' · ' : '') + p.fund, p.rel, st(p.fund), [f.name, p.rel, f.er != null ? `Expense ratio ${f.er}% (${f.src})` : 'Expense ratio not in reference data', `Source: ${p.src}`]); if (/^(CALL|EMAIL)-/.test(p.src)) links.push({ a: 'prod-' + p.fund, b: p.src, label: 'mentioned in' }); }
  for (const e of F.episodes.filter(e => e.adv === advId)) add('activity', e.id, `${e.kind.replace(' transcript', '')} · ${e.date}`, `with ${e.with} · ${e.scope}`, st(e.id, e), [e.text, `${e.id} in Salesforce`]);
  for (const c of F.cases.filter(c => c.adv === advId)) add('activity', c.id, `Case · ${c.status}`, c.id, st(c.id, c), [c.text]);
  for (const o of OPPORTUNITIES.filter(o => o.adv === advId)) add('work', o.id, o.name, `Opportunity · ${o.stage}`, st(o.id), [o.note]);
  for (const c of F.commitments.filter(c => c.adv === advId && c.status === 'Open')) add('work', c.id, c.title.length > 40 ? c.title.slice(0, 38) + '…' : c.title, `Owed by ${c.owner} · ${c.due}`, st(c.id, c), [c.title, `Owner ${c.owner}, due ${c.due}`]);
  for (const o of F.outputs.filter(o => o.adv === advId)) { add('work', o.id, o.title.length > 40 ? o.title.slice(0, 38) + '…' : o.title, `${agentName(o.agent)} · ${o.status}`, st(o.id, o), [o.body.slice(0, 260), `Status: ${o.status}`]); (o.used || []).filter(u => /^(MEM|CALL|EMAIL)-/.test(u)).slice(0, 3).forEach(u => links.push({ a: o.id, b: u, label: 'used' })); }
  for (const k of F.findings.filter(k => k.adv === advId)) add('work', k.id, k.label.length > 40 ? k.label.slice(0, 38) + '…' : k.label, `Finding · ${agentName(k.by)}`, st(k.id, k), [k.value, `Evidence: ${k.evidence.join(', ')}`]);
  const ids = new Set(nodes.map(n => n.id));
  return { adv: advId, nodes, links: links.filter(l => ids.has(l.a) && ids.has(l.b)) };
}

const KG_CAP = 8;
const KG_RANK = { new: 0, updated: 1, pending: 2, session: 3, read: 4, none: 5, unknown: 6, locked: 7, superseded: 8 };
function kgLayout(g, W, H, hide, changesOnly) {
  const cx = W / 2, cy = H / 2, R1 = H * .21, R2 = H * .34, SX = 1.42, SY = .84;
  const show = n => !hide.has(n.cluster) && (!changesOnly || ['new', 'updated', 'session', 'pending', 'read'].includes(n.state));
  const groups = KG_ORDER.map(c => {
    let items = g.nodes.filter(n => n.cluster === c && show(n)).sort((a, b) => (KG_RANK[a.state] ?? 5) - (KG_RANK[b.state] ?? 5));
    if (items.length > KG_CAP) { const rest = items.slice(KG_CAP - 1); items = items.slice(0, KG_CAP - 1); items.push({ cluster: c, id: 'more-' + c, label: `+${rest.length} more`, sub: 'Older or unchanged', state: 'none', detail: rest.map(r => r.label), more: true }); }
    return { c, items };
  }).filter(x => x.items.length);
  const w = x => Math.pow(Math.max(x.items.length, 2), .75), weight = groups.reduce((s, x) => s + w(x), 0);
  let ang = -Math.PI / 2 - Math.PI * w(groups[0] || { items: [] }) / weight; const pos = {};
  const hubs = groups.map(x => {
    const span = 2 * Math.PI * w(x) / weight, mid = ang + span / 2;
    const hub = { c: x.c, x: cx + Math.cos(mid) * R1 * 1.25, y: cy + Math.sin(mid) * R1 * .95, a: mid };
    const n = x.items.length, tiers = n > 5 ? 3 : n > 2 ? 2 : 1;
    x.items.forEach((it, k) => { const t = n === 1 ? mid : ang + span * (.1 + .8 * k / (n - 1)); const r = R2 + (k % tiers) * 62; pos[it.id] = { x: cx + Math.cos(t) * r * SX, y: cy + Math.sin(t) * r * SY, a: t, hub }; });
    ang += span; return hub;
  });
  return { cx, cy, hubs, pos, groups };
}

function kgSVG(g, opt) {
  const W = opt.W, H = opt.H, L = kgLayout(g, W, H, opt.hide || new Set(), opt.changesOnly), full = opt.full, A = ADVISORS[g.adv];
  const f = v => v.toFixed(1);
  let h = `<defs><radialGradient id="kgbg" cx="50%" cy="50%" r="60%"><stop offset="0" style="stop-color:var(--s3)"/><stop offset="1" style="stop-color:var(--s0)"/></radialGradient><filter id="kgglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  h += `<rect x="-2000" y="-2000" width="${W + 4000}" height="${H + 4000}" fill="url(#kgbg)"/>`;
  [0.2, 0.37, 0.5].forEach(k => h += `<ellipse cx="${L.cx}" cy="${L.cy}" rx="${Math.min(W, H) * k * 1.22}" ry="${Math.min(W, H) * k * .9}" fill="none" style="stroke:var(--line)" stroke-dasharray="2 7" opacity=".6"/>`);
  for (const hub of L.hubs) { const col = KG_CLUSTERS[hub.c].color; h += `<line x1="${L.cx}" y1="${L.cy}" x2="${f(hub.x)}" y2="${f(hub.y)}" stroke="${col}" stroke-width="2" opacity=".45"/>`; }
  for (const gr of L.groups) for (const n of gr.items) { const p = L.pos[n.id], hub = p.hub, col = KG_CLUSTERS[n.cluster].color, hot = ['new', 'updated'].includes(n.state);
    const mx = (hub.x + p.x) / 2 + (L.cx - (hub.x + p.x) / 2) * -.08, my = (hub.y + p.y) / 2 + (L.cy - (hub.y + p.y) / 2) * -.08;
    h += `<path class="kge ${n.state}" d="M${f(hub.x)} ${f(hub.y)} Q${f(mx)} ${f(my)} ${f(p.x)} ${f(p.y)}" stroke="${hot ? '#ffd27a' : col}" stroke-width="${hot ? 2.6 : 1.3}" opacity="${n.state === 'superseded' || n.state === 'locked' ? .25 : hot ? .95 : .5}" ${n.state === 'pending' || n.state === 'superseded' ? 'stroke-dasharray="5 5"' : ''}/>`; }
  for (const l of g.links) { const a = L.pos[l.a], b = L.pos[l.b]; if (!a || !b) continue; const mx = (a.x + b.x) / 2 + (L.cx - (a.x + b.x) / 2) * .45, my = (a.y + b.y) / 2 + (L.cy - (a.y + b.y) / 2) * .45;
    h += `<path class="kgx" data-a="${l.a}" data-b="${l.b}" d="M${f(a.x)} ${f(a.y)} Q${f(mx)} ${f(my)} ${f(b.x)} ${f(b.y)}"/>`; }
  for (const hub of L.hubs) { const C = KG_CLUSTERS[hub.c], cnt = L.groups.find(x => x.c === hub.c).items.length;
    h += `<g class="kgh" data-cl="${hub.c}"><circle cx="${f(hub.x)}" cy="${f(hub.y)}" r="${full ? 24 : 20}" style="fill:var(--s1)" stroke="${C.color}" stroke-width="2.5"/><svg x="${f(hub.x - 10)}" y="${f(hub.y - 10)}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${C.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[C.icon] || ''}</svg>
      <text x="${f(hub.x + Math.cos(hub.a) * 34)}" y="${f(hub.y + Math.sin(hub.a) * 30 + (Math.sin(hub.a) > .3 ? 12 : Math.sin(hub.a) < -.3 ? -4 : 4))}" text-anchor="${Math.cos(hub.a) > .35 ? 'start' : Math.cos(hub.a) < -.35 ? 'end' : 'middle'}" class="kghl" fill="${C.color}">${esc(C.label)} · ${cnt}</text></g>`; }
  for (const gr of L.groups) for (const n of gr.items) {
    const p = L.pos[n.id], col = KG_CLUSTERS[n.cluster].color, right = Math.cos(p.a) >= -0.05, r = full ? 9 : 8;
    const ring = { new: '#ffd27a', updated: '#ffd27a', session: '#e8c877', read: '#7fd4ab', pending: '#ffb347', superseded: '#6a7f94', locked: '#6a7f94', unknown: '#8aa3bb', none: 'none' }[n.state];
    const showLabel = full || ['new', 'updated', 'pending'].includes(n.state);
    h += `<g class="kgn ${n.state} ${KG.sel === n.id ? 'sel' : ''}" data-node="${esc(n.id)}" tabindex="0">
      ${['new', 'updated'].includes(n.state) ? `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${r + 9}" fill="#ffd27a" opacity=".22" class="kgpulse" filter="url(#kgglow)"/>` : ''}
      <circle cx="${f(p.x)}" cy="${f(p.y)}" r="${r}" fill="${col}" style="${['pending', 'unknown'].includes(n.state) ? 'fill:var(--s1)' : n.state === 'locked' || n.state === 'superseded' ? 'fill:var(--kg-dim)' : ''}" stroke="${ring}" stroke-width="${ring === 'none' ? 0 : 2.5}" ${['pending', 'unknown', 'superseded'].includes(n.state) ? 'stroke-dasharray="3 3"' : ''}/>
      ${n.state === 'locked' ? `<svg x="${f(p.x - 6)}" y="${f(p.y - 6)}" width="12" height="12" viewBox="0 0 24 24" fill="none" style="stroke:var(--nt)" stroke-width="2.4"><path d="M6 11h12v9H6zM8 11V8a4 4 0 018 0v3"/></svg>` : ''}
      ${showLabel ? `<text x="${f(p.x + (right ? 15 : -15))}" y="${f(p.y - 1)}" text-anchor="${right ? 'start' : 'end'}" class="kgl">${esc(n.label)}</text><text x="${f(p.x + (right ? 15 : -15))}" y="${f(p.y + 13)}" text-anchor="${right ? 'start' : 'end'}" class="kgs">${esc(n.sub)}</text>` : ''}
      ${['new', 'updated'].includes(n.state) && full ? `<text x="${f(p.x)}" y="${f(p.y - 16)}" text-anchor="middle" class="kgbadge">${n.state === 'new' ? 'NEW' : 'UPDATED'}</text>` : ''}
      <title>${esc(n.label)} · ${esc(STATE_TXT[n.state] || n.state)}</title></g>`;
  }
  h += `<g class="kgc"><circle cx="${L.cx}" cy="${L.cy}" r="${full ? 46 : 40}" style="fill:var(--kg-center)" stroke="#ffd27a" stroke-width="3"/><text x="${L.cx}" y="${L.cy + 9}" text-anchor="middle" class="kgci">${esc(A.short[0])}${esc(A.name.split(' ')[1] ? A.name.split(' ')[1][0] : '')}</text>
    <text x="${L.cx}" y="${L.cy + (full ? 70 : 64)}" text-anchor="middle" class="kgcn">${esc(A.name)}</text><text x="${L.cx}" y="${L.cy + (full ? 88 : 82)}" text-anchor="middle" class="kgcs">${esc(FIRMS[A.firm].name)}</text></g>`;
  return h;
}
function kgStats(g) { const c = s => g.nodes.filter(n => n.state === s).length; return { nodes: g.nodes.length, links: g.links.length, new: c('new'), updated: c('updated'), session: c('session'), read: c('read'), pending: c('pending'), superseded: c('superseded'), locked: c('locked') }; }

/* compact card for the Memory tab */
function kgCompact(advId) {
  const g = kgBuild(advId), s = kgStats(g);
  return `<div class="kgcard"><div class="kgcard-h"><b>Knowledge graph</b><span>${s.nodes} nodes · ${s.links} evidence links${s.new + s.updated ? ` · <em>${s.new + s.updated} changed now</em>` : ''}${s.read ? ` · ${s.read} read` : ''}</span><button class="lbtn" data-act="kg" data-adv="${advId}">Expand</button></div>
    <svg viewBox="0 0 1200 820" class="kgmini" data-act="kg" data-adv="${advId}">${kgSVG(g, { W: 1200, H: 820, full: false })}</svg></div>`;
}

/* ---------- full-screen explorer ---------- */
function openKG(advId) {
  KG.open = true; KG.adv = advId || UI.memAdv || F.session.advisor || 'ADV-101'; KG.sel = null; KG.vb = { x: -90, y: -20, w: 1580, h: 940 };
  $('kg').hidden = false; renderKG(true);
}
function closeKG() { KG.open = false; $('kg').hidden = true; }
function kgSig() { return [KG.adv, KG.changesOnly, [...KG.hide].join(), KG.sel, UI.requester, F.events.length, F.memory.length, F.pending.length, UI.run ? UI.run.id + UI.run.tasks.filter(t => t.packet).length : ''].join('|'); }
function renderKG(force) {
  if (!KG.open) return;
  const sig = kgSig(); if (!force && sig === KG.sig) return; KG.sig = sig;
  const g = kgBuild(KG.adv), s = kgStats(g), A = ADVISORS[KG.adv]; KG.data = g;
  setHTML($('kgAdv'), Object.entries(ADVISORS).map(([k, x]) => `<button class="kgchip ${k === KG.adv ? 'on' : ''}" data-kgadv="${k}">${esc(x.short)}</button>`).join(''));
  setHTML($('kgFilt'), KG_ORDER.map(c => `<button class="kgf ${KG.hide.has(c) ? 'off' : ''}" data-kgcl="${c}" style="--c:${KG_CLUSTERS[c].color}"><i></i>${esc(KG_CLUSTERS[c].label)}</button>`).join('') + `<button class="kgf tog ${KG.changesOnly ? 'on' : ''}" data-kgact="changes">Changes only</button>`);
  const svg = $('kgsvg'); svg.innerHTML = kgSVG(g, { W: 1400, H: 900, full: true, hide: KG.hide, changesOnly: KG.changesOnly });
  kgApplyVB();
  const sel = KG.sel && g.nodes.find(n => n.id === KG.sel);
  const changed = g.nodes.filter(n => ['new', 'updated', 'session', 'pending'].includes(n.state));
  setHTML($('kgside'), sel ? `<button class="lbtn" data-kgact="back" style="margin-bottom:8px">← All of ${esc(A.short)}</button><div class="kgd"><span class="kgtag" style="background:${KG_CLUSTERS[sel.cluster].color}">${esc(KG_CLUSTERS[sel.cluster].label)}</span><h3>${esc(sel.label)}</h3><p class="kgsub">${esc(sel.sub)}</p><div class="kgstate ${sel.state}">${esc(STATE_TXT[sel.state] || sel.state)}</div>${sel.detail.filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('')}${g.links.filter(l => l.a === sel.id || l.b === sel.id).map(l => { const o = g.nodes.find(n => n.id === (l.a === sel.id ? l.b : l.a)); return o ? `<button class="kglink" data-node="${esc(o.id)}">${esc(l.label)} → ${esc(o.label)}</button>` : ''; }).join('')}</div>`
    : `<div class="kgd"><h3>${esc(A.name)}</h3><p class="kgsub">${esc(A.title)} · ${esc(FIRMS[A.firm].name)} · ${esc(A.office)}</p>
      <div class="kgsum"><div><b>${s.nodes}</b>facts & entities</div><div><b>${s.links}</b>evidence links</div><div class="g"><b>${s.new + s.updated}</b>changed now</div><div><b>${s.read}</b>read, unchanged</div><div class="a"><b>${s.pending}</b>pending</div><div><b>${s.locked}</b>hidden from you</div></div>
      <h4>What changed this session</h4>${changed.length ? changed.map(n => `<button class="kglink" data-node="${esc(n.id)}"><span class="kgdot ${n.state}"></span>${esc(n.label)}<small>${esc(STATE_TXT[n.state])}</small></button>`).join('') : '<p class="kgsub">Nothing yet. Run a request about ' + esc(A.short) + ' and watch memory, products and activity update here.</p>'}
      <h4>How to read it</h4><p class="kgsub">Nine clusters around ${esc(A.short)}. Dashed purple lines connect a fact to the conversation that supports it. Click any node for its source, scope and who added it. Scroll to zoom, drag to pan.</p></div>`);
  const eps = F.episodes.filter(e => e.adv === KG.adv).map(e => ({ t: Date.parse(e.date), id: e.id, label: `${e.kind} · ${e.date}`, kind: 'ep' }));
  const evs = F.events.filter(e => e.adv === KG.adv && /memory|knowledge|commitment|approval|content/.test(e.type)).map((e, k) => ({ t: Date.parse('Sep 29, 2026') + k * 3600e3, id: e.id, label: `${e.type} · ${e.detail}`, kind: 'ev' }));
  eps.sort((a, b) => a.t - b.t); const e0 = eps.length ? eps[0].t : 0, e1 = eps.length ? eps[eps.length - 1].t : 1, today = evs.slice(-6);
  const posE = x => eps.length > 1 ? 3 + 58 * (x.t - e0) / Math.max(1, e1 - e0) : 30;
  setHTML($('kgtime'), `<b>Activity timeline</b><div class="kgtrack"><span class="kgtoday">Today</span>${eps.map((x, k) => `<button class="kgtick ep ${k % 2 ? 'lo' : ''}" style="left:${posE(x)}%" data-node="${esc(x.id)}" title="${esc(x.label)}"><i></i><span>${esc(x.label.split(' · ').slice(-1)[0])}</span></button>`).join('')}${today.map((x, k) => `<button class="kgtick ev ${k % 2 ? 'lo' : ''}" style="left:${72 + 25 * (today.length > 1 ? k / (today.length - 1) : .5)}%" title="${esc(x.label)}"><i></i><span>${esc(x.label.split(' · ')[0].split('.').pop())}</span></button>`).join('')}</div><span class="kgtl">Recorded calls and emails in Salesforce, then today’s changes committed by the foundation</span>`);
}
function kgApplyVB() { const v = KG.vb; $('kgsvg').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); }
function kgZoom(k, cx, cy) { const v = KG.vb, nw = Math.min(2800, Math.max(500, v.w * k)), nh = nw * v.h / v.w; cx = cx ?? v.x + v.w / 2; cy = cy ?? v.y + v.h / 2; v.x = cx - (cx - v.x) * nw / v.w; v.y = cy - (cy - v.y) * nh / v.h; v.w = nw; v.h = nh; kgApplyVB(); }
function kgInit() {
  const svg = $('kgsvg');
  svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(), v = KG.vb; kgZoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, v.x + (e.clientX - r.left) / r.width * v.w, v.y + (e.clientY - r.top) / r.height * v.h); }, { passive: false });
  let drag = null;
  svg.addEventListener('pointerdown', e => { if (e.target.closest('[data-node]')) return; drag = { x: e.clientX, y: e.clientY, vx: KG.vb.x, vy: KG.vb.y }; svg.setPointerCapture(e.pointerId); svg.classList.add('drag'); });
  svg.addEventListener('pointermove', e => { if (!drag) return; const r = svg.getBoundingClientRect(); KG.vb.x = drag.vx - (e.clientX - drag.x) / r.width * KG.vb.w; KG.vb.y = drag.vy - (e.clientY - drag.y) / r.height * KG.vb.h; kgApplyVB(); });
  svg.addEventListener('pointerup', () => { drag = null; svg.classList.remove('drag'); });
  svg.addEventListener('mouseover', e => { const n = e.target.closest('[data-node]'); svg.querySelectorAll('.kgx.hi').forEach(x => x.classList.remove('hi')); if (n) svg.querySelectorAll(`.kgx[data-a="${CSS.escape(n.dataset.node)}"],.kgx[data-b="${CSS.escape(n.dataset.node)}"]`).forEach(x => x.classList.add('hi')); });
  $('kg').addEventListener('click', e => {
    const el = e.target.closest('[data-node],[data-kgadv],[data-kgcl],[data-kgact]'); if (!el) return; const d = el.dataset;
    if (d.node) { if (d.node) { KG.sel = d.node; renderKG(); } return; }
    if (d.kgadv) { KG.adv = d.kgadv; KG.sel = null; KG.vb = { x: -90, y: -20, w: 1580, h: 940 }; renderKG(); return; }
    if (d.kgcl) { KG.hide.has(d.kgcl) ? KG.hide.delete(d.kgcl) : KG.hide.add(d.kgcl); renderKG(); return; }
    const a = d.kgact;
    if (a === 'changes') { KG.changesOnly = !KG.changesOnly; renderKG(); }
    else if (a === 'back') { KG.sel = null; renderKG(); }
    else if (a === 'close') closeKG();
    else if (a === 'in') kgZoom(1 / 1.25); else if (a === 'out') kgZoom(1.25);
    else if (a === 'fit') { KG.vb = { x: -90, y: -20, w: 1580, h: 940 }; kgApplyVB(); }
  });
}
