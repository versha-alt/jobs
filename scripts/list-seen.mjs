import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/app.db');
const rows = db
  .prepare("SELECT job_id, sent_at FROM seen_jobs WHERE source = 'linkedin' ORDER BY sent_at DESC LIMIT 12")
  .all();
for (const r of rows) console.log(`${r.sent_at}  ${r.job_id}`);
const { c } = db.prepare("SELECT COUNT(*) AS c FROM seen_jobs WHERE source = 'linkedin'").get();
console.log(`total linkedin seen_jobs: ${c}`);
