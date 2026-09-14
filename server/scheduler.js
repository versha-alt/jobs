import { all, get } from './db.js';
import { fireTrigger, rescheduleTrigger } from './engine.js';
import { nowIso } from './util.js';

const TICK_MS = 15000;

export async function startScheduler() {
  const unscheduled = await all('SELECT * FROM triggers WHERE next_run_at IS NULL');
  for (const t of unscheduled) {
    await rescheduleTrigger(t);
  }
  const row = await get('SELECT COUNT(*) AS c FROM triggers');
  console.log(`[scheduler] watching ${row.c} trigger(s), tick every ${TICK_MS / 1000}s`);
  setInterval(() => {
    tick().catch((e) => console.error('[scheduler] tick failed:', e));
  }, TICK_MS);
}

async function tick() {
  const due = await all(
    'SELECT * FROM triggers WHERE next_run_at IS NOT NULL AND next_run_at <= ?',
    [nowIso()]
  );
  for (const t of due) {
    fireTrigger(t).catch((e) => console.error(`[scheduler] trigger ${t.id} failed:`, e));
  }
}
