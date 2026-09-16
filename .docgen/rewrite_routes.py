p = 'server/routes.js'
s = open(p, encoding='utf8').read()

# imports
s = s.replace(
    "import { getModule, listModules } from './modules/index.js';",
    "import { getModule, listModules } from './modules/index.js';\nimport {\n  listRoutines,\n  getRoutine,\n  createRoutine,\n  updateRoutine,\n  deleteRoutine,\n  replaceSchedules,\n  createSchedule,\n  deleteSchedule,\n  parseRoutineRow,\n  parseScheduleRow,\n} from './routinesService.js';\nimport { fireRoutine } from './engine.js';"
)

# remove old searches routes block
start = s.index("r.get('/searches', requireAuth")
end = s.index("function searchPayload(body) {")
s = s[:start] + s[end:]

# remove old triggers routes block (from first trigger route to runs route)
start = s.index("r.get('/triggers', requireAuth")
end = s.index("r.get('/runs', requireAuth")
new_routines = """const FREQUENCIES = ['hourly', 'daily', 'weekly'];
const TIME_RE = /^([01]?\\d|2[0-3]):[0-5]\\d$/;

function validRoutineBody(body) {
  const name = String(body.name ?? '').trim();
  if (!name) return { error: 'Routine name is required' };
  const module = String(body.module ?? '');
  if (!MODULES.includes(module)) return { error: 'Module must be linkedin or upwork' };
  const keywords = cleanList(body.keywords);
  if (keywords.length === 0) return { error: 'At least one keyword is required' };
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
    locations: cleanList(body.locations),
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
  fireRoutine(parseRoutineRow({ ...routine, keywords: JSON.stringify(routine.keywords) }), schedule, {
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

r.get('/runs', requireAuth, wrap(async (req, res) => {"""
s = s[:start] + new_routines + s[end:]

# jobs list filter: searchId -> routineId
s = s.replace(
    """  if (f.searchId && f.searchId !== 'all') {
    params.push(f.searchId);
    where.push('j.search_id = ?');
  }""",
    """  if (f.routineId && f.routineId !== 'all') {
    params.push(f.routineId);
    where.push('j.routine_id = ?');
  }"""
)

open(p, 'w', encoding='utf8', newline='\n').write(s)
print('routes rewritten')
