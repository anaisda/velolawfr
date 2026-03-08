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

const logEvent = (type, userId, email, detail, ip = '') => {
  db.prepare('INSERT INTO events (type, user_id, email, detail, ip) VALUES (?, ?, ?, ?, ?)')
    .run(type, userId, email, detail, ip);
};

const getClientIp = req =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

const getUserAgent = req => {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome'))  return 'Chrome';
  if (ua.includes('Safari'))  return 'Safari';
  return 'Unknown';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `velolaw_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

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

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  const ip = getClientIp(req);
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, last_ip) VALUES (?, ?, ?, ?)').run(name, email, passwordHash, ip);
  const token = jwt.sign({ id: result.lastInsertRowid, email, name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: result.lastInsertRowid, name, email, plan: 'free' } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = getClientIp(req);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(400).json({ error: 'Invalid credentials' });
  
  db.prepare('UPDATE users SET last_login = datetime("now"), login_count = login_count + 1, last_ip = ? WHERE id = ?').run(ip, user.id);
  const token = jwt.sign({ id: user.id, email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email, plan: user.plan } });
});

app.post('/api/analyze', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const params = req.body.params ? JSON.parse(req.body.params) : {};
  const result = db.prepare('INSERT INTO analyses (user_id, name, params, file_path) VALUES (?, ?, ?, ?)').run(req.user.id, req.file.originalname, JSON.stringify(params), req.file.path);
  res.json({ analysisId: result.lastInsertRowid, message: 'Analysis started' });
});

app.get('/api/analyses', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM analyses WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json(rows.map(r => ({ ...r, summary: r.summary ? JSON.parse(r.summary) : null })));
});

app.get('/api/analyses/:id/status', authMiddleware, (req, res) => {
  const a = db.prepare('SELECT * FROM analyses WHERE id = ? AND user_id = ?').get(parseInt(req.params.id), req.user.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json({ status: a.status, step: a.step, pct: a.pct, results: a.results ? JSON.parse(a.results) : null });
});

app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const totalAnalyses = db.prepare('SELECT COUNT(*) as n FROM analyses').get().n;
  const newToday = db.prepare("SELECT COUNT(*) as n FROM users WHERE date(created_at)=date('now')").get().n;

  const dailySignups = Array.from({length:14}, (_,i) => db.prepare("SELECT COUNT(*) as n FROM users WHERE date(created_at)=date('now',?)").get(`-${13-i} days`).n);
  res.json({ totalUsers, totalAnalyses, newToday, dailySignups });
});

app.get('/api/health', (req, res) => res.json({ status:'ok', version:'2.0.2' }));

app.listen(PORT, () => console.log(`VeloLaw Backend running on http://localhost:${PORT}`));
