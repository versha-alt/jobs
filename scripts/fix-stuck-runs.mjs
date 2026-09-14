import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'job_app',
});

const now = new Date().toISOString();
const [r1] = await conn.query(
  "UPDATE runs SET status = 'error', error = 'interrupted by server restart', finished_at = ? WHERE status = 'running'",
  [now]
);
console.log(`closed ${r1.affectedRows} stuck running row(s)`);

const [r2] = await conn.query(
  "UPDATE runs SET status = 'error', error = 'You must rent a paid Actor in order to run it after its free trial has expired.', finished_at = ? WHERE id = ? AND status = 'error'",
  [now, process.argv[2] || '']
);
console.log(`updated ${r2.affectedRows} specific run(s)`);

await conn.end();
