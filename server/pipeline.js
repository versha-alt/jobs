import { cutoffIso } from './util.js';

export function normalize(module, pairs, search) {
  return pairs.map(({ item, keyword }) => {
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
  });
}

export function applyTimeFilter(jobs, timeFilter) {
  const cutoff = cutoffIso(timeFilter);
  return jobs.filter((j) => !j.posted_date || j.posted_date >= cutoff);
}

export function dedupe(db, jobs) {
  const check = db.prepare('SELECT 1 FROM seen_jobs WHERE job_id = ? AND source = ?');
  return jobs.filter((j) => !check.get(j.job_id, j.source));
}

export function markSent(db, jobs) {
  const ins = db.prepare('INSERT OR IGNORE INTO seen_jobs (job_id, source, sent_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  for (const j of jobs) ins.run(j.job_id, j.source, now);
}
