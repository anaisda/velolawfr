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

// Multer — store uploads in OS temp dir, keep original extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    cb(null, `velolaw_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB max

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET       = process.env.JWT_SECRET       || 'velolaw-secret-change-in-prod';
const ADMIN_EMAIL      = process.env.ADMIN_EMAIL      || 'anais@velolaw.io';
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD   || 'velolaw-admin-2025';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'velolaw-admin-secret-change';

// ─── In-memory DB ─────────────────────────────────────────────
const db = {
  users:     [],
  analyses:  [],
  sessions:  [],
  events:    [],
  nextUserId:     1,
  nextAnalysisId: 1,
  nextSessionId:  1,
  nextEventId:    1,
};

// ─── Helpers ──────────────────────────────────────────────────
function logEvent(type, userId, email, detail, ip = '') {
  db.events.unshift({ id: db.nextEventId++, type, userId, email, detail, ip, at: new Date().toISOString() });
  if (db.events.length > 500) db.events.pop();
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || 'unknown';
}

function getUserAgent(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Firefox')) return 'Firefox / ' + (ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : 'Linux');
  if (ua.includes('Chrome'))  return 'Chrome / '  + (ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Android') ? 'Android' : 'Linux');
  if (ua.includes('Safari'))  return 'Safari / '  + (ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : 'macOS');
  if (ua.includes('Edge'))    return 'Edge / Windows';
  return ua.slice(0, 40) || 'Unknown';
}

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

function adminMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'No admin token' });
  try { req.admin = jwt.verify(token, ADMIN_JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid admin token' }); }
}

// ─── USER AUTH ─────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  const ip = getClientIp(req);
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (email === ADMIN_EMAIL) return res.status(400).json({ error: 'Email not available' });
  if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: db.nextUserId++, name, email, passwordHash,
    plan: 'free', status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: null, loginCount: 0, analysisCount: 0, lastIp: ip,
  };
  db.users.push(user);
  logEvent('register', user.id, email, `New user: ${name}`, ip);

  const token = jwt.sign({ id: user.id, email, name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name, email, plan: user.plan } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  const user = db.users.find(u => u.email === email);
  if (!user) { logEvent('failed_login', null, email, 'Invalid email', ip); return res.status(400).json({ error: 'Invalid credentials' }); }
  if (user.status === 'suspended') { logEvent('failed_login', user.id, email, 'Suspended account login attempt', ip); return res.status(403).json({ error: 'Account suspended.' }); }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { logEvent('failed_login', user.id, email, 'Wrong password', ip); return res.status(400).json({ error: 'Invalid credentials' }); }

  user.lastLogin  = new Date().toISOString();
  user.loginCount = (user.loginCount || 0) + 1;
  user.lastIp     = ip;

  db.sessions.forEach(s => { if (s.userId === user.id) s.active = false; });
  const session = { id: db.nextSessionId++, userId: user.id, email, name: user.name, ip, userAgent: ua, loginAt: new Date().toISOString(), active: true };
  db.sessions.unshift(session);
  if (db.sessions.length > 200) db.sessions.pop();

  logEvent('login', user.id, email, `Login from ${ip} (${ua})`, ip);

  const token = jwt.sign({ id: user.id, email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email, plan: user.plan } });
});

app.post('/api/logout', authMiddleware, (req, res) => {
  db.sessions.forEach(s => { if (s.userId === req.user.id && s.active) s.active = false; });
  logEvent('logout', req.user.id, req.user.email, 'User logged out', getClientIp(req));
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, plan: user.plan });
});

// ─── ANALYSIS ROUTES ───────────────────────────────────────────
app.post('/api/analyze', authMiddleware, upload.single('file'), async (req, res) => {
  const ip = getClientIp(req);
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const params = req.body.params ? JSON.parse(req.body.params) : {};
  const fileName = req.file.originalname;
  const filePath = req.file.path;

  const user = db.users.find(u => u.id === req.user.id);
  if (user) user.analysisCount = (user.analysisCount || 0) + 1;

  const analysis = {
    id: db.nextAnalysisId++, userId: req.user.id, name: fileName,
    status: 'processing', step: 'Queued', pct: 0,
    createdAt: new Date().toISOString(), params, results: null, summary: null,
    filePath,
  };
  db.analyses.push(analysis);
  logEvent('analysis', req.user.id, req.user.email, `Analysis started: ${fileName}`, ip);

  // Spawn Python worker
  const callbackUrl = `http://localhost:${PORT}/internal/analysis-callback`;
  const workerPath  = path.join(__dirname, 'analysis_worker.py');
  const paramsJson  = JSON.stringify(params);

  const child = spawn('python3', [workerPath, String(analysis.id), filePath, paramsJson, callbackUrl], {
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', d => console.log('[worker]', d.toString().trim()));
  child.stderr.on('data', d => console.error('[worker]', d.toString().trim()));
  child.on('close', code => {
    if (code !== 0 && analysis.status !== 'complete') {
      analysis.status = 'failed';
      analysis.error  = 'Worker exited with code ' + code;
      logEvent('analysis_failed', analysis.userId, req.user.email, `Worker exit ${code}`);
    }
    // Clean up temp file
    fs.unlink(filePath, () => {});
  });

  res.json({ analysisId: analysis.id, message: 'Analysis started' });
});

// Internal callback — called by Python worker
app.post('/internal/analysis-callback', express.json({ limit: '200mb' }), (req, res) => {
  const { jobId, status, step, pct, results, error } = req.body;
  const analysis = db.analyses.find(a => a.id === parseInt(jobId));
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

  if (status === 'progress') {
    analysis.step = step || analysis.step;
    analysis.pct  = pct  || analysis.pct;
  } else if (status === 'complete') {
    analysis.status  = 'complete';
    analysis.pct     = 100;
    analysis.results = results;
    // Build summary from real results
    const eqs = results?.equations || [];
    const best = eqs.reduce((a, e) => e.r2 > (a?.r2 || -1) ? e : a, null);
    analysis.summary = {
      topGene:    best?.gene   || '—',
      bestR2:     best?.r2     || 0,
      stages:     results?.stages?.length || 4,
      regulators: results?.regulators?.length || 0,
      equations:  eqs.length,
    };
    const u = db.users.find(u => u.id === analysis.userId);
    logEvent('analysis_done', analysis.userId, u?.email || '', `Analysis complete: ${analysis.name} (${eqs.length} equations)`);
  } else if (status === 'failed') {
    analysis.status = 'failed';
    analysis.error  = error || 'Unknown error';
    const u = db.users.find(u => u.id === analysis.userId);
    logEvent('analysis_failed', analysis.userId, u?.email || '', `Analysis failed: ${error?.slice(0,80)}`);
  }

  res.json({ ok: true });
});

app.get('/api/analyses', authMiddleware, (req, res) => {
  res.json(db.analyses.filter(a => a.userId === req.user.id).map(a => ({ id: a.id, name: a.name, status: a.status, createdAt: a.createdAt, summary: a.summary })));
});

app.get('/api/analyses/:id/status', authMiddleware, (req, res) => {
  const a = db.analyses.find(a => a.id === parseInt(req.params.id) && a.userId === req.user.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json({
    status:  a.status,
    step:    a.step || '',
    pct:     a.pct  || 0,
    error:   a.error || null,
    results: a.status === 'complete' ? a.results : null,
  });
});

app.get('/api/demo-results', (req, res) => res.json(generateDemoResults()));

// ─── ADMIN AUTH ────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
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

// ─── ADMIN DATA ROUTES ──────────────────────────────────────────
app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  const now = Date.now();
  const today = new Date(); today.setHours(0,0,0,0);

  const dailySignups  = Array.from({length:14}, (_,i) => {
    const d = new Date(now-(13-i)*86400000); d.setHours(0,0,0,0);
    const n = new Date(d.getTime()+86400000);
    return db.users.filter(u => new Date(u.createdAt)>=d && new Date(u.createdAt)<n).length;
  });
  const dailyLogins   = Array.from({length:14}, (_,i) => {
    const d = new Date(now-(13-i)*86400000); d.setHours(0,0,0,0);
    const n = new Date(d.getTime()+86400000);
    return db.events.filter(e => e.type==='login' && new Date(e.at)>=d && new Date(e.at)<n).length;
  });
  const dailyAnalyses = Array.from({length:14}, (_,i) => {
    const d = new Date(now-(13-i)*86400000); d.setHours(0,0,0,0);
    const n = new Date(d.getTime()+86400000);
    return db.events.filter(e => e.type==='analysis' && new Date(e.at)>=d && new Date(e.at)<n).length;
  });

  res.json({
    totalUsers:     db.users.length,
    activeUsers:    db.users.filter(u=>u.status==='active').length,
    suspendedUsers: db.users.filter(u=>u.status==='suspended').length,
    newToday:       db.users.filter(u=>new Date(u.createdAt)>=today).length,
    activeSessions: db.sessions.filter(s=>s.active).length,
    totalSessions:  db.sessions.length,
    totalLogins:    db.users.reduce((a,u)=>a+(u.loginCount||0),0),
    totalAnalyses:  db.analyses.length,
    dailySignups, dailyLogins, dailyAnalyses,
  });
});

app.get('/api/admin/users', adminMiddleware, (req, res) => {
  res.json(db.users.map(u => ({
    id: u.id, name: u.name, email: u.email, plan: u.plan, status: u.status,
    createdAt: u.createdAt, lastLogin: u.lastLogin,
    loginCount: u.loginCount||0, analysisCount: u.analysisCount||0, lastIp: u.lastIp||null,
    activeSessions: db.sessions.filter(s=>s.userId===u.id&&s.active).length,
  })));
});

app.get('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const user = db.users.find(u=>u.id===parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id:user.id, name:user.name, email:user.email, plan:user.plan, status:user.status,
    createdAt:user.createdAt, lastLogin:user.lastLogin,
    loginCount:user.loginCount||0, analysisCount:user.analysisCount||0, lastIp:user.lastIp,
    sessions:  db.sessions.filter(s=>s.userId===user.id),
    events:    db.events.filter(e=>e.userId===user.id).slice(0,30),
    analyses:  db.analyses.filter(a=>a.userId===user.id).map(a=>({id:a.id,name:a.name,status:a.status,createdAt:a.createdAt})),
  });
});

app.patch('/api/admin/users/:id/status', adminMiddleware, (req, res) => {
  const user = db.users.find(u=>u.id===parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body;
  if (!['active','suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  user.status = status;
  if (status==='suspended') db.sessions.forEach(s=>{if(s.userId===user.id)s.active=false;});
  logEvent(status==='suspended'?'suspend':'reactivate', user.id, user.email, `Admin set status: ${status}`, getClientIp(req));
  res.json({ ok:true, user:{ id:user.id, status } });
});

app.patch('/api/admin/users/:id/plan', adminMiddleware, (req, res) => {
  const user = db.users.find(u=>u.id===parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { plan } = req.body;
  if (!['free','pro','enterprise'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
  user.plan = plan;
  logEvent('plan_change', user.id, user.email, `Plan changed to ${plan}`, getClientIp(req));
  res.json({ ok:true, user:{ id:user.id, plan } });
});

app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const idx = db.users.findIndex(u=>u.id===parseInt(req.params.id));
  if (idx===-1) return res.status(404).json({ error: 'Not found' });
  const user = db.users[idx];
  db.users.splice(idx, 1);
  db.sessions.forEach(s=>{if(s.userId===user.id)s.active=false;});
  logEvent('delete', user.id, user.email, 'User deleted by admin', getClientIp(req));
  res.json({ ok:true });
});

app.get('/api/admin/sessions', adminMiddleware, (req, res) => res.json(db.sessions.slice(0,100)));

app.delete('/api/admin/sessions/:id', adminMiddleware, (req, res) => {
  const s = db.sessions.find(s=>s.id===parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.active = false;
  logEvent('session_terminate', s.userId, s.email, 'Session terminated by admin', getClientIp(req));
  res.json({ ok:true });
});

app.get('/api/admin/events', adminMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit)||100;
  res.json(db.events.slice(0, limit));
});

// ─── DEMO DATA ─────────────────────────────────────────────────
function generateDemoResults() {
  return {
    dataset: { cells:3696, genes:2000 },
    regulators: ['Hmgn3','Gnas','Gnb1','Pdx1','Neurog3','Pax6','Nkx6-1','Arx','Pax4','Snhg6','Sntg1','Chga','Iapp'],
    equations: [
      { gene:'Ins2', stage:'Maturation', r2:0.870, r2_train:0.91, complexity:'quartic+exp', color:'#6366f1',
        equation:'v=Ins2\u2074\u00b7[...]\u00b2', regulatorsFound:['Ins2','Ins1','Sst','Gnas'], interpretation:'Mature \u03b2-cell feedback.' },
    ],
    stages: [{id:0,name:'Early Progenitor',cells:924},{id:1,name:'Specification',cells:924},{id:2,name:'Differentiation',cells:924},{id:3,name:'Maturation',cells:924}],
    perturbations: [{ target:'Ins2', regulator:'Ins2', overexpression:7.31, knockdown:-0.54 }],
    network: { nodes:[], edges:[] },
    stageProgression: { Ins2:[{stage:'Early Progenitor',r2:-0.02,complexity:45},{stage:'Specification',r2:0.333,complexity:112},{stage:'Differentiation',r2:0.776,complexity:138},{stage:'Maturation',r2:0.870,complexity:187}] }
  };
}

// ─── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.listen(PORT, () => {
  console.log(`VeloLaw running on http://localhost:${PORT}`);
  console.log(`Admin email: ${ADMIN_EMAIL}`);
});
