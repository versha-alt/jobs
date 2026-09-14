import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import mysql from 'mysql2/promise';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlitePath = process.argv[2] || path.join(root, 'data', 'app.db');

if (!fs.existsSync(sqlitePath)) {
  console.error(`SQLite backup not found at ${sqlitePath}`);
  process.exit(1);
}

const mysqlConf = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'job_app',
};

const dbName = mysqlConf.database;
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  console.error(`MYSQL_DATABASE "${dbName}" contains invalid characters`);
  process.exit(1);
}

console.log(`source : ${sqlitePath}`);
console.log(`target : ${mysqlConf.user}@${mysqlConf.host}:${mysqlConf.port}/${dbName}\n`);

const base = await mysql.createConnection({
  host: mysqlConf.host,
  port: mysqlConf.port,
  user: mysqlConf.user,
  password: mysqlConf.password,
});
await base.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4`);
await base.end();

const conn = await mysql.createConnection(mysqlConf);

await conn.query(`
  CREATE TABLE IF NOT EXISTS countries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
  )
`);
await conn.query(`
  CREATE TABLE IF NOT EXISTS searches (
    id VARCHAR(64) PRIMARY KEY,
    keywords MEDIUMTEXT NOT NULL,
    locations MEDIUMTEXT NOT NULL,
    time_filter VARCHAR(16) NOT NULL DEFAULT 'week',
    tags MEDIUMTEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
  )
`);
await conn.query(`
  CREATE TABLE IF NOT EXISTS triggers (
    id VARCHAR(64) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    module VARCHAR(16) NOT NULL,
    linked_search_id VARCHAR(64) NOT NULL,
    frequency VARCHAR(16) NOT NULL,
    time VARCHAR(8) NOT NULL DEFAULT '09:00',
    days_of_week MEDIUMTEXT NOT NULL,
    module_inputs MEDIUMTEXT NOT NULL,
    next_run_at VARCHAR(40) NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
  )
`);
await conn.query(`
  CREATE TABLE IF NOT EXISTS seen_jobs (
    job_id VARCHAR(255) NOT NULL,
    source VARCHAR(16) NOT NULL,
    sent_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (job_id, source)
  )
`);
await conn.query(`
  CREATE TABLE IF NOT EXISTS runs (
    id VARCHAR(64) PRIMARY KEY,
    trigger_id VARCHAR(64) NULL,
    module VARCHAR(16) NOT NULL,
    search_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    total_found INT NOT NULL DEFAULT 0,
    new_jobs_count INT NOT NULL DEFAULT 0,
    delivery VARCHAR(255) NULL,
    error TEXT NULL,
    new_jobs MEDIUMTEXT NOT NULL,
    started_at VARCHAR(40) NOT NULL,
    finished_at VARCHAR(40) NULL
  )
`);

const sqlite = new DatabaseSync(sqlitePath);

async function copyTable(label, selectSql, insertSql, transform) {
  const rows = sqlite.prepare(selectSql).all();
  let inserted = 0;
  for (const row of rows) {
    const params = transform(row);
    try {
      await conn.query(insertSql, params);
      inserted += 1;
    } catch (e) {
      console.error(`  row failed in ${label}: ${e.message}`);
    }
  }
  console.log(`${label.padEnd(12)} ${rows.length} read -> ${inserted} inserted`);
  return { read: rows.length, inserted };
}

await conn.query('START TRANSACTION');

for (const table of ['runs', 'seen_jobs', 'triggers', 'searches', 'countries']) {
  await conn.query(`DELETE FROM ${table}`);
}

const results = [];
results.push(
  await copyTable(
    'countries',
    'SELECT id, name FROM countries ORDER BY id',
    'INSERT INTO countries (id, name) VALUES (?, ?)',
    (r) => [r.id, r.name]
  )
);
results.push(
  await copyTable(
    'searches',
    'SELECT * FROM searches ORDER BY created_at',
    'INSERT INTO searches (id, keywords, locations, time_filter, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    (r) => [r.id, r.keywords, r.locations, r.time_filter, r.tags, r.created_at, r.updated_at]
  )
);
results.push(
  await copyTable(
    'triggers',
    'SELECT * FROM triggers ORDER BY created_at',
    'INSERT INTO triggers (id, label, module, linked_search_id, frequency, time, days_of_week, module_inputs, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    (r) => [r.id, r.label, r.module, r.linked_search_id, r.frequency, r.time, r.days_of_week, r.module_inputs ?? '{}', r.next_run_at, r.created_at, r.updated_at]
  )
);
results.push(
  await copyTable(
    'seen_jobs',
    'SELECT job_id, source, sent_at FROM seen_jobs',
    'INSERT IGNORE INTO seen_jobs (job_id, source, sent_at) VALUES (?, ?, ?)',
    (r) => [r.job_id, r.source, r.sent_at]
  )
);
results.push(
  await copyTable(
    'runs',
    'SELECT id, trigger_id, module, search_id, status, total_found, new_jobs_count, delivery, error, new_jobs, started_at, finished_at FROM runs ORDER BY started_at',
    'INSERT INTO runs (id, trigger_id, module, search_id, status, total_found, new_jobs_count, delivery, error, new_jobs, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    (r) => [r.id, r.trigger_id, r.module, r.search_id, r.status, r.total_found, r.new_jobs_count, r.delivery, r.error, r.new_jobs, r.started_at, r.finished_at]
  )
);

await conn.query('COMMIT');

console.log('\n=== MySQL table counts after migration ===');
for (const table of ['countries', 'searches', 'triggers', 'seen_jobs', 'runs']) {
  const [[row]] = [await conn.query(`SELECT COUNT(*) AS c FROM ${table}`)];
  console.log(`${table.padEnd(12)} ${row[0].c}`);
}

await conn.end();
sqlite.close();
console.log('\nMigration complete. data/app.db kept as backup.');
