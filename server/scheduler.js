import db from './db.js';
import { fireTrigger, rescheduleTrigger } from './engine.js';
import { nowIso } from './util.js';

const TICK_MS = 15000;

export function startScheduler() {
  const unscheduled = db.prepare('SELECT * FROM triggers WHERE next_run_at IS NULL').all();
  for (const t of unscheduled) rescheduleTrigger(t);
  const count = db.prepare('SELECT COUNT(*) AS c FROM triggers').get().c;
  console.log(`[scheduler] watching ${count} trigger(s), tick every ${TICK_MS / 1000}s`);
  setInterval(tick, TICK_MS);
}

function tick() {
  const due = db
    .prepare('SELECT * FROM triggers WHERE next_run_at IS NOT NULL AND next_run_at <= ?')
    .all(nowIso());
  for (const t of due) {
    fireTrigger(t).catch((e) => console.error(`[scheduler] trigger ${t.id} failed:`, e));
  }
}
