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
import { telegramConfigured } from './telegram.js';
import { config } from './config.js';
import { getModule, listModules } from './modules/index.js';
import {
  listRoutines,
  getRoutine,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  replaceSchedules,
  createSchedule,
  deleteSchedule,
  parseScheduleRow,
} from './routinesService.js';
import { fireRoutine } from './engine.js';
import { jobsByDay, jobsByLocation, sourceYield, jobsByPlatform } from './analyticsService.js';
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

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function validRoutineBody(body) {
  const name = String(body.name ?? '').trim();
  if (!name) return { error: 'Routine name is required' };
  const module = String(body.module ?? '');
  if (!MODULES.includes(module)) return { error: 'Module must be linkedin or upwork' };
  const keywords = cleanList(body.keywords);
  if (keywords.length === 0) return { error: 'At least one keyword is required' };
  const VOLUME_LIMIT_MSG =
    'A routine can only have 1 keyword and 1 location to keep volume per run accurate. Create separate routines for additional searches.';
  if (keywords.length > 1) return { error: VOLUME_LIMIT_MSG };
  const locations = cleanList(body.locations);
  if (locations.length > 1) return { error: VOLUME_LIMIT_MSG };
  const schedules = Array.isArray(body.schedules) ? body.schedules : [];
  for (const sched of schedules) {
    if (!FREQUENCIES.includes(sched.type)) return { error: 'Schedule type must be hourly, daily or weekly' };
    if (!TIME_RE.test(String(sched.time ?? ''))) return { error: 'Schedule time must be HH:MM' };
    if (sched.type === 'weekly' && cleanList(sched.days).length === 0) {
      return { error: 'Weekly schedules need at least one day of week' };
    }
  }
  const volume = Math.round(Number(body.volume_per_run));
  return {
    name,
    module,
    keywords,
    locations,
    tags: cleanList(body.tags),
    description: String(body.description ?? '').trim(),
    posted_within: TIME_FILTERS.includes(body.posted_within) ? body.posted_within : TIME_FILTER_DEFAULT,
    module_inputs: body.module_inputs && typeof body.module_inputs === 'object' ? body.module_inputs : {},
    volume_per_run: Number.isFinite(volume) ? Math.min(Math.max(volume, 1), 100) : 10,
    active: body.active !== false,
    schedules: schedules.map((sc) => ({
      id: sc.id,
      type: sc.type,
      time: String(sc.time),
      days: cleanList(sc.days).map(Number).filter((d) => d >= 1 && d <= 7),
      active: sc.active !== false,
    })),
  };
}

function computeScheduleNext(sc) {
  return computeNextRun(sc.type, sc.time, sc.days ?? []).toISOString();
}

r.get('/routines', requireAuth, wrap(async (req, res) => {
  res.json(await listRoutines(req.user.id));
}));

r.post('/routines', requireAuth, wrap(async (req, res) => {
  const p = validRoutineBody(req.body ?? {});
  if (p.error) return bad(res, p.error);
  if (p.schedules.length === 0) return bad(res, 'Add at least one schedule before saving');
  const id = await createRoutine(req.user.id, p);
  await replaceSchedules(req.user.id, id, p.schedules, computeScheduleNext);
  res.status(201).json(await getRoutine(req.user.id, id));
}));

r.get('/routines/:id', requireAuth, wrap(async (req, res) => {
  const routine = await getRoutine(req.user.id, req.params.id);
  if (!routine) return res.status(404).json({ error: 'Routine not found' });
  const stats = await get(
    "SELECT COUNT(*) AS total, SUM(status = 'success') AS success, SUM(status = 'error') AS failed FROM runs WHERE routine_id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );
  res.json({
    ...routine,
    run_stats: {
      total: Number(stats.total ?? 0),
      success: Number(stats.success ?? 0),
      failed: Number(stats.failed ?? 0),
    },
  });
}));

r.put('/routines/:id', requireAuth, wrap(async (req, res) => {
  const existing = await getRoutine(req.user.id, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Routine not found' });
  const p = validRoutineBody(req.body ?? {});
  if (p.error) return bad(res, p.error);
  if (p.schedules.length === 0) return bad(res, 'Add at least one schedule before saving');
  await updateRoutine(req.user.id, req.params.id, p);
  await replaceSchedules(req.user.id, req.params.id, p.schedules, computeScheduleNext);
  res.json(await getRoutine(req.user.id, req.params.id));
}));

r.delete('/routines/:id', requireAuth, wrap(async (req, res) => {
  const ok = await deleteRoutine(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Routine not found' });
  res.json({ ok: true });
}));

r.post('/routines/:id/run', requireAuth, wrap(async (req, res) => {
  const routine = await getRoutine(req.user.id, req.params.id);
  if (!routine) return res.status(404).json({ error: 'Routine not found' });
  const schedule = [...routine.schedules]
    .filter((s) => s.active)
    .sort((a, b) => (a.next_run_at ?? '9999').localeCompare(b.next_run_at ?? '9999'))[0] ?? null;
  const runId = uid('run');
  fireRoutine(routine, schedule, {
    manual: true,
    runId,
  }).catch((e) => console.error(`[run-now] routine ${routine.name} failed:`, e));
  res.status(202).json({ runId });
}));

r.get('/routines/:id/runs', requireAuth, wrap(async (req, res) => {
  const t = await get('SELECT id FROM routines WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!t) return res.status(404).json({ error: 'Routine not found' });
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 15, 5), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const stats = await get(
    "SELECT COUNT(*) AS total, SUM(status = 'success') AS success, SUM(status = 'error') AS failed FROM runs WHERE routine_id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );
  const total = Number(stats.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * pageSize;
  const rows = await all(
    `SELECT id, status, total_found, new_jobs_count, delivery, error, started_at, finished_at, manual
     FROM runs WHERE routine_id = ? AND user_id = ?
     ORDER BY started_at DESC
     LIMIT ? OFFSET ?`,
    [req.params.id, req.user.id, pageSize, offset]
  );
  res.json({
    total,
    success: Number(stats.success ?? 0),
    failed: Number(stats.failed ?? 0),
    page: safePage,
    pageCount,
    pageSize,
    items: rows,
  });
}));

r.post('/routines/:id/schedules', requireAuth, wrap(async (req, res) => {
  const routine = await getRoutine(req.user.id, req.params.id);
  if (!routine) return res.status(404).json({ error: 'Routine not found' });
  const sc = req.body ?? {};
  if (!FREQUENCIES.includes(sc.type)) return bad(res, 'Schedule type must be hourly, daily or weekly');
  if (!TIME_RE.test(String(sc.time ?? ''))) return bad(res, 'Schedule time must be HH:MM');
  const id = await createSchedule(req.user.id, req.params.id, { ...sc, active: sc.active !== false }, nowIso(), computeScheduleNext);
  res.status(201).json({ id, ...sc, active: sc.active !== false });
}));

r.delete('/routines/:id/schedules/:sid', requireAuth, wrap(async (req, res) => {
  const ok = await deleteSchedule(req.user.id, req.params.id, req.params.sid);
  if (!ok) return res.status(404).json({ error: 'Schedule not found' });
  res.json({ ok: true });
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

r.get('/analytics/jobs-by-day', requireAuth, wrap(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 90);
  res.json(await jobsByDay(req.user.id, days));
}));

r.get('/analytics/jobs-by-location', requireAuth, wrap(async (req, res) => {
  res.json(await jobsByLocation(req.user.id, 10));
}));

r.get('/analytics/source-yield', requireAuth, wrap(async (req, res) => {
  res.json(await sourceYield(req.user.id));
}));

r.get('/analytics/jobs-by-platform', requireAuth, wrap(async (req, res) => {
  res.json(await jobsByPlatform(req.user.id));
}));

r.get('/runs', requireAuth, wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const since = req.query.since;
  const cols = 'id, trigger_id, routine_id, module, search_id, status, total_found, new_jobs_count, delivery, error, started_at, finished_at, manual';
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
