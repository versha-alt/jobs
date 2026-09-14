import mysql from 'mysql2/promise';
import { config } from './config.js';

let pool = null;

async function bootstrap() {
  const dbName = config.mysql.database;
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`MYSQL_DATABASE "${dbName}" contains invalid characters`);
  }
  const base = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
  });
  await base.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4`);
  await base.end();

  pool = mysql.createPool({ ...config.mysql, connectionLimit: 10, waitForConnections: true });

  await run(`
    CREATE TABLE IF NOT EXISTS countries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE
    )
  `);
  await run(`
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
  await run(`
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
  await run(`
    CREATE TABLE IF NOT EXISTS seen_jobs (
      job_id VARCHAR(255) NOT NULL,
      source VARCHAR(16) NOT NULL,
      sent_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (job_id, source)
    )
  `);
  await run(`
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

  const row = await get('SELECT COUNT(*) AS c FROM countries');
  if (Number(row.c) === 0) {
    for (const name of ['USA', 'UK', 'Canada', 'New Zealand', 'Australia']) {
      await run('INSERT INTO countries (name) VALUES (?)', [name]);
    }
  }
}

export async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function get(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0] ?? null;
}

export async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

export async function initDb() {
  if (!pool) {
    try {
      await bootstrap();
    } catch (e) {
      const msg = `MySQL connection failed (${config.mysql.user}@${config.mysql.host}:${config.mysql.port}/${config.mysql.database}): ${e.message}`;
      throw new Error(msg);
    }
  }
}

export function parseSearchRow(row) {
  if (!row) return null;
  return {
    ...row,
    keywords: JSON.parse(row.keywords),
    locations: JSON.parse(row.locations),
    tags: JSON.parse(row.tags),
  };
}

export function parseTriggerRow(row) {
  if (!row) return null;
  return {
    ...row,
    days_of_week: JSON.parse(row.days_of_week),
    module_inputs: JSON.parse(row.module_inputs || '{}'),
  };
}
