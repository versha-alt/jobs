import { all, get, run } from './db.js';
import { fireRoutine } from './engine.js';
import { computeNextRun, nowIso } from './util.js';

const TICK_MS = 15000;

function nextFor(schedule) {
  return computeNextRun(schedule.type, schedule.time, schedule.days ?? []);
}

export async function startScheduler() {
  const unscheduled = await all(
    'SELECT * FROM schedules WHERE active = 1 AND next_run_at IS NULL'
  );
  for (const s of unscheduled) {
    await run('UPDATE schedules SET next_run_at = ? WHERE id = ?', [nextFor(s).toISOString(), s.id]);
  }
  const row = await get('SELECT COUNT(*) AS c FROM schedules WHERE active = 1');
  console.log(`[scheduler] watching ${row.c} schedule(s), tick every ${TICK_MS / 1000}s`);
  setInterval(() => {
    tick().catch((e) => console.error('[scheduler] tick failed:', e));
  }, TICK_MS);
}

async function tick() {
  const due = await all(
    'SELECT * FROM schedules WHERE active = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?',
    [nowIso()]
  );
  for (const schedule of due) {
    // reschedule first so a slow run can never double-fire the same slot
    const next = nextFor(schedule);
    await run('UPDATE schedules SET next_run_at = ? WHERE id = ?', [
      next.toISOString(),
      schedule.id,
    ]);
    const routine = await get('SELECT * FROM routines WHERE id = ? AND user_id = ?', [
      schedule.routine_id,
      schedule.user_id,
    ]);
    if (!routine || !routine.active) continue;
    fireRoutine(routine, schedule, { manual: false }).catch((e) =>
      console.error(`[scheduler] routine ${routine.name} failed:`, e)
    );
  }
}
