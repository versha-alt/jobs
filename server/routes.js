import { Router } from 'express';
import { requireAuth, requireAdmin, authRouter } from './auth.js';
import {
  getApifySettings,
  saveApifySettings,
  getTelegramSettings,
  saveTelegramSettings,
  testTelegramConnection,
} from './settingsService.js';
import { resetApifyClient } from './apify.js';
import { listJobs, getJob, toggleJobFlag } from './jobsService.js';
import { all, get, run, parseSearchRow, parseTriggerRow } from './db.js';
import { fireTrigger } from './engine.js';
import { telegramConfigured } from './telegram.js';
import { config } from './config.js';
import { getModule, listModules } from './modules/index.js';
import {
  uid,
  nowIso,
  TIME_FILTERS,
  TIME_FILTER_DEFAULT,
  MODULES,
  FREQUENCIES,
  computeNextRun,
} from './util.js';

const r = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg) => res.status(400).json({ error: msg });

const cleanList = (v) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))] : [];

async function validTriggerBody(body, userId) {
  const label = String(body.label ?? '').trim();
  if (!label) return { error: 'Label is required' };
  const module = String(body.module ?? '');
  if (!MODULES.includes(module)) return { error: 'Module must be linkedin or upwork' };
  const mod = getModule(module);
  const linked = String(body.linked_search_id ?? '');
  const search = await get('SELECT id FROM searches WHERE id = ? AND user_id = ?', [linked, userId]);
  if (!search) return { error: 'Linked search not found' };
  const frequency = String(body.frequency ?? '');
  if (!FREQUENCIES.includes(frequency)) return { error: 'Frequency must be hourly, daily or weekly' };
  let time = String(body.time ?? '09:00');
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) time = '09:00';
  const days = cleanList(body.days_of_week).map(Number).filter((d) => d >= 1 && d <= 7);
  if (frequency === 'weekly' && days.length === 0) {
    return { error: 'Pick at least one day of the week' };
  }
  const known = new Set((mod.inputFields ?? []).map((f) => f.key));
  const rawInputs = body.module_inputs && typeof body.module_inputs === 'object' ? body.module_inputs : {};
  const moduleInputs = {};
  for (const [key, value] of Object.entries(rawInputs)) {
    if (!known.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    moduleInputs[key] = value;
  }
  return { label, module, linked, frequency, time, days, moduleInputs };
}

r.get('/modules', (_req, res) => {
  res.json(
    listModules().map(({ id, label, inputFields, actorIdExample, actorEnv }) => ({
      id,
      label,
      inputFields,
      actorIdExample,
      actorEnv,
    }))
  );
});

r.get('/runs/:id/jobs/:source/:jobId', requireAuth, wrap(async (req, res) => {
  const { id, source, jobId } = req.params;
  const row = await get(
    'SELECT id, all_jobs, new_jobs, raw_jobs FROM runs WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );
  if (!row) return res.status(404).json({ error: 'Run not found' });
  const all = row.all_jobs ? JSON.parse(row.all_jobs) : [];
  const fresh = JSON.parse(row.new_jobs || '[]');
  const raws = row.raw_jobs ? JSON.parse(row.raw_jobs) : [];
  const job =
    all.find((j) => j.job_id === jobId && j.source === source) ??
    fresh.find((j) => j.job_id === jobId && j.source === source) ??
    null;
  const raw = raws.find((r) => String(r.id) === jobId) ?? null;
  if (!job && !raw) return res.status(404).json({ error: 'Job not found in this run' });
  res.json({ job, raw });
}));

r.get('/health', (_req, res) => {
  res.json({
    ok: true,
    apify: Boolean(config.apifyToken),
    telegram: telegramConfigured(),
    actors: { linkedin: Boolean(config.linkedinActorId), upwork: Boolean(config.upworkActorId) },
  });
});

r.get('/countries', requireAuth, wrap(async (_req, res) => {
  res.json(await all('SELECT * FROM countries ORDER BY name'));
}));

r.post('/countries', requireAuth, wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return bad(res, 'Country name is required');
  try {
    const result = await run('INSERT INTO countries (name) VALUES (?)', [name]);
    res.status(201).json(await get('SELECT * FROM countries WHERE id = ?', [result.insertId]));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `"${name}" is already in the list` });
    }
    throw e;
  }
}));

r.delete('/countries/:id', requireAuth, wrap(async (req, res) => {
  const result = await run('DELETE FROM countries WHERE id = ?', [Number(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Country not found' });
  res.json({ ok: true });
}));

r.get('/searches', requireAuth, wrap(async (req, res) => {
  res.json(
    (await all('SELECT * FROM searches WHERE user_id = ? ORDER BY created_at DESC', [req.user.id])).map(parseSearchRow)
  );
}));

r.get('/searches/:id', requireAuth, wrap(async (req, res) => {
  const row = await get('SELECT * FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: 'Search not found' });
  res.json(parseSearchRow(row));
}));

function searchPayload(body) {
  const keywords = cleanList(body.keywords);
  if (keywords.length === 0) return { error: 'At least one keyword is required' };
  const locations = cleanList(body.locations);
  const tags = cleanList(body.tags);
  const tf = TIME_FILTERS.includes(body.time_filter) ? body.time_filter : TIME_FILTER_DEFAULT;
  return { keywords, locations, tags, tf };
}

r.post('/searches', requireAuth, wrap(async (req, res) => {
  const p = searchPayload(req.body ?? {});
  if (p.error) return bad(res, p.error);
  const id = uid('search');
  const now = nowIso();
  await run(
    'INSERT INTO searches (id, user_id, keywords, locations, time_filter, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, JSON.stringify(p.keywords), JSON.stringify(p.locations), p.tf, JSON.stringify(p.tags), now, now]
  );
  res.status(201).json(parseSearchRow(await get('SELECT * FROM searches WHERE id = ? AND user_id = ?', [id, req.user.id])));
}));

r.put('/searches/:id', requireAuth, wrap(async (req, res) => {
  const existing = await get('SELECT id FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'Search not found' });
  const p = searchPayload(req.body ?? {});
  if (p.error) return bad(res, p.error);
  await run(
    'UPDATE searches SET keywords = ?, locations = ?, time_filter = ?, tags = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(p.keywords), JSON.stringify(p.locations), p.tf, JSON.stringify(p.tags), nowIso(), req.params.id]
  );
  res.json(parseSearchRow(await get('SELECT * FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])));
}));

r.delete('/searches/:id', requireAuth, wrap(async (req, res) => {
  const used = (await get('SELECT COUNT(*) AS c FROM triggers WHERE linked_search_id = ?', [req.params.id])).c;
  if (used > 0) {
    return res.status(409).json({ error: 'This search is linked to a trigger — delete the trigger first' });
  }
  const result = await run('DELETE FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Search not found' });
  res.json({ ok: true });
}));

r.get('/triggers', requireAuth, wrap(async (req, res) => {
  const rows = await all('SELECT * FROM triggers WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  const sRows = await all('SELECT id, keywords, time_filter FROM searches');
  const searches = {};
  for (const s of sRows) {
    try {
      searches[s.id] = { id: s.id, keywords: JSON.parse(s.keywords), time_filter: s.time_filter };
    } catch {
      searches[s.id] = { id: s.id, keywords: [], time_filter: 'week' };
    }
  }
  res.json(
    rows.map((row) => {
      const t = parseTriggerRow(row);
      const s = searches[t.linked_search_id];
      return { ...t, search: s ? { id: s.id, keywords: s.keywords, time_filter: s.time_filter } : null };
    })
  );
}));

r.post('/triggers', requireAuth, wrap(async (req, res) => {
  const p = await validTriggerBody(req.body ?? {}, req.user.id);
  if (p.error) return bad(res, p.error);
  const id = uid('trigger');
  const now = nowIso();
  const next = computeNextRun(p.frequency, p.time, p.days).toISOString();
  await run(
    'INSERT INTO triggers (id, user_id, label, module, linked_search_id, frequency, time, days_of_week, module_inputs, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, p.label, p.module, p.linked, p.frequency, p.time, JSON.stringify(p.days), JSON.stringify(p.moduleInputs), next, now, now]
  );
  res.status(201).json(parseTriggerRow(await get('SELECT * FROM triggers WHERE id = ? AND user_id = ?', [id, req.user.id])));
}));

r.put('/triggers/:id', requireAuth, wrap(async (req, res) => {
  const existing = await get('SELECT id FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'Trigger not found' });
  const p = await validTriggerBody(req.body ?? {}, req.user.id);
  if (p.error) return bad(res, p.error);
  const next = computeNextRun(p.frequency, p.time, p.days).toISOString();
  await run(
    'UPDATE triggers SET label = ?, module = ?, linked_search_id = ?, frequency = ?, time = ?, days_of_week = ?, module_inputs = ?, next_run_at = ?, updated_at = ? WHERE id = ?',
    [p.label, p.module, p.linked, p.frequency, p.time, JSON.stringify(p.days), JSON.stringify(p.moduleInputs), next, nowIso(), req.params.id]
  );
  res.json(parseTriggerRow(await get('SELECT * FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])));
}));

r.delete('/triggers/:id', requireAuth, wrap(async (req, res) => {
  const result = await run('DELETE FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Trigger not found' });
  res.json({ ok: true });
}));

r.post('/triggers/:id/run', requireAuth, wrap(async (req, res) => {
  const row = await get('SELECT * FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: 'Trigger not found' });
  const trigger = parseTriggerRow(row);
  const runId = uid('run');
  fireTrigger(trigger, { manual: true, runId }).catch((e) =>
    console.error(`[run-now] trigger ${trigger.id} failed:`, e)
  );
  res.status(202).json({ runId });
}));

r.get('/settings/telegram', requireAuth, requireAdmin, wrap(async (_req, res) => {
  res.json(getTelegramSettings());
}));

r.put('/settings/telegram', requireAuth, requireAdmin, wrap(async (req, res) => {
  const settings = await saveTelegramSettings(req.body ?? {});
  res.json(settings);
}));

r.post('/settings/telegram/test', requireAuth, requireAdmin, wrap(async (req, res) => {
  const result = await testTelegramConnection({ sendTest: Boolean(req.body?.sendTest) });
  res.json(result);
}));

r.get('/settings/apify', requireAuth, requireAdmin, wrap(async (_req, res) => {
  res.json(getApifySettings());
}));

r.put('/settings/apify', requireAuth, requireAdmin, wrap(async (req, res) => {
  const settings = await saveApifySettings(req.body ?? {});
  resetApifyClient();
  res.json(settings);
}));

r.get('/jobs', requireAuth, wrap(async (req, res) => {
  const f = { ...req.query };
  const data = await listJobs(req.user.id, f);
  res.json(data);
}));

r.get('/jobs/:id', requireAuth, wrap(async (req, res) => {
  const job = await getJob(req.user.id, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
}));

r.post('/jobs/:id/bookmark', requireAuth, wrap(async (req, res) => {
  const value = await toggleJobFlag(req.user.id, req.params.id, 'bookmarked');
  if (value === null) return res.status(404).json({ error: 'Job not found' });
  res.json({ bookmarked: value });
}));

r.post('/jobs/:id/dismiss', requireAuth, wrap(async (req, res) => {
  const value = await toggleJobFlag(req.user.id, req.params.id, 'dismissed');
  if (value === null) return res.status(404).json({ error: 'Job not found' });
  res.json({ dismissed: value });
}));

r.get('/triggers/:id/runs', requireAuth, wrap(async (req, res) => {
  const t = await get('SELECT id FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!t) return res.status(404).json({ error: 'Schedule not found' });
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 15, 5), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const stats = await get(
    "SELECT COUNT(*) AS total, SUM(status = 'success') AS success, SUM(status = 'error') AS failed FROM runs WHERE trigger_id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );
  const total = Number(stats.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * pageSize;
  const rows = await all(
    `SELECT id, status, total_found, new_jobs_count, delivery, error, started_at, finished_at, manual
     FROM runs WHERE trigger_id = ? AND user_id = ?
     ORDER BY started_at DESC
     LIMIT ? OFFSET ?`,
    [req.params.id, req.user.id, pageSize, offset]
  );
  res.json({
    total: Number(total),
    success: Number(stats.success ?? 0),
    failed: Number(stats.failed ?? 0),
    page: safePage,
    pageCount,
    pageSize,
    items: rows,
  });
}));

r.get('/runs', requireAuth, wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const since = req.query.since;
  const cols = 'id, trigger_id, module, search_id, status, total_found, new_jobs_count, delivery, error, started_at, finished_at';
  const rows = since
    ? await all(
        `SELECT ${cols} FROM runs WHERE user_id = ? AND finished_at > ? ORDER BY finished_at DESC LIMIT ${limit}`,
        [req.user.id, String(since)]
      )
    : await all(`SELECT ${cols} FROM runs WHERE user_id = ? ORDER BY started_at DESC LIMIT ${limit}`, [req.user.id]);
  res.json(rows);
}));

r.get('/runs/:id', requireAuth, wrap(async (req, res) => {
  const row = await get(
    `SELECT r.id, r.trigger_id, r.module, r.search_id, r.status, r.total_found, r.new_jobs_count,
            r.delivery, r.error, r.new_jobs, r.all_jobs, r.started_at, r.finished_at, r.manual,
            t.label AS trigger_label
     FROM runs r LEFT JOIN triggers t ON t.id = r.trigger_id
     WHERE r.id = ? AND r.user_id = ?`,
    [req.params.id, req.user.id]
  );
  if (!row) return res.status(404).json({ error: 'Run not found' });
  res.json({
    ...row,
    manual: Boolean(row.manual),
    new_jobs: JSON.parse(row.new_jobs || '[]'),
    all_jobs: row.all_jobs ? JSON.parse(row.all_jobs) : null,
  });
}));

r.delete('/runs/:id', requireAuth, wrap(async (req, res) => {
  const result = await run('DELETE FROM runs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Run not found' });
  res.json({ ok: true });
}));

export { authRouter };
export default r;
