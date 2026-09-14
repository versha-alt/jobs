// Fire a trigger once from a plain node process (outside npm run dev),
// printing timing at each stage — used to isolate dev-chain hangs.
import 'dotenv/config';
import { initDb, get, parseTriggerRow } from '../server/db.js';
import { fireTrigger } from '../server/engine.js';

const triggerId = process.argv[2];
if (!triggerId) {
  console.error('usage: node scripts/fire-once.mjs <triggerId>');
  process.exit(1);
}

console.log('[t0]', new Date().toISOString(), 'boot');
await initDb();
console.log('[t1]', new Date().toISOString(), 'db ready');
const row = await get('SELECT * FROM triggers WHERE id = ?', [triggerId]);
if (!row) {
  console.error('trigger not found');
  process.exit(1);
}
const runId = await fireTrigger(parseTriggerRow(row), { manual: true });
console.log('[t2]', new Date().toISOString(), 'fireTrigger finished:', runId);
const run = await get('SELECT status, total_found, new_jobs_count, delivery, error FROM runs WHERE id = ?', [runId]);
console.log('[t3]', new Date().toISOString(), JSON.stringify(run));
process.exit(0);
