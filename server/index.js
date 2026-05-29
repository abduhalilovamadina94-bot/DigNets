const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dignets-2025-secret';

// Simple hash (no bcrypt needed - using crypto built-in)
const hashPw = p => crypto.createHash('sha256').update(p + SECRET).digest('hex');
const checkPw = (p, h) => hashPw(p) === h;

// ── DB ──
const db = { users: new Map(), messages: new Map() };
[
  { id:'u1', username:'admin',   displayName:'Admin',   avatar:'AD', color:'#7c3aed', pw:'admin123' },
  { id:'u2', username:'alice',   displayName:'Alice',   avatar:'AL', color:'#0891b2', pw:'alice123' },
  { id:'u3', username:'bob',     displayName:'Bob',     avatar:'BO', color:'#059669', pw:'bob123'   },
  { id:'u4', username:'sardor',  displayName:'Sardor',  avatar:'SA', color:'#dc2626', pw:'sardor123'},
  { id:'u5', username:'dilnoza', displayName:'Dilnoza', avatar:'DI', color:'#d97706', pw:'dilnoza123'},
].forEach(u => {
  db.users.set(u.id, { ...u, passwordHash: hashPw(u.pw), pw: undefined, online: false, lastSeen: new Date() });
});

const conns = new Map();

// ── HTTP SERVER ──
const server = http.createServer((req, res) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  const sendJSON = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(data));
  };

  const getBody = () => new Promise(resolve => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({}); } });
  });

  const authMW = () => {
    const t = req.headers.authorization?.split(' ')[1];
    if (!t) return null;
    try { return jwt.verify(t, SECRET).userId; } catch { return null; }
  };

  const url = req.url.split('?')[0];

  // ── REGISTER ──
  if (url === '/api/register' && req.method === 'POST') {
    getBody().then(({ username, displayName, password }) => {
      if (!username || !password || !displayName) return sendJSON(400, { error: "Barcha maydonlar to'ldirilsin" });
      for (const u of db.users.values())
        if (u.username === username.toLowerCase()) return sendJSON(409, { error: "Bu username band" });
      const colors = ['#7c3aed','#0891b2','#059669','#dc2626','#d97706','#db2777'];
      const id = 'u-' + uuidv4().slice(0,8);
      const user = { id, username: username.toLowerCase(), displayName, avatar: displayName.slice(0,2).toUpperCase(), color: colors[db.users.size % colors.length], passwordHash: hashPw(password), online: false, lastSeen: new Date() };
      db.users.set(id, user);
      const token = jwt.sign({ userId: id }, SECRET, { expiresIn: '30d' });
      sendJSON(200, { token, user: safe(user) });
    });
    return;
  }

  // ── LOGIN ──
  if (url === '/api/login' && req.method === 'POST') {
    getBody().then(({ username, password }) => {
      let found = null;
      for (const u of db.users.values()) if (u.username === username?.toLowerCase()) { found = u; break; }
      if (!found || !checkPw(password, found.passwordHash)) return sendJSON(401, { error: "Username yoki parol noto'g'ri" });
      const token = jwt.sign({ userId: found.id }, SECRET, { expiresIn: '30d' });
      sendJSON(200, { token, user: safe(found) });
    });
    return;
  }

  // ── USERS ──
  if (url === '/api/users' && req.method === 'GET') {
    const uid = authMW();
    if (!uid) return sendJSON(401, { error: 'Token kerak' });
    const list = [];
    for (const u of db.users.values()) if (u.id !== uid) list.push(safe(u));
    sendJSON(200, list);
    return;
  }

  // ── MESSAGES ──
  if (url.startsWith('/api/messages/') && req.method === 'GET') {
    const uid = authMW();
    if (!uid) return sendJSON(401, { error: 'Token kerak' });
    const peerId = url.split('/api/messages/')[1];
    const cid = chatId(uid, peerId);
    sendJSON(200, db.messages.get(cid) || []);
    return;
  }

  // ── STATIC FILES ──
  let filePath = path.join(__dirname, '../client', url === '/' ? 'index.html' : url);
  if (!fs.existsSync(filePath)) filePath = path.join(__dirname, '../client/index.html');
  const ext = path.extname(filePath);
  const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.ico':'image/x-icon' }[ext] || 'text/plain';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

// ── WEBSOCKET ──
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  let userId = null;
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }

    if (d.type === 'auth') {
      try {
        userId = jwt.verify(d.token, SECRET).userId;
        conns.set(userId, ws);
        const u = db.users.get(userId);
        if (u) { u.online = true; u.lastSeen = new Date(); }
        ws.send(JSON.stringify({ type: 'auth_ok', userId }));
        ws.send(JSON.stringify({ type: 'online_users', users: onlineList() }));
        broadcast({ type: 'user_online', userId, displayName: u?.displayName });
      } catch { ws.send(JSON.stringify({ type: 'auth_error' })); }
      return;
    }
    if (!userId) return;

    if (d.type === 'message') {
      const msg = { id: uuidv4(), fromId: userId, toId: d.toId, text: d.text?.trim(), time: new Date().toISOString(), read: false };
      if (!msg.text || !msg.toId) return;
      const cid = chatId(userId, d.toId);
      if (!db.messages.has(cid)) db.messages.set(cid, []);
      db.messages.get(cid).push(msg);
      ws.send(JSON.stringify({ type: 'message_sent', message: msg }));
      const rws = conns.get(d.toId);
      if (rws?.readyState === 1) rws.send(JSON.stringify({ type: 'new_message', message: msg }));
      return;
    }
    if (d.type === 'typing') {
      const rws = conns.get(d.toId);
      if (rws?.readyState === 1) rws.send(JSON.stringify({ type: 'typing', fromId: userId, isTyping: d.isTyping }));
      return;
    }
    if (d.type === 'read') {
      const cid = chatId(userId, d.fromId);
      (db.messages.get(cid) || []).forEach(m => { if (m.toId === userId) m.read = true; });
      const sws = conns.get(d.fromId);
      if (sws?.readyState === 1) sws.send(JSON.stringify({ type: 'read_receipt', chatWith: userId }));
      return;
    }
    if (d.type === 'ai_message') { handleAI(ws, d.messages); return; }
  });

  ws.on('close', () => {
    if (!userId) return;
    conns.delete(userId);
    const u = db.users.get(userId);
    if (u) { u.online = false; u.lastSeen = new Date(); }
    broadcast({ type: 'user_offline', userId });
  });
});

async function handleAI(ws, messages) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, system: 'Siz DigNets messengerning AI yordamchisasiz. Qisqa uzbek tilida javob bering.', messages }),
    });
    const data = await res.json();
    ws.send(JSON.stringify({ type: 'ai_reply', text: data.content?.[0]?.text || '...' }));
  } catch {
    ws.send(JSON.stringify({ type: 'ai_reply', text: "AI hozirda band." }));
  }
}

function chatId(a, b) { return [a, b].sort().join('__'); }
function safe(u) { return { id: u.id, username: u.username, displayName: u.displayName, avatar: u.avatar, color: u.color, online: u.online, lastSeen: u.lastSeen }; }
function onlineList() { return [...conns.keys()].map(id => db.users.get(id)).filter(Boolean).map(safe); }
function broadcast(data) { const m = JSON.stringify(data); for (const ws of conns.values()) if (ws.readyState === 1) ws.send(m); }

server.listen(PORT, () => console.log(`🚀 DigNets → http://localhost:${PORT}`));
