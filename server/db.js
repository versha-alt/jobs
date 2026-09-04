import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR } from './config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);
CREATE TABLE IF NOT EXISTS searches (
  id TEXT PRIMARY KEY,
  keywords TEXT NOT NULL,
  locations TEXT NOT NULL DEFAULT '[]',
  time_filter TEXT NOT NULL DEFAULT 'week',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS triggers (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('linkedin','upwork')),
  linked_search_id TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('hourly','daily','weekly')),
  time TEXT NOT NULL DEFAULT '09:00',
  days_of_week TEXT NOT NULL DEFAULT '[]',
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS seen_jobs (
  job_id TEXT NOT NULL,
  source TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (job_id, source)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  trigger_id TEXT,
  module TEXT NOT NULL,
  search_id TEXT NOT NULL,
  status TEXT NOT NULL,
  total_found INTEGER NOT NULL DEFAULT 0,
  new_jobs_count INTEGER NOT NULL DEFAULT 0,
  csv_file TEXT,
  delivery TEXT,
  error TEXT,
  new_jobs TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  finished_at TEXT
);
`);

const triggerCols = db.prepare('PRAGMA table_info(triggers)').all();
if (!triggerCols.some((c) => c.name === 'module_inputs')) {
  db.exec(`ALTER TABLE triggers ADD COLUMN module_inputs TEXT NOT NULL DEFAULT '{}'`);
}

const { c } = db.prepare('SELECT COUNT(*) AS c FROM countries').get();
if (c === 0) {
  const ins = db.prepare('INSERT INTO countries (name) VALUES (?)');
  for (const name of ['USA', 'UK', 'Canada', 'New Zealand', 'Australia']) ins.run(name);
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

export default db;
