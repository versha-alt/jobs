import { all, get, run } from './db.js';
import { parseSearchRow } from './db.js';
import { getModule } from './modules/index.js';
import { normalize, applyTimeFilter, partitionSeen, markSent } from './pipeline.js';
import { sendRunSummary, telegramConfigured } from './telegram.js';
import { computeNextRun, uid, nowIso } from './util.js';
import { saveJobsForRun } from './jobsService.js';
const inflight = new Set();

export function isRunning(triggerId) {
  return inflight.has(triggerId);
}

export async function insertRun(record) {
  await run(
    `INSERT INTO runs (id, user_id, trigger_id, module, search_id, status, total_found, new_jobs_count, delivery, error, new_jobs, all_jobs, started_at, finished_at, manual)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.user_id ?? null,
      record.trigger_id,
      record.module,
      record.search_id,
      record.status,
      record.total_found,
      record.new_jobs_count,
      record.delivery,
      record.error,
      record.new_jobs,
      record.all_jobs ?? '[]',
      record.started_at,
      record.finished_at,
      record.manual ? 1 : 0,
    ]
  );
}

export async function updateRun(runId, f) {
  await run(
    `UPDATE runs SET status = ?, total_found = ?, new_jobs_count = ?, delivery = ?, error = ?, new_jobs = ?, all_jobs = ?, raw_jobs = ?, finished_at = ?
     WHERE id = ?`,
    [
      f.status,
      f.total_found,
      f.new_jobs_count,
      f.delivery,
      f.error,
      f.new_jobs,
      f.all_jobs ?? '[]',
      f.raw_jobs ?? '[]',
      f.finished_at,
      runId,
    ]
  );
}

export async function rescheduleTrigger(triggerOrId) {
  const row =
    typeof triggerOrId === 'string'
      ? await get('SELECT * FROM triggers WHERE id = ?', [triggerOrId])
      : triggerOrId;
  if (!row) return null;
  const next = computeNextRun(row.frequency, row.time, JSON.parse(row.days_of_week || '[]'));
  const nextIso = next.toISOString();
  await run('UPDATE triggers SET next_run_at = ? WHERE id = ?', [nextIso, row.id]);
  return nextIso;
}

export async function runSearchOnce({ runId, triggerId, module, search, moduleInputs = {}, userId, manual = false }) {
  const startedAt = nowIso();
  const base = {
    id: runId,
    manual: manual ? 1 : 0,
    user_id: userId ?? search.user_id ?? null,
    trigger_id: triggerId,
    module: module.id,
    search_id: search.id,
    started_at: startedAt,
  };
  await insertRun({
    ...base,
    status: 'running',
    total_found: 0,
    new_jobs_count: 0,
    delivery: 'running',
    error: null,
    new_jobs: '[]',
    finished_at: null,
  });
  try {
    const pairs = await module.fetch({ search, countries: search.locations ?? [], overrides: moduleInputs });
    const normalized = normalize(module, pairs, search);
    const totalFound = normalized.length;
    // seen-check runs immediately: split into new vs already-delivered
    // duplicates. Duplicates are tallied, never persisted.
    const { newJobs: unseen, duplicateCount } = await partitionSeen(normalized, base.user_id);
    // freshness window applies to unseen jobs only — rejected jobs are NOT
    // marked seen, so they can resurface if the window is widened later
    const fresh = applyTimeFilter(unseen, search.time_filter);

    let delivery = 'skipped';
    if (totalFound > 0) {
      if (!telegramConfigured()) {
        delivery = 'not_configured';
      } else {
        try {
          await sendRunSummary({
            moduleLabel: module.label,
            keywords: search.keywords,
            totalFound,
            newCount: fresh.length,
          });
          delivery = 'sent';
        } catch (e) {
          delivery = `failed: ${e.message}`;
        }
      }
    }
    if (fresh.length > 0 && !delivery.startsWith('failed')) {
      await markSent(fresh, base.user_id);
    }

    const finishedAt = nowIso();
    // aggregated index: only new jobs touch it — duplicate sightings leave
    // the existing row (and its original run trace) untouched
    try {
      await saveJobsForRun({
        userId: base.user_id,
        runId,
        searchId: search.id,
        pairs,
        normalized: fresh.slice(0, 500),
        newKeys: new Set(fresh.map((j) => `${j.source}|${j.job_id}`)),
        fetchedAt: finishedAt,
      });
    } catch (jobErr) {
      console.error('[jobs] failed to update jobs index:', jobErr.message);
    }

    // run record stores only the new jobs; raw items are trimmed to match
    const newIdSet = new Set(fresh.map((j) => String(j.job_id)));
    const newPairs = pairs.filter((p) => newIdSet.has(String(p.item?.id)));

    await updateRun(runId, {
      status: 'success',
      total_found: totalFound,
      new_jobs_count: fresh.length,
      delivery,
      error: null,
      new_jobs: JSON.stringify(fresh.slice(0, 500)),
      all_jobs: JSON.stringify(fresh.slice(0, 500)),
      raw_jobs: JSON.stringify(newPairs.slice(0, 500).map((p) => p.item)),
      finished_at: finishedAt,
    });
    if (duplicateCount > 0) {
      console.log(`[run ${runId}] ${module.label}: ${totalFound} fetched, ${duplicateCount} duplicates skipped, ${fresh.length} new`);
    }
    return { runId, totalFound, duplicateCount, newJobs: fresh.length, delivery };
  } catch (e) {
    await updateRun(runId, {
      status: 'error',
      total_found: 0,
      new_jobs_count: 0,
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
    const row = await get('SELECT * FROM searches WHERE id = ?', [trigger.linked_search_id]);
    if (!row) {
      await insertRun({
        id: runId,
        user_id: trigger.user_id ?? null,
        trigger_id: trigger.id,
        module: trigger.module,
        search_id: trigger.linked_search_id,
        status: 'error',
        total_found: 0,
        new_jobs_count: 0,
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
      userId: trigger.user_id ?? row.user_id ?? null,
      manual,
    });
    return runId;
  } finally {
    inflight.delete(trigger.id);
    if (!manual) await rescheduleTrigger(trigger);
  }
}
