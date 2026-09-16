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
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'user',
      created_at VARCHAR(40) NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      expires_at VARCHAR(40) NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS seen_jobs (
      job_id VARCHAR(255) NOT NULL,
      source VARCHAR(16) NOT NULL,
      user_id VARCHAR(64) NOT NULL DEFAULT '',
      sent_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (job_id, source, user_id)
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS searches (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NULL,
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
      user_id VARCHAR(64) NULL,
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
    CREATE TABLE IF NOT EXISTS runs (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NULL,
      trigger_id VARCHAR(64) NULL,
      module VARCHAR(16) NOT NULL,
      search_id VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL,
      total_found INT NOT NULL DEFAULT 0,
      new_jobs_count INT NOT NULL DEFAULT 0,
      delivery VARCHAR(255) NULL,
      error TEXT NULL,
      new_jobs MEDIUMTEXT NOT NULL,
      all_jobs MEDIUMTEXT NULL,
      raw_jobs MEDIUMTEXT NULL,
      started_at VARCHAR(40) NOT NULL,
      finished_at VARCHAR(40) NULL,
      manual TINYINT(1) NOT NULL DEFAULT 0
    )
  `);

  // older installs predate per-user ownership — add the columns in place
  const ownedTables = ['searches', 'triggers', 'runs'];
  const ownedCols = await all(
    `SELECT TABLE_NAME AS tbl, COLUMN_NAME AS col FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('searches', 'triggers', 'runs', 'seen_jobs', 'jobs')`,
    [dbName]
  );
  const has = (tbl, col) => ownedCols.some((c) => c.tbl === tbl && c.col === col);
  for (const tbl of ownedTables) {
    if (ownedCols.some((c) => c.tbl === tbl) && !has(tbl, 'user_id')) {
      await run(`ALTER TABLE \`${tbl}\` ADD COLUMN user_id VARCHAR(64) NULL AFTER id`);
    }
  }
  if (ownedCols.some((c) => c.tbl === 'seen_jobs') && !has('seen_jobs', 'user_id')) {
    // seen_jobs uniqueness was (job_id, source); it becomes per-user
    await run(
      'ALTER TABLE seen_jobs DROP PRIMARY KEY, ADD COLUMN user_id VARCHAR(64) NOT NULL DEFAULT \'\' AFTER source, ADD PRIMARY KEY (job_id, source, user_id)'
    );
  }
  if (ownedCols.some((c) => c.tbl === 'runs') && !has('runs', 'manual')) {
    await run("ALTER TABLE runs ADD COLUMN manual TINYINT(1) NOT NULL DEFAULT 0 AFTER finished_at");
  }
  if (ownedCols.some((c) => c.tbl === 'runs') && !has('runs', 'routine_id')) {
    await run('ALTER TABLE runs ADD COLUMN routine_id VARCHAR(64) NULL AFTER trigger_id');
  }
  if (ownedCols.some((c) => c.tbl === 'jobs') && !has('jobs', 'routine_id')) {
    await run('ALTER TABLE jobs ADD COLUMN routine_id VARCHAR(64) NULL AFTER search_id');
  }

  await run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      run_id VARCHAR(64) NOT NULL,
      search_id VARCHAR(64) NULL,
      source VARCHAR(16) NOT NULL,
      job_id VARCHAR(255) NOT NULL,
      title VARCHAR(512) NOT NULL,
      company VARCHAR(255) NULL,
      location VARCHAR(255) NULL,
      url VARCHAR(1024) NULL,
      posted_date VARCHAR(40) NULL,
      fetched_at VARCHAR(40) NOT NULL,
      is_new TINYINT(1) NOT NULL DEFAULT 0,
      bookmarked TINYINT(1) NOT NULL DEFAULT 0,
      dismissed TINYINT(1) NOT NULL DEFAULT 0,
      description MEDIUMTEXT NULL,
      raw MEDIUMTEXT NULL,
      UNIQUE KEY uq_job (user_id, source, job_id),
      INDEX idx_jobs_user_fetched (user_id, fetched_at),
      INDEX idx_jobs_user_posted (user_id, posted_date),
      INDEX idx_jobs_user_run (user_id, run_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS routines (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description MEDIUMTEXT NULL,
      module VARCHAR(16) NOT NULL,
      module_inputs MEDIUMTEXT NOT NULL,
      keywords MEDIUMTEXT NOT NULL,
      locations MEDIUMTEXT NOT NULL,
      posted_within VARCHAR(16) NOT NULL DEFAULT 'week',
      tags MEDIUMTEXT NOT NULL,
      volume_per_run INT NOT NULL DEFAULT 10,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      routine_id VARCHAR(64) NOT NULL,
      type VARCHAR(16) NOT NULL,
      time VARCHAR(8) NOT NULL,
      days MEDIUMTEXT NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      next_run_at VARCHAR(40) NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      skey VARCHAR(64) PRIMARY KEY,
      svalue MEDIUMTEXT NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    )
  `);

  await migrateSearchTriggersToRoutines();

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

/**
 * Populate the aggregated jobs index from runs that stored their listings.
 * Idempotent: re-running refreshes the same rows via upsert, so it is safe
 * to call on every boot after user ownership has been resolved.
 */
export async function backfillJobsIndex() {
  const jobRuns = await all(
    `SELECT id, user_id, search_id, module, started_at, finished_at, all_jobs, new_jobs, raw_jobs
     FROM runs
     WHERE user_id IS NOT NULL AND status = 'success' AND total_found > 0`
  );
  let saved = 0;
  for (const r of jobRuns) {
    let jobs = [];
    try {
      jobs =
        r.all_jobs && r.all_jobs !== '[]'
          ? JSON.parse(r.all_jobs)
          : JSON.parse(r.new_jobs || '[]');
    } catch {
      continue;
    }
    if (!Array.isArray(jobs) || jobs.length === 0) continue;
    let raws = [];
    try {
      raws = r.raw_jobs && r.raw_jobs !== '[]' ? JSON.parse(r.raw_jobs) : [];
    } catch {
      raws = [];
    }
    const rawById = new Map(raws.map((it) => [String(it.id ?? ''), it]));
    const fetchedAt = r.finished_at ?? r.started_at;
    for (const j of jobs) {
      if (!j.job_id || !j.title) continue;
      const rawItem = rawById.get(String(j.job_id)) ?? null;
      const desc = rawItem ? rawItem.descriptionText || rawItem.description || null : null;
      let rawJson = null;
      if (rawItem) {
        const copy = { ...rawItem };
        delete copy.descriptionHtml;
        rawJson = JSON.stringify(copy).slice(0, 60000);
      }
      await run(
        `INSERT INTO jobs (user_id, run_id, search_id, source, job_id, title, company, location, url, posted_date, fetched_at, is_new, description, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON DUPLICATE KEY UPDATE
           run_id = VALUES(run_id), search_id = VALUES(search_id), title = VALUES(title),
           company = VALUES(company), location = VALUES(location), url = VALUES(url),
           posted_date = VALUES(posted_date), fetched_at = VALUES(fetched_at),
           description = VALUES(description), raw = VALUES(raw)`,
        [
          r.user_id,
          r.id,
          r.search_id,
          j.source ?? r.module,
          String(j.job_id),
          String(j.title).slice(0, 500),
          j.company || null,
          j.location || null,
          j.url || null,
          j.posted_date ?? null,
          fetchedAt,
          desc,
          rawJson,
        ]
      );
      saved += 1;
    }
  }
  return saved;
}

/**
 * Phase-1 migration: merge searches + triggers into routines + schedules.
 * Idempotent — rows are keyed by their original ids, so re-running only
 * refreshes nothing (existing ids short-circuit via INSERT IGNORE semantics).
 */
export async function migrateSearchTriggersToRoutines() {
  const searches = await all('SELECT * FROM searches');
  const triggers = await all('SELECT * FROM triggers');
  if (searches.length === 0 && triggers.length === 0) return;

  const bySearchId = new Map();
  for (const t of triggers) {
    const list = bySearchId.get(t.linked_search_id) ?? [];
    list.push(t);
    bySearchId.set(t.linked_search_id, list);
  }

  for (const search of searches) {
    const linked = bySearchId.get(search.id) ?? [];
    const firstWithLabel = linked.find((t) => t.label);
    const rowsInput = linked.map((t) => {
      try { return JSON.parse(t.module_inputs || '{}'); } catch { return {}; }
    }).find((mi) => mi.rows != null);
    const volume = Math.min(Math.max(Number(rowsInput?.rows) || 10, 1), 100);
    const active = linked.some((t) => t.next_run_at != null);
    const module = linked[0]?.module ?? 'linkedin';
    const exists = await get('SELECT id FROM routines WHERE id = ?', [search.id]);
    if (!exists) {
      await run(
        `INSERT IGNORE INTO routines (id, user_id, name, description, module, module_inputs, keywords, locations, posted_within, tags, volume_per_run, active, created_at, updated_at)
         SELECT ?, ?, ?, '', ?, '{}', keywords, locations, time_filter, tags, ?, ?, created_at, updated_at
         FROM searches WHERE id = ?`,
        [search.id, search.user_id, firstWithLabel?.label ?? search.keywords, module, volume, active ? 1 : 0, search.id]
      );
    }
    for (const t of linked) {
      const schedExists = await get('SELECT id FROM schedules WHERE id = ?', [t.id]);
      if (schedExists) continue;
      await run(
        `INSERT INTO schedules (id, user_id, routine_id, type, time, days, active, next_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [t.id, search.user_id, search.id, t.frequency, t.time, t.days_of_week, t.next_run_at, t.created_at, t.updated_at]
      );
    }
  }

  // re-point runs and jobs at their routine
  await run(
    `UPDATE runs r JOIN triggers t ON t.id = r.trigger_id JOIN routines rt ON rt.id = t.linked_search_id
     SET r.routine_id = rt.id WHERE r.routine_id IS NULL`
  );
  await run(
    `UPDATE runs r JOIN routines rt ON rt.id = r.search_id
     SET r.routine_id = rt.id WHERE r.routine_id IS NULL`
  );
  await run(
    `UPDATE jobs j JOIN routines rt ON rt.id = j.search_id
     SET j.routine_id = rt.id WHERE j.routine_id IS NULL`
  );
}
