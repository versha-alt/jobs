import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/app.db');
db.prepare(
  "UPDATE runs SET status = 'error', error = 'interrupted by server restart', finished_at = ? WHERE status = 'running'"
).run(new Date().toISOString());
const { c } = db.prepare("SELECT COUNT(*) AS c FROM runs WHERE status = 'running'").get();
console.log('cleaned; rows still marked running:', c);
