// Offline stand-in for the OpenAI Chat Completions API, for trying the app without a key.
// Usage: npm run mock   (then in another terminal: npm run dev:mock)
// It streams one fixed plan (BFA vs. AMBAL for Rachel) and answers agents with a tool call, then JSON.
import http from 'node:http';
const PLAN = "{\"k\":\"decision\",\"type\":\"requester\",\"title\":\"Priya Shah covers Rachel\",\"detail\":\"Rachel Okafor is on Priya\u2019s coverage list, so shared advisor context is in bounds.\"}\n{\"k\":\"decision\",\"type\":\"intent\",\"title\":\"Fund comparison plus a meeting\",\"detail\":\"Two outcomes: a BFA vs. AMBAL comparison framed for Rachel, and a meeting next month.\",\"intent\":\"research\"}\n{\"k\":\"decision\",\"type\":\"entity\",\"title\":\"Rachel \u2192 Rachel Okafor, UBS\",\"detail\":\"One graph match; her retirement income unit is the only one.\",\"advisor\":\"ADV-106\",\"unit\":\"BU-106\",\"confidence\":\"high\"}\n{\"k\":\"decision\",\"type\":\"scope\",\"title\":\"Okafor retirement income portfolios\",\"detail\":\"Her stated priority lives here.\"}\n{\"k\":\"decision\",\"type\":\"known\",\"title\":\"She already told us what she needs\",\"detail\":\"MEM-061 and CALL-0923: reliable income for retirees; she is reviewing balanced and bond funds.\",\"uses\":[\"MEM-061\",\"CALL-0923\",\"OPP-505\",\"SEIS-123\"]}\n{\"k\":\"decision\",\"type\":\"missing\",\"title\":\"No amount given: show cost per $1M\",\"detail\":\"Assumption stated; Tool Selection computes it on the model platform.\"}\n{\"k\":\"decision\",\"type\":\"memory\",\"title\":\"Read only\",\"detail\":\"Her need is already in memory in her own words; nothing new to store.\",\"class\":\"read_only\"}\n{\"k\":\"decision\",\"type\":\"controls\",\"title\":\"Internal comparison; invite needs approval\",\"detail\":\"Numbers only from the platform; the meeting is a tentative hold until Priya approves the invite.\"}\n{\"k\":\"task\",\"id\":\"T1\",\"agent\":\"product.tools\",\"objective\":\"Compute BFA and AMBAL F-2 costs per $1M and compare with their category medians\",\"depends_on\":[],\"reads\":[\"knowledge\"],\"tools\":[\"models.cost_on_assets\",\"mstar.get_peers\"],\"why\":\"Dollar figures come only from the model platform.\"}\n{\"k\":\"task\",\"id\":\"T2\",\"agent\":\"product.qar\",\"objective\":\"Explain how BFA and AMBAL each fit Rachel\u2019s retirement income plan, from approved material\",\"depends_on\":[\"T1\"],\"reads\":[\"memory\",\"knowledge\",\"policy\"],\"tools\":[\"seismic.search_content\"],\"why\":\"QAR produces the verified answer.\"}\n{\"k\":\"task\",\"id\":\"T3\",\"agent\":\"sales.schedule\",\"objective\":\"Find a slot next month with Rachel and place a tentative hold\",\"depends_on\":[],\"reads\":[\"memory\"],\"tools\":[\"calendar.find_times\",\"calendar.create_event\"],\"why\":\"Schedule Me books meetings.\"}\n{\"k\":\"decision\",\"type\":\"success\",\"title\":\"A comparison and a meeting on hold\",\"detail\":\"Verified costs, how each fund fits her plan, and a time waiting for Priya\u2019s approval.\"}\n{\"k\":\"end\"}";
const PORT = Number(process.env.MOCK_PORT) || 9999;
http.createServer(async (req, res) => {
  let b = ''; for await (const c of req) b += c;
  let p; try { p = JSON.parse(b); } catch { res.writeHead(400); return res.end(); }
  if (p.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    for (let i = 0; i < PLAN.length; i += 120) { res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: PLAN.slice(i, i + 120) } }] }) + '\n\n'); await new Promise(r => setTimeout(r, 40)); }
    res.write('data: [DONE]\n\n'); return res.end();
  }
  const last = p.messages[p.messages.length - 1];
  res.writeHead(200, { 'content-type': 'application/json' });
  if (p.tools && p.tools.length && last.role === 'user') {
    const t = p.tools[0].function.name;
    const args = t.includes('cost') ? { tickers: ['BFA', 'AMBAL'], amount_usd: 1000000 } : t.includes('find_times') ? { attendees: ['ADV-106'], when: 'next month' } : t.includes('search') ? { query: 'balanced bond income' } : t.includes('peers') ? { category: 'BFA' } : { advisor_id: 'ADV-106' };
    return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: t, arguments: JSON.stringify(args) } }] } }] }));
  }
  const tool = p.messages.filter(m => m.role === 'tool').map(m => m.content).join(' ');
  const out = { says: 'Offline mock: I used the foundation and one tool result.', output: { kind: 'note', title: 'Mock result', body: tool.includes('3400') ? 'BFA F-2 costs about $3,400 a year per $1M.' : 'Mock answer from the offline stand-in.' }, used: ['MEM-061'], knowledge: [], memory: [], commitments: [], needs_approval: false, open_questions: [] };
  res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(out) } }] }));
}).listen(PORT, () => console.log('Mock OpenAI API on http://localhost:' + PORT + '/v1'));
