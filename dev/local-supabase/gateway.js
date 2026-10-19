#!/usr/bin/env node
/**
 * Minimal Supabase-compatible gateway for local development without Docker.
 *
 *   :54321/auth/v1/*     → Supabase Auth (GoTrue)  on :9999
 *   :54321/rest/v1/*     → PostgREST               on :3001
 *   :54321/storage/v1/*  → tiny file store (this process), files under ./data/storage
 *   :2500 (SMTP)         → mail catcher; messages written to ./data/mail/*.eml
 *
 * Zero dependencies — Node 18+.
 */
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.GATEWAY_PORT || 54321);
const AUTH = { host: '127.0.0.1', port: Number(process.env.AUTH_PORT || 9999) };
const REST = { host: '127.0.0.1', port: Number(process.env.REST_PORT || 3001) };
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const STORE = path.join(DATA, 'storage');
const MAIL = path.join(DATA, 'mail');
fs.mkdirSync(STORE, { recursive: true });
fs.mkdirSync(MAIL, { recursive: true });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  'Access-Control-Allow-Headers':
    'authorization,apikey,content-type,x-client-info,prefer,range,accept-profile,content-profile,x-upsert,cache-control,x-supabase-api-version',
  'Access-Control-Expose-Headers': 'content-range,x-total-count,content-location',
  'Access-Control-Max-Age': '86400',
};

function verifyJwt(token) {
  try {
    const [h, p, s] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
    if (expected !== s) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json', ...headers });
  res.end(buf);
}

function proxy(req, res, target, stripPrefix) {
  const upstream = http.request(
    {
      ...target,
      method: req.method,
      path: req.url.slice(stripPrefix.length) || '/',
      headers: { ...req.headers, host: `${target.host}:${target.port}` },
    },
    up => {
      const headers = { ...up.headers };
      for (const k of Object.keys(headers)) if (k.toLowerCase().startsWith('access-control-')) delete headers[k];
      Object.assign(headers, CORS);
      res.writeHead(up.statusCode, headers);
      up.pipe(res);
    }
  );
  upstream.on('error', err => send(res, 502, { message: `upstream error: ${err.message}` }));
  req.pipe(upstream);
}

function safeJoin(bucket, objectPath) {
  const p = path.normalize(path.join(STORE, bucket, decodeURIComponent(objectPath)));
  if (!p.startsWith(path.join(STORE, bucket))) throw new Error('bad path');
  return p;
}

const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain' };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// multipart/form-data → first file part (supabase-js sends FormData for File/Blob)
function extractMultipart(body, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return body;
  const boundary = Buffer.from(`--${m[1] || m[2]}`);
  let start = body.indexOf(boundary);
  while (start !== -1) {
    const next = body.indexOf(boundary, start + boundary.length);
    if (next === -1) break;
    const part = body.slice(start + boundary.length + 2, next - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    const headers = part.slice(0, headerEnd).toString();
    if (/filename=/i.test(headers) || /name=""/.test(headers)) return part.slice(headerEnd + 4);
    start = next;
  }
  return body;
}

async function storage(req, res) {
  const url = new URL(req.url, 'http://x');
  const rest = url.pathname.replace(/^\/storage\/v1/, '');

  // public read
  let m = /^\/object\/public\/([^/]+)\/(.+)$/.exec(rest);
  if (m && (req.method === 'GET' || req.method === 'HEAD')) {
    try {
      const file = safeJoin(m[1], m[2]);
      if (!fs.existsSync(file)) return send(res, 404, { message: 'Object not found' });
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { ...CORS, 'Content-Type': type });
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
    } catch {
      return send(res, 400, { message: 'bad path' });
    }
  }

  // everything else requires an authenticated user
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const claims = verifyJwt(token);
  if (!claims || claims.role !== 'authenticated' && claims.role !== 'service_role') {
    return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
  }

  m = /^\/object\/([^/]+)\/(.+)$/.exec(rest);
  if (m && (req.method === 'POST' || req.method === 'PUT')) {
    const file = safeJoin(m[1], m[2]);
    if (req.method === 'POST' && fs.existsSync(file) && req.headers['x-upsert'] !== 'true') {
      return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
    }
    const raw = await readBody(req);
    const data = /multipart\/form-data/i.test(req.headers['content-type'] || '')
      ? extractMultipart(raw, req.headers['content-type'])
      : raw;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    return send(res, 200, { Key: `${m[1]}/${decodeURIComponent(m[2])}`, Id: crypto.randomUUID() });
  }

  m = /^\/object\/([^/]+)\/?$/.exec(rest);
  if (m && req.method === 'DELETE') {
    const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || '{}');
    const removed = [];
    for (const p of prefixes) {
      const file = safeJoin(m[1], p);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        removed.push({ name: p, bucket_id: m[1] });
      }
    }
    return send(res, 200, removed);
  }

  m = /^\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/.exec(rest);
  if (m && req.method === 'GET') {
    const file = safeJoin(m[1], m[2]);
    if (!fs.existsSync(file)) return send(res, 404, { message: 'Object not found' });
    res.writeHead(200, { ...CORS, 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }

  return send(res, 404, { message: `storage route not implemented: ${req.method} ${rest}` });
}


// Local stand-in for the admin-create-user Edge Function (supabase/functions/admin-create-user)
const SERVICE_KEY = (() => {
  try { return fs.readFileSync(path.join(__dirname, 'keys.env'), 'utf8').match(/SERVICE_ROLE_KEY=(.+)/)[1].trim(); } catch { return ''; }
})();
function upstreamJson(target, method, pathName, headers, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const r = http.request({ ...target, method, path: pathName, headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': data.length } : {}), ...headers } }, up => {
      const chunks = []; up.on('data', c => chunks.push(c)); up.on('end', () => {
        const text = Buffer.concat(chunks).toString(); let parsed = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
        resolve({ status: up.statusCode, body: parsed });
      });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
const strongPw = p => p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
async function adminCreateUser(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!verifyJwt(token)) return send(res, 401, { error: 'Please sign in again.' });
  const b = JSON.parse((await readBody(req)).toString() || '{}');
  const email = String(b.email || '').trim().toLowerCase();
  if (!b.name || !b.company_id) return send(res, 400, { error: 'Name and company are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return send(res, 400, { error: 'Enter a valid email address.' });
  if (!strongPw(String(b.password || ''))) return send(res, 400, { error: 'Password must be at least 10 characters with upper and lower case letters, a number and a symbol.' });
  const asCaller = { Authorization: `Bearer ${token}`, 'Content-Profile': 'snapshot', 'Accept-Profile': 'snapshot' };
  const g = await upstreamJson(REST, 'POST', '/rpc/is_global_admin', asCaller, {});
  const a = await upstreamJson(REST, 'POST', '/rpc/is_company_admin', asCaller, { _company: b.company_id });
  if (g.body !== true && a.body !== true) return send(res, 403, { error: 'Only an admin of this company can add users.' });
  if (b.is_global_admin && g.body !== true) return send(res, 403, { error: 'Only a global admin can create global admins.' });
  const svc = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY };
  const u = await upstreamJson(AUTH, 'POST', '/admin/users', svc, { email, password: b.password, email_confirm: true, user_metadata: { name: b.name } });
  if (u.status >= 300) return send(res, 400, { error: /already/i.test(JSON.stringify(u.body)) ? 'A user with this email already exists.' : (u.body.msg || u.body.message || 'Could not create user') });
  const p = await upstreamJson(REST, 'POST', '/profiles', { ...svc, 'Content-Profile': 'snapshot' }, {
    user_id: u.body.id, company_id: b.company_id, name: b.name, email, phone: b.phone || null,
    is_admin: !!b.is_admin, is_global_admin: !!b.is_global_admin,
    is_worker: !b.is_admin && !b.is_global_admin && !!b.is_worker, active: true });
  if (p.status >= 300) { await upstreamJson(AUTH, 'DELETE', `/admin/users/${u.body.id}`, svc); return send(res, 400, { error: p.body.message || 'Could not create profile' }); }
  return send(res, 200, { user_id: u.body.id });
}

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    try {
      if (req.url.startsWith('/auth/v1')) return proxy(req, res, AUTH, '/auth/v1');
      if (req.url.startsWith('/rest/v1')) return proxy(req, res, REST, '/rest/v1');
      if (req.url.startsWith('/storage/v1')) return await storage(req, res);
      if (req.url.startsWith('/functions/v1/admin-create-user') && req.method === 'POST') return await adminCreateUser(req, res);
      if (req.url === '/mail' || req.url.startsWith('/mail?')) {
        const files = fs.readdirSync(MAIL).sort().reverse().slice(0, 20);
        return send(res, 200, files.map(f => ({ file: f, body: fs.readFileSync(path.join(MAIL, f), 'utf8') })));
      }
      return send(res, 404, { message: 'not found' });
    } catch (err) {
      console.error(err);
      return send(res, 500, { message: err.message });
    }
  })
  .listen(PORT, () => console.log(`gateway listening on :${PORT}`));

// ---- tiny SMTP sink so password-reset / invite emails can be read locally ----
net
  .createServer(sock => {
    let data = '';
    let inData = false;
    const reply = s => sock.write(s + '\r\n');
    reply('220 localhost mailcatcher');
    sock.on('data', chunk => {
      data += chunk.toString();
      let idx;
      while ((idx = data.indexOf('\r\n')) !== -1 || (inData && data.includes('\r\n.\r\n'))) {
        if (inData) {
          const end = data.indexOf('\r\n.\r\n');
          if (end === -1) return;
          const msg = data.slice(0, end);
          data = data.slice(end + 5);
          inData = false;
          const name = `${new Date().toISOString().replace(/[:.]/g, '-')}.eml`;
          fs.writeFileSync(path.join(MAIL, name), msg);
          console.log(`mail captured → ${name}`);
          reply('250 OK');
          continue;
        }
        const line = data.slice(0, idx);
        data = data.slice(idx + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') reply('250 localhost');
        else if (cmd === 'DATA') { inData = true; reply('354 End data with <CR><LF>.<CR><LF>'); }
        else if (cmd === 'QUIT') { reply('221 Bye'); sock.end(); }
        else reply('250 OK');
      }
    });
    sock.on('error', () => {});
  })
  .listen(Number(process.env.SMTP_PORT || 2500), () => console.log('smtp sink on :2500'));
