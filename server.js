import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import multer from 'multer';
import os from 'os';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET       = process.env.JWT_SECRET       || 'velolaw-secret-change-in-prod';
const ADMIN_EMAIL      = process.env.ADMIN_EMAIL      || 'anais@velolaw.io';
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD   || 'velolaw-admin-2025';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'velolaw-admin-secret-change';

// ─── SQLite setup ─────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'velolaw.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT,
    login_count INTEGER DEFAULT 0,
    analysis_count INTEGER DEFAULT 0,
    last_ip TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    name TEXT,
    ip TEXT,
    user_agent TEXT,
    login_at TEXT DEFAULT (datetime('now')),
    active INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    status TEXT DEFAULT 'processing',
    step TEXT DEFAULT 'Queued',
    pct INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    params TEXT,
    results TEXT,
    summary TEXT,
    error TEXT,
    file_path TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    user_id INTEGER,
    email TEXT,
    detail TEXT,
    ip TEXT,
    at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── DB helpers ───────────────────────────────────────────────
const logEvent = (type, userId, email, detail, ip = '') => {
  db.prepare('INSERT INTO events (type, user_id, email, detail, ip) VALUES (?, ?, ?, ?, ?)')
    .run(type, userId, email, detail, ip);
};

const getClientIp = req =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

const getUserAgent = req => {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Firefox')) return 'Firefox / ' + (ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : 'Linux');
  if (ua.includes('Chrome'))  return 'Chrome / '  + (ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Android') ? 'Android' : 'Linux');
  if (ua.includes('Safari'))  return 'Safari / iOS';
  return ua.slice(0, 40) || 'Unknown';
};

// ─── Multer ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `velolaw_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

const adminMiddleware = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'No admin token' });
  try { req.admin = jwt.verify(token, ADMIN_JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid admin token' }); }
};

// ─── USER AUTH ─────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  const ip = getClientIp(req);
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (email === ADMIN_EMAIL) return res.status(400).json({ error: 'Email not available' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, last_ip) VALUES (?, ?, ?, ?)'
  ).run(name, email, passwordHash, ip);

  logEvent('register', result.lastInsertRowid, email, `New user: ${name}`, ip);
  const token = jwt.sign({ id: result.lastInsertRowid, email, name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: result.lastInsertRowid, name, email, plan: 'free' } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) { logEvent('failed_login', null, email, 'Invalid email', ip); return res.status(400).json({ error: 'Invalid credentials' }); }
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) { logEvent('failed_login', user.id, email, 'Wrong password', ip); return res.status(400).json({ error: 'Invalid credentials' }); }

  db.prepare('UPDATE users SET last_login = datetime("now"), login_count = login_count + 1, last_ip = ? WHERE id = ?').run(ip, user.id);
  db.prepare('UPDATE sessions SET active = 0 WHERE user_id = ?').run(user.id);
  db.prepare('INSERT INTO sessions (user_id, email, name, ip, user_agent) VALUES (?, ?, ?, ?, ?)').run(user.id, email, user.name, ip, ua);
  logEvent('login', user.id, email, `Login from ${ip} (${ua})`, ip);

  const token = jwt.sign({ id: user.id, email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email, plan: user.plan } });
});

app.post('/api/logout', authMiddleware, (req, res) => {
  db.prepare('UPDATE sessions SET active = 0 WHERE user_id = ?').run(req.user.id);
  logEvent('logout', req.user.id, req.user.email, 'User logged out', getClientIp(req));
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, plan FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── ANALYSIS ──────────────────────────────────────────────────
app.post('/api/analyze', authMiddleware, upload.single('file'), async (req, res) => {
  const ip = getClientIp(req);
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const params   = req.body.params ? JSON.parse(req.body.params) : {};
  const fileName = req.file.originalname;
  const filePath = req.file.path;

  db.prepare('UPDATE users SET analysis_count = analysis_count + 1 WHERE id = ?').run(req.user.id);

  const result = db.prepare(
    'INSERT INTO analyses (user_id, name, status, step, pct, params, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, fileName, 'processing', 'Queued', 0, JSON.stringify(params), filePath);

  const analysisId = result.lastInsertRowid;
  logEvent('analysis', req.user.id, req.user.email, `Analysis started: ${fileName}`, ip);

  const callbackUrl = `http://localhost:${PORT}/internal/analysis-callback`;
  const workerPath  = path.join(__dirname, 'analysis_worker.py');

  const child = spawn('python3', [workerPath, String(analysisId), filePath, JSON.stringify(params), callbackUrl], {
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', d => console.log('[worker]', d.toString().trim()));
  child.stderr.on('data', d => console.error('[worker]', d.toString().trim()));
  child.on('close', code => {
    if (code !== 0) {
      const a = db.prepare('SELECT status FROM analyses WHERE id = ?').get(analysisId);
      if (a && a.status !== 'complete') {
        db.prepare('UPDATE analyses SET status = ?, error = ? WHERE id = ?').run('failed', 'Worker exited with code ' + code, analysisId);
        logEvent('analysis_failed', req.user.id, req.user.email, `Worker exit ${code}`);
      }
    }
    fs.unlink(filePath, () => {});
  });

  res.json({ analysisId, message: 'Analysis started' });
});

// Internal callback from Python worker
app.post('/internal/analysis-callback', express.json({ limit: '200mb' }), (req, res) => {
  const { jobId, status, step, pct, results, error } = req.body;
  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(parseInt(jobId));
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

  if (status === 'progress') {
    db.prepare('UPDATE analyses SET step = ?, pct = ? WHERE id = ?').run(step || analysis.step, pct || analysis.pct, analysis.id);
  } else if (status === 'complete') {
    const eqs  = results?.equations || [];
    const best = eqs.reduce((a, e) => e.r2 > (a?.r2 || -1) ? e : a, null);
    const summary = { topGene: best?.gene || '—', bestR2: best?.r2 || 0, stages: results?.stages?.length || 4, regulators: results?.regulators?.length || 0, equations: eqs.length };
    db.prepare('UPDATE analyses SET status = ?, pct = 100, results = ?, summary = ? WHERE id = ?')
      .run('complete', JSON.stringify(results), JSON.stringify(summary), analysis.id);
    const u = db.prepare('SELECT email FROM users WHERE id = ?').get(analysis.user_id);
    logEvent('analysis_done', analysis.user_id, u?.email || '', `Complete: ${analysis.name} (${eqs.length} equations)`);
  } else if (status === 'failed') {
    db.prepare('UPDATE analyses SET status = ?, error = ? WHERE id = ?').run('failed', error || 'Unknown error', analysis.id);
    const u = db.prepare('SELECT email FROM users WHERE id = ?').get(analysis.user_id);
    logEvent('analysis_failed', analysis.user_id, u?.email || '', `Failed: ${(error||'').slice(0,80)}`);
  }

  res.json({ ok: true });
});

app.get('/api/analyses', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT id, name, status, created_at, summary FROM analyses WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json(rows.map(r => ({ ...r, summary: r.summary ? JSON.parse(r.summary) : null })));
});

app.get('/api/analyses/:id/status', authMiddleware, (req, res) => {
  const a = db.prepare('SELECT * FROM analyses WHERE id = ? AND user_id = ?').get(parseInt(req.params.id), req.user.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json({
    status:  a.status,
    step:    a.step  || '',
    pct:     a.pct   || 0,
    error:   a.error || null,
    results: a.status === 'complete' ? JSON.parse(a.results || 'null') : null,
  });
});

app.get('/api/demo-results', (req, res) => res.json(DEMO_RESULTS_STUB));

// ─── ADMIN AUTH ────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const ip = getClientIp(req);
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    logEvent('admin_failed', null, email, 'Failed admin login', ip);
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  logEvent('admin_login', 0, email, 'Admin logged in', ip);
  const token = jwt.sign({ admin: true, email }, ADMIN_JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// ─── ADMIN DATA ────────────────────────────────────────────────
app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  const totalUsers     = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const activeUsers    = db.prepare("SELECT COUNT(*) as n FROM users WHERE status='active'").get().n;
  const suspendedUsers = db.prepare("SELECT COUNT(*) as n FROM users WHERE status='suspended'").get().n;
  const newToday       = db.prepare("SELECT COUNT(*) as n FROM users WHERE date(created_at)=date('now')").get().n;
  const activeSessions = db.prepare('SELECT COUNT(*) as n FROM sessions WHERE active=1').get().n;
  const totalSessions  = db.prepare('SELECT COUNT(*) as n FROM sessions').get().n;
  const totalLogins    = db.prepare('SELECT COALESCE(SUM(login_count),0) as n FROM users').get().n;
  const totalAnalyses  = db.prepare('SELECT COUNT(*) as n FROM analyses').get().n;

  const dailySignups  = Array.from({length:14}, (_,i) => db.prepare("SELECT COUNT(*) as n FROM users WHERE date(created_at)=date('now',?)").get(`-${13-i} days`).n);
  const dailyLogins   = Array.from({length:14}, (_,i) => db.prepare("SELECT COUNT(*) as n FROM events WHERE type='login' AND date(at)=date('now',?)").get(`-${13-i} days`).n);
  const dailyAnalyses = Array.from({length:14}, (_,i) => db.prepare("SELECT COUNT(*) as n FROM events WHERE type='analysis' AND date(at)=date('now',?)").get(`-${13-i} days`).n);

  res.json({ totalUsers, activeUsers, suspendedUsers, newToday, activeSessions, totalSessions, totalLogins, totalAnalyses, dailySignups, dailyLogins, dailyAnalyses });
});

app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY id DESC').all();
  res.json(users.map(u => ({
    id: u.id, name: u.name, email: u.email, plan: u.plan, status: u.status,
    createdAt: u.created_at, lastLogin: u.last_login,
    loginCount: u.login_count||0, analysisCount: u.analysis_count||0, lastIp: u.last_ip,
    activeSessions: db.prepare('SELECT COUNT(*) as n FROM sessions WHERE user_id=? AND active=1').get(u.id).n,
  })));
});

app.get('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    id:user.id, name:user.name, email:user.email, plan:user.plan, status:user.status,
    createdAt:user.created_at, lastLogin:user.last_login,
    loginCount:user.login_count||0, analysisCount:user.analysis_count||0, lastIp:user.last_ip,
    sessions:  db.prepare('SELECT * FROM sessions WHERE user_id=? ORDER BY id DESC LIMIT 20').all(user.id),
    events:    db.prepare('SELECT * FROM events WHERE user_id=? ORDER BY id DESC LIMIT 30').all(user.id),
    analyses:  db.prepare('SELECT id,name,status,created_at FROM analyses WHERE user_id=? ORDER BY id DESC').all(user.id),
  });
});

app.patch('/api/admin/users/:id/status', adminMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body;
  if (!['active','suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE users SET status=? WHERE id=?').run(status, user.id);
  if (status==='suspended') db.prepare('UPDATE sessions SET active=0 WHERE user_id=?').run(user.id);
  logEvent(status==='suspended'?'suspend':'reactivate', user.id, user.email, `Admin set status: ${status}`, getClientIp(req));
  res.json({ ok:true });
});

app.patch('/api/admin/users/:id/plan', adminMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { plan } = req.body;
  if (!['free','pro','enterprise'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
  db.prepare('UPDATE users SET plan=? WHERE id=?').run(plan, user.id);
  logEvent('plan_change', user.id, user.email, `Plan changed to ${plan}`, getClientIp(req));
  res.json({ ok:true });
});

app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE sessions SET active=0 WHERE user_id=?').run(user.id);
  db.prepare('DELETE FROM users WHERE id=?').run(user.id);
  logEvent('delete', user.id, user.email, 'User deleted by admin', getClientIp(req));
  res.json({ ok:true });
});

app.get('/api/admin/sessions', adminMiddleware, (req, res) =>
  res.json(db.prepare('SELECT * FROM sessions ORDER BY id DESC LIMIT 100').all()));

app.delete('/api/admin/sessions/:id', adminMiddleware, (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE sessions SET active=0 WHERE id=?').run(s.id);
  logEvent('session_terminate', s.user_id, s.email, 'Session terminated by admin', getClientIp(req));
  res.json({ ok:true });
});

app.get('/api/admin/events', adminMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit)||100;
  res.json(db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit));
});

// ─── Health ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status:'ok', version:'2.0.0', db:'sqlite' }));

const DEMO_RESULTS_STUB = { dataset:{cells:3696,genes:2000}, stages:[{id:0,name:'Early Progenitor',cells:924},{id:1,name:'Specification',cells:924},{id:2,name:'Differentiation',cells:924},{id:3,name:'Maturation',cells:924}], regulators:['Hmgn3','Gnas','Gnb1','Pdx1','Neurog3','Pax6','Nkx6-1','Arx','Pax4','Snhg6','Sntg1','Chga','Iapp'], equations:[], perturbations:[], network:{nodes:[],edges:[]}, stageProgression:{Ins2:[]} };

app.listen(PORT, () => {
  console.log(`VeloLaw v2 (SQLite) running on http://localhost:${PORT}`);
  console.log(`DB: ${DB_PATH}`);
});
