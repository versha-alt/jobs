import { all, run } from './db.js';
import { cutoffIso, nowIso } from './util.js';

export function normalize(module, pairs, search) {
  return pairs
    .map(({ item, keyword }) => {
      const base = module.parseItem({ item, keyword, search });
      return {
        job_id: base.job_id,
        title: base.title ?? '',
        company: base.company ?? '',
        location: base.location ?? '',
        source: base.source ?? module.id,
        url: base.url ?? '',
        posted_date: base.posted_date ?? null,
        tags: [...(search.tags ?? [])],
        matched_keywords: base.matched_keywords ?? [],
      };
    })
    .filter((j) => {
      const t = j.title.trim().toLowerCase();
      return t !== '' && t !== 'untitled';
    });
}

export function applyTimeFilter(jobs, timeFilter) {
  const cutoff = cutoffIso(timeFilter);
  return jobs.filter((j) => {
    if (!j.posted_date) return true;
    // some sources return date-only stamps ("2026-09-13"), which parse to
    // midnight — compare by day so same-window jobs aren't dropped
    const posted = j.posted_date.length === 10 ? j.posted_date : j.posted_date.slice(0, 10);
    return posted >= cutoff.slice(0, 10);
  });
}

export async function dedupe(jobs) {
  if (jobs.length === 0) return [];
  const bySource = new Map();
  for (const j of jobs) {
    const list = bySource.get(j.source) ?? [];
    list.push(j.job_id);
    bySource.set(j.source, list);
  }
  const seen = new Set();
  for (const [source, ids] of bySource) {
    const placeholders = ids.map(() => '?').join(',');
    const rows = await all(
      `SELECT job_id FROM seen_jobs WHERE source = ? AND job_id IN (${placeholders})`,
      [source, ...ids]
    );
    for (const row of rows) seen.add(row.job_id);
  }
  return jobs.filter((j) => !seen.has(j.job_id));
}

export async function markSent(jobs) {
  for (const j of jobs) {
    await run(
      'INSERT IGNORE INTO seen_jobs (job_id, source, sent_at) VALUES (?, ?, ?)',
      [j.job_id, j.source, nowIso()]
    );
  }
}
