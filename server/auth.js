import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { all, get, run } from './db.js';
import { nowIso, uid } from './util.js';

const COOKIE_NAME = 'jab_session';
const SESSION_TTL_MS = 7 * 24 * 3600e3; // 7 days
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain at least one letter and one number';
  return null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

async function createSession(res, userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await run('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
    hashToken(token),
    userId,
    nowIso(),
    expires,
  ]);
  // httpOnly: invisible to browser JS; SameSite=Lax: not sent on cross-site posts
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

async function resolveUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  const row = await get(
    `SELECT u.id, u.email, u.name, u.role, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
    [hashToken(token), nowIso()]
  );
  return row ?? null;
}

export async function requireAuth(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export const authRouter = Router();

authRouter.post('/signup', async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    const pwProblem = passwordProblem(password);
    if (pwProblem) return res.status(400).json({ error: pwProblem });

    const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'This email is already registered — try signing in' });

    const id = uid('user');
    const hash = await bcrypt.hash(password, 10);
    await run('INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      id,
      email,
      name,
      hash,
      'user',
      nowIso(),
    ]);
    await createSession(res, id);
    res.status(201).json({ user: { id, email, name, role: 'user' } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already registered — try signing in' });
    }
    next(e);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    await run('DELETE FROM sessions WHERE expires_at < ?', [nowIso()]);
    await createSession(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', async (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) await run('DELETE FROM sessions WHERE id = ?', [hashToken(token)]);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

authRouter.get('/me', async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json({ user: publicUser(user) });
});

/**
 * First-boot seeding: when the users table is empty, create the initial
 * admin from env (or built-in defaults) and assign all pre-existing data
 * (searches, triggers, runs, seen jobs) to that account.
 */
export async function ensureSeedAdmin() {
  const count = (await get('SELECT COUNT(*) AS c FROM users')).c;
  if (Number(count) > 0) return null;

  const email = (process.env.ADMIN_EMAIL || 'admin@jobalert.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const id = uid('user');
  const hash = await bcrypt.hash(password, 10);
  await run('INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    email,
    'Admin',
    hash,
    'admin',
    nowIso(),
  ]);

  // pre-auth data belongs to the first account
  for (const tbl of ['searches', 'triggers', 'runs']) {
    await run(`UPDATE \`${tbl}\` SET user_id = ? WHERE user_id IS NULL`, [id]);
  }
  await run("UPDATE seen_jobs SET user_id = ? WHERE user_id = ''", [id]);

  console.log(`[auth] seeded initial admin account: ${email} / ${password}`);
  return { email, password };
}
