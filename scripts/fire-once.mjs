// Fire a routine's schedule once from a plain node process (outside npm run dev),
// printing timing at each stage — used to isolate dev-chain hangs.
import 'dotenv/config';
import { initDb, get, parseScheduleRow, parseRoutineRow } from '../server/db.js';
import { fireRoutine } from '../server/engine.js';

const scheduleId = process.argv[2];
if (!scheduleId) {
  console.error('usage: node scripts/fire-once.mjs <scheduleId>');
  process.exit(1);
}

console.log('[t0]', new Date().toISOString(), 'boot');
await initDb();
console.log('[t1]', new Date().toISOString(), 'db ready');
const schedRow = await get('SELECT * FROM schedules WHERE id = ?', [scheduleId]);
if (!schedRow) {
  console.error('schedule not found');
  process.exit(1);
}
const schedule = parseScheduleRow(schedRow);
const routineRow = await get('SELECT * FROM routines WHERE id = ?', [schedule.routine_id]);
if (!routineRow) {
  console.error('routine not found');
  process.exit(1);
}
const routine = parseRoutineRow(routineRow);
const runId = await fireRoutine(routine, schedule, { manual: true });
console.log('[t2]', new Date().toISOString(), 'fireRoutine finished:', runId);
const run = await get('SELECT status, total_found, new_jobs_count, delivery, error FROM runs WHERE id = ?', [runId]);
console.log('[t3]', new Date().toISOString(), JSON.stringify(run));
process.exit(0);
