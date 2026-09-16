import { all, get, run } from './db.js';
import { uid, nowIso } from './util.js';

export function parseRoutineRow(row) {
  if (!row) return null;
  return {
    ...row,
    keywords: JSON.parse(row.keywords || '[]'),
    locations: JSON.parse(row.locations || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    module_inputs: JSON.parse(row.module_inputs || '{}'),
    volume_per_run: Number(row.volume_per_run ?? 10),
    active: Boolean(row.active),
  };
}

export function parseScheduleRow(row) {
  if (!row) return null;
  return {
    ...row,
    days: JSON.parse(row.days || '[]'),
    active: Boolean(row.active),
  };
}

export async function listRoutines(userId) {
  const rows = await all(
    `SELECT r.*, MIN(s.next_run_at) AS next_run_at, COUNT(s.id) AS schedule_count,
            SUM(s.active = 1) AS active_schedules
     FROM routines r LEFT JOIN schedules s ON s.routine_id = r.id
     WHERE r.user_id = ?
     GROUP BY r.id
     ORDER BY r.updated_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    ...parseRoutineRow(r),
    next_run_at: r.next_run_at,
    schedule_count: Number(r.schedule_count ?? 0),
    active_schedules: Number(r.active_schedules ?? 0),
  }));
}

export async function getRoutine(userId, id) {
  const row = await get('SELECT * FROM routines WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return null;
  const schedules = await all(
    'SELECT * FROM schedules WHERE routine_id = ? ORDER BY type, time',
    [id]
  );
  return { ...parseRoutineRow(row), schedules: schedules.map(parseScheduleRow) };
}

export async function createRoutine(userId, body) {
  const id = uid('routine');
  const now = nowIso();
  await run(
    `INSERT INTO routines (id, user_id, name, description, module, module_inputs, keywords, locations, posted_within, tags, volume_per_run, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      body.name,
      body.description ?? '',
      body.module,
      JSON.stringify(body.module_inputs ?? {}),
      JSON.stringify(body.keywords ?? []),
      JSON.stringify(body.locations ?? []),
      body.posted_within ?? 'week',
      JSON.stringify(body.tags ?? []),
      clampVolume(body.volume_per_run),
      body.active ? 1 : 0,
      now,
      now,
    ]
  );
  for (const sched of body.schedules ?? []) {
    await createSchedule(userId, id, sched, now);
  }
  return id;
}

export async function updateRoutine(userId, id, body) {
  await run(
    `UPDATE routines SET name = ?, description = ?, module = ?, module_inputs = ?, keywords = ?,
      locations = ?, posted_within = ?, tags = ?, volume_per_run = ?, active = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      body.name,
      body.description ?? '',
      body.module,
      JSON.stringify(body.module_inputs ?? {}),
      JSON.stringify(body.keywords ?? []),
      JSON.stringify(body.locations ?? []),
      body.posted_within ?? 'week',
      JSON.stringify(body.tags ?? []),
      clampVolume(body.volume_per_run),
      body.active ? 1 : 0,
      nowIso(),
      id,
      userId,
    ]
  );
}

export async function replaceSchedules(userId, routineId, schedules, computeNextRun) {
  const now = nowIso();
  const keepIds = [];
  for (const sched of schedules ?? []) {
    if (sched.id) {
      const existing = await get(
        'SELECT id FROM schedules WHERE id = ? AND routine_id = ? AND user_id = ?',
        [sched.id, routineId, userId]
      );
      if (existing) {
        await run(
          'UPDATE schedules SET type = ?, time = ?, days = ?, active = ?, next_run_at = ?, updated_at = ? WHERE id = ?',
          [sched.type, sched.time, JSON.stringify(sched.days ?? []), sched.active ? 1 : 0, computeNextRun(sched), now, sched.id]
        );
        keepIds.push(sched.id);
        continue;
      }
    }
    const sid = await createSchedule(userId, routineId, sched, now, computeNextRun);
    keepIds.push(sid);
  }
  // remove schedules that were deleted in the edit
  const current = await all('SELECT id FROM schedules WHERE routine_id = ? AND user_id = ?', [routineId, userId]);
  for (const s of current) {
    if (!keepIds.includes(s.id)) await run('DELETE FROM schedules WHERE id = ?', [s.id]);
  }
}

export async function createSchedule(userId, routineId, sched, now = nowIso(), computeNextRun = null) {
  const id = sched.id ?? uid('sched');
  await run(
    `INSERT INTO schedules (id, user_id, routine_id, type, time, days, active, next_run_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      routineId,
      sched.type,
      sched.time,
      JSON.stringify(sched.days ?? []),
      sched.active === false ? 0 : 1,
      computeNextRun ? computeNextRun(sched) : null,
      now,
      now,
    ]
  );
  return id;
}

export async function deleteRoutine(userId, id) {
  await run('DELETE FROM schedules WHERE routine_id = ? AND user_id = ?', [id, userId]);
  const result = await run('DELETE FROM routines WHERE id = ? AND user_id = ?', [id, userId]);
  return Boolean(result.affectedRows);
}

export async function deleteSchedule(userId, routineId, scheduleId) {
  const result = await run(
    'DELETE FROM schedules WHERE id = ? AND routine_id = ? AND user_id = ?',
    [scheduleId, routineId, userId]
  );
  return Boolean(result.affectedRows);
}

function clampVolume(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 10;
  return Math.min(Math.max(n, 1), 100);
}
