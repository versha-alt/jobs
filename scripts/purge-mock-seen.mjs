import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/app.db');
const n = db.prepare("DELETE FROM seen_jobs WHERE job_id LIKE 'mock_%'").run().changes;
console.log(`removed ${n} mock entries from seen_jobs`);
