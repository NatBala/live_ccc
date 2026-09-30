/*
 * Connected Client Experience: deployment server
 * Serves the app and forwards AI calls to OpenAI or Azure OpenAI. The API key never reaches the browser.
 * Requires Node.js 18 or later. No npm dependencies.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DIR, 'public');

/* ---- configuration (.env is optional; real environment variables win) ---- */
if (existsSync(path.join(DIR, '.env'))) {
  for (const line of readFileSync(path.join(DIR, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const E = process.env;
const PORT = Number(E.PORT) || 8080;
const AZURE = Boolean(E.AZURE_OPENAI_ENDPOINT);
const MODELS = {
  orchestrator: AZURE ? E.AZURE_OPENAI_DEPLOYMENT_ORCHESTRATOR : (E.OPENAI_MODEL_ORCHESTRATOR || 'gpt-4o'),
  agent: AZURE ? (E.AZURE_OPENAI_DEPLOYMENT_AGENT || E.AZURE_OPENAI_DEPLOYMENT_ORCHESTRATOR) : (E.OPENAI_MODEL_AGENT || 'gpt-4o-mini')
};
const MAX_TOKENS = { orchestrator: Number(E.MAX_TOKENS_ORCHESTRATOR) || 2500, agent: Number(E.MAX_TOKENS_AGENT) || 1800 };
const TOKENS_PARAM = E.MAX_TOKENS_PARAM || 'max_completion_tokens';
const TEMPERATURE = E.TEMPERATURE === '' ? null : (E.TEMPERATURE ? Number(E.TEMPERATURE) : 0.2);
const RATE_PER_MIN = Number(E.RATE_LIMIT_PER_MINUTE) || 120;

function checkConfig() {
  const missing = [];
  if (AZURE) { if (!E.AZURE_OPENAI_API_KEY) missing.push('AZURE_OPENAI_API_KEY'); if (!E.AZURE_OPENAI_DEPLOYMENT_ORCHESTRATOR) missing.push('AZURE_OPENAI_DEPLOYMENT_ORCHESTRATOR'); }
  else if (!E.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  return missing;
}
function upstream(tier) {
  if (AZURE) {
    const dep = MODELS[tier];
    return { url: `${E.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(dep)}/chat/completions?api-version=${E.AZURE_OPENAI_API_VERSION || '2024-10-21'}`, headers: { 'api-key': E.AZURE_OPENAI_API_KEY }, model: undefined };
  }
  return { url: `${(E.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, headers: { authorization: `Bearer ${E.OPENAI_API_KEY}`, ...(E.OPENAI_ORG_ID ? { 'OpenAI-Organization': E.OPENAI_ORG_ID } : {}) }, model: MODELS[tier] };
}

/* ---- small helpers ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
const SECURITY = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'"
};
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, ...SECURITY }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
const log = (...a) => console.log(new Date().toISOString(), ...a);

function authorized(req) {
  if (!E.DEMO_USER || !E.DEMO_PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [u, ...p] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  return u === E.DEMO_USER && p.join(':') === E.DEMO_PASSWORD;
}
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), w = hits.get(ip) || [];
  const recent = w.filter(t => now - t < 60000); recent.push(now); hits.set(ip, recent);
  return recent.length > RATE_PER_MIN;
}
function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ---- /api/chat: the only way the browser reaches the model ---- */
async function chat(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (rateLimited(ip)) return send(res, 429, { error: 'Too many requests. Wait a minute and try again.' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, e.status || 400, { error: e.message || 'Invalid JSON' }); }
  const tier = body.tier === 'agent' ? 'agent' : 'orchestrator';
  if (!Array.isArray(body.messages) || !body.messages.length) return send(res, 400, { error: 'messages required' });
  const up = upstream(tier);
  const payload = {
    ...(up.model ? { model: up.model } : {}),
    messages: body.messages.map(m => { const o = { role: m.role, content: m.content ?? null }; if (m.tool_calls) o.tool_calls = m.tool_calls; if (m.tool_call_id) o.tool_call_id = m.tool_call_id; return o; }),
    [TOKENS_PARAM]: MAX_TOKENS[tier],
    ...(TEMPERATURE === null ? {} : { temperature: TEMPERATURE }),
    ...(Array.isArray(body.tools) && body.tools.length ? { tools: body.tools.slice(0, 20), tool_choice: 'auto' } : {}),
    ...(body.json && !(body.tools && body.tools.length) ? { response_format: { type: 'json_object' } } : {}),
    ...(body.stream ? { stream: true } : {})
  };
  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
  const t0 = Date.now();
  let r;
  try { r = await fetch(up.url, { method: 'POST', headers: { 'content-type': 'application/json', ...up.headers }, body: JSON.stringify(payload), signal: ctl.signal }); }
  catch (e) { if (ctl.signal.aborted) return; log('upstream unreachable', e.message); return send(res, 502, { error: 'Could not reach the AI service' }); }
  if (!r.ok) {
    const txt = await r.text(); let msg = txt;
    try { msg = JSON.parse(txt).error?.message || txt; } catch (e) { }
    log('upstream error', r.status, tier, msg.slice(0, 200));
    return send(res, r.status === 401 || r.status === 403 ? 401 : r.status === 429 ? 429 : r.status === 400 ? 400 : 502, { error: msg.slice(0, 500) });
  }
  if (body.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', ...SECURITY });
    try { for await (const chunk of r.body) res.write(chunk); } catch (e) { }
    res.end(); log('chat', tier, 'stream', `${Date.now() - t0}ms`);
    return;
  }
  const txt = await r.text();
  res.writeHead(200, { 'content-type': 'application/json', ...SECURITY }); res.end(txt);
  log('chat', tier, `${Date.now() - t0}ms`);
}

/* ---- server ---- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') return send(res, 200, { ok: true });
  if (!authorized(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Connected Client Experience"', ...SECURITY }); return res.end('Sign in required'); }
  try {
    if (url.pathname === '/api/config' && req.method === 'GET') {
      const missing = checkConfig();
      if (missing.length) return send(res, 503, { error: 'Server is missing ' + missing.join(', ') });
      return send(res, 200, { provider: AZURE ? 'azure-openai' : 'openai', models: MODELS });
    }
    if (url.pathname === '/api/chat' && req.method === 'POST') return await chat(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
    let p = decodeURIComponent(url.pathname); if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'Forbidden' });
    const data = await readFile(file).catch(() => null);
    if (!data) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': p === '/index.html' ? 'no-cache' : 'public, max-age=3600', ...SECURITY });
    res.end(data);
  } catch (e) { log('server error', e.message); if (!res.headersSent) send(res, 500, { error: 'Server error' }); }
});
server.listen(PORT, () => {
  const missing = checkConfig();
  log(`Connected Client Experience on http://localhost:${PORT}`);
  log(`AI: ${AZURE ? 'Azure OpenAI' : 'OpenAI'} · orchestrator=${MODELS.orchestrator} · agents=${MODELS.agent}`);
  if (missing.length) log('WARNING: missing ' + missing.join(', ') + '. The app will load but live AI is off until these are set.');
  if (!E.DEMO_USER) log('Note: no DEMO_USER/DEMO_PASSWORD set, so anyone who can reach this URL can use it (and your AI quota).');
});
