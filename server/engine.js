import db, { parseSearchRow } from './db.js';
import { getModule } from './modules/index.js';
import { normalize, applyTimeFilter, dedupe, markSent } from './pipeline.js';
import { writeJobsCsv } from './csv.js';
import { sendCsvDocument, telegramConfigured } from './telegram.js';
import { computeNextRun } from './util.js';
import { uid, nowIso } from './util.js';

const inflight = new Set();

export function isRunning(triggerId) {
  return inflight.has(triggerId);
}

export function insertRun(record) {
  db.prepare(
    `INSERT INTO runs (id, trigger_id, module, search_id, status, total_found, new_jobs_count, csv_file, delivery, error, new_jobs, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.trigger_id,
    record.module,
    record.search_id,
    record.status,
    record.total_found,
    record.new_jobs_count,
    record.csv_file,
    record.delivery,
    record.error,
    record.new_jobs,
    record.started_at,
    record.finished_at
  );
}

export function rescheduleTrigger(triggerOrId) {
  const row =
    typeof triggerOrId === 'string'
      ? db.prepare('SELECT * FROM triggers WHERE id = ?').get(triggerOrId)
      : triggerOrId;
  if (!row) return null;
  const next = computeNextRun(row.frequency, row.time, JSON.parse(row.days_of_week || '[]'));
  const nextIso = next.toISOString();
  db.prepare('UPDATE triggers SET next_run_at = ? WHERE id = ?').run(nextIso, row.id);
  return nextIso;
}

export function updateRun(runId, f) {
  db.prepare(
    `UPDATE runs SET status = ?, total_found = ?, new_jobs_count = ?, csv_file = ?, delivery = ?, error = ?, new_jobs = ?, finished_at = ?
     WHERE id = ?`
  ).run(f.status, f.total_found, f.new_jobs_count, f.csv_file, f.delivery, f.error, f.new_jobs, f.finished_at, runId);
}

export async function runSearchOnce({ runId, triggerId, module, search, moduleInputs = {} }) {
  const startedAt = nowIso();
  const base = {
    id: runId,
    trigger_id: triggerId,
    module: module.id,
    search_id: search.id,
    started_at: startedAt,
  };
  insertRun({
    ...base,
    status: 'running',
    total_found: 0,
    new_jobs_count: 0,
    csv_file: null,
    delivery: 'running',
    error: null,
    new_jobs: '[]',
    finished_at: null,
  });
  try {
    const pairs = await module.fetch({ search, countries: search.locations ?? [], overrides: moduleInputs });
    const all = normalize(module, pairs, search);
    const totalFound = all.length;
    const filtered = applyTimeFilter(all, search.time_filter);
    const fresh = dedupe(db, filtered);

    let csvFile = null;
    let delivery = 'skipped';
    if (fresh.length > 0) {
      csvFile = writeJobsCsv(module, fresh);
      if (telegramConfigured()) {
        try {
          const caption = `${module.label} run — ${fresh.length} new job${fresh.length === 1 ? '' : 's'} — ${new Date(startedAt).toLocaleString()}`;
          await sendCsvDocument(csvFile, caption);
          delivery = 'sent';
        } catch (e) {
          delivery = `failed: ${e.message}`;
        }
      } else {
        delivery = 'not_configured';
      }
      if (!delivery.startsWith('failed')) markSent(db, fresh);
    }

    updateRun(runId, {
      status: 'success',
      total_found: totalFound,
      new_jobs_count: fresh.length,
      csv_file: csvFile,
      delivery,
      error: null,
      new_jobs: JSON.stringify(fresh.slice(0, 500)),
      finished_at: nowIso(),
    });
    return { runId, totalFound, newJobs: fresh.length, csvFile, delivery };
  } catch (e) {
    updateRun(runId, {
      status: 'error',
      total_found: 0,
      new_jobs_count: 0,
      csv_file: null,
      delivery: 'skipped',
      error: String(e.message || e),
      new_jobs: '[]',
      finished_at: nowIso(),
    });
    return { runId, error: String(e.message || e) };
  }
}

export async function fireTrigger(trigger, { manual = false, runId = uid('run') } = {}) {
  if (inflight.has(trigger.id)) return null;
  inflight.add(trigger.id);
  try {
    const row = db.prepare('SELECT * FROM searches WHERE id = ?').get(trigger.linked_search_id);
    if (!row) {
      insertRun({
        id: runId,
        trigger_id: trigger.id,
        module: trigger.module,
        search_id: trigger.linked_search_id,
        status: 'error',
        total_found: 0,
        new_jobs_count: 0,
        csv_file: null,
        delivery: 'skipped',
        error: 'Linked search no longer exists',
        new_jobs: '[]',
        started_at: nowIso(),
        finished_at: nowIso(),
      });
      return runId;
    }
    await runSearchOnce({
      runId,
      triggerId: trigger.id,
      module: getModule(trigger.module),
      search: parseSearchRow(row),
      moduleInputs: trigger.module_inputs ?? {},
    });
    return runId;
  } finally {
    inflight.delete(trigger.id);
    if (!manual) rescheduleTrigger(trigger);
  }
}
