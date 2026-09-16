import { all, get, run } from './db.js';

const STRIP_KEYS = ['descriptionHtml'];

function slimRaw(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return null;
  const copy = { ...rawItem };
  for (const k of STRIP_KEYS) delete copy[k];
  return JSON.stringify(copy).slice(0, 60000);
}

function extractDescription(rawItem) {
  if (!rawItem) return null;
  const text = rawItem.descriptionText || rawItem.description || null;
  return text ? String(text).slice(0, 20000) : null;
}

/**
 * Upsert every fetched job into the aggregated per-user jobs index.
 * The same job seen again in a later run refreshes its row (latest run wins),
 * keeping the index one-row-per-job rather than one-row-per-fetch.
 */
export async function saveJobsForRun({ userId, runId, searchId, pairs, normalized, newKeys, fetchedAt }) {
  if (!normalized.length) return 0;
  const rawById = new Map(pairs.map((p) => [String(p.item?.id ?? ''), p.item]));
  let n = 0;
  for (const j of normalized) {
    if (!j.job_id || !j.title) continue;
    const rawItem = rawById.get(String(j.job_id)) ?? null;
    await run(
      `INSERT INTO jobs (user_id, run_id, search_id, source, job_id, title, company, location, url, posted_date, fetched_at, is_new, description, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         run_id = VALUES(run_id), search_id = VALUES(search_id), title = VALUES(title),
         company = VALUES(company), location = VALUES(location), url = VALUES(url),
         posted_date = VALUES(posted_date), fetched_at = VALUES(fetched_at),
         is_new = VALUES(is_new), description = VALUES(description), raw = VALUES(raw)`,
      [
        userId,
        runId,
        searchId ?? null,
        j.source,
        String(j.job_id),
        String(j.title).slice(0, 500),
        j.company || null,
        j.location || null,
        j.url || null,
        j.posted_date ?? null,
        fetchedAt,
        newKeys.has(`${j.source}|${j.job_id}`) ? 1 : 0,
        extractDescription(rawItem),
        slimRaw(rawItem),
      ]
    );
    n += 1;
  }
  return n;
}

function cutoffIso(period) {
  const ms = { '24h': 24 * 3600e3, week: 7 * 24 * 3600e3, month: 30 * 24 * 3600e3 }[period];
  if (!ms) return null;
  return new Date(Date.now() - ms).toISOString();
}

function dateClause(column, filter, params) {
  if (!filter || filter === 'any') return;
  if (filter === 'custom') {
    if (filter.from) {
      // handled by caller via customFrom/customTo — nothing here
    }
    return;
  }
  const cutoff = cutoffIso(filter);
  if (!cutoff) return;
  params.push(cutoff);
  return `(${column} IS NOT NULL AND ${column} >= ?)`;
}

function buildDateFilter(column, f, params) {
  if (f === 'custom') return null; // custom handled via from/to params
  const clause = dateClause(column, f, params);
  return clause;
}

const SORTS = {
  fetched_desc: 'j.fetched_at DESC',
  fetched_asc: 'j.fetched_at ASC',
  posted_desc: 'j.posted_date DESC',
  posted_asc: 'j.posted_date ASC',
  title_asc: 'j.title ASC',
  title_desc: 'j.title DESC',
  company_asc: 'j.company ASC',
  company_desc: 'j.company DESC',
};

export async function listJobs(userId, f = {}) {
  const params = [userId];
  const where = ['j.user_id = ?'];

  if (f.status === 'bookmarked') where.push('j.bookmarked = 1');
  else if (f.status === 'dismissed') where.push('j.dismissed = 1');
  else where.push('j.dismissed = 0');

  if (f.source === 'linkedin' || f.source === 'upwork') {
    params.push(f.source);
    where.push('j.source = ?');
  }
  if (f.routineId && f.routineId !== 'all') {
    params.push(f.routineId);
    where.push('j.routine_id = ?');
  }
  if (f.runId && f.runId !== 'all') {
    params.push(f.runId);
    where.push('j.run_id = ?');
  }
  if (f.location && f.location.trim()) {
    params.push(`%${f.location.trim()}%`);
    where.push('j.location LIKE ?');
  }
  if (f.q && f.q.trim()) {
    params.push(`%${f.q.trim()}%`);
    where.push('(j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ?)');
    params.push(`%${f.q.trim()}%`);
    params.push(`%${f.q.trim()}%`);
  }

  for (const [col, key] of [
    ['j.posted_date', 'posted'],
    ['j.fetched_at', 'fetched'],
  ]) {
    const preset = f[`${key}Period`];
    const clause = buildDateFilter(col, preset, params);
    if (clause) where.push(clause);
    if (preset === 'custom') {
      if (f[`${key}From`]) {
        params.push(`${f[`${key}From`]}T00:00:00.000Z`);
        where.push(`(${col} IS NOT NULL AND ${col} >= ?)`);
      }
      if (f[`${key}To`]) {
        params.push(`${f[`${key}To`]}T23:59:59.999Z`);
        where.push(`(${col} IS NOT NULL AND ${col} <= ?)`);
      }
    }
  }

  const whereSql = where.join(' AND ');
  const total = (await get(`SELECT COUNT(*) AS c FROM jobs j WHERE ${whereSql}`, params)).c;
  const orderBy = SORTS[f.sort] ?? SORTS.fetched_desc;
  const pageSize = Math.min(Math.max(Number(f.pageSize) || 25, 5), 100);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Number(f.page) || 1, 1), pageCount);
  const offset = (page - 1) * pageSize;

  const rows = await all(
    `SELECT j.id, j.run_id, j.search_id, j.source, j.job_id, j.title, j.company, j.location,
            j.url, j.posted_date, j.fetched_at, j.is_new, j.bookmarked, j.dismissed,
            s.keywords AS search_keywords
     FROM jobs j
     LEFT JOIN searches s ON s.id = j.search_id
     WHERE ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    total,
    page,
    pageCount,
    pageSize,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, total),
    items: rows.map((r) => ({
      ...r,
      search_keywords: r.search_keywords ? JSON.parse(r.search_keywords) : [],
    })),
  };
}

export async function getJob(userId, id) {
  const row = await get(
    `SELECT j.*, s.keywords AS search_keywords, s.locations AS search_locations,
            s.time_filter AS search_time_filter, r.started_at AS run_started_at,
            r.status AS run_status, r.total_found AS run_total_found
     FROM jobs j
     LEFT JOIN searches s ON s.id = j.search_id
     LEFT JOIN runs r ON r.id = j.run_id
     WHERE j.id = ? AND j.user_id = ?`,
    [id, userId]
  );
  if (!row) return null;
  return {
    ...row,
    search_keywords: row.search_keywords ? JSON.parse(row.search_keywords) : [],
    search_locations: row.search_locations ? JSON.parse(row.search_locations) : [],
    raw: row.raw ? JSON.parse(row.raw) : null,
  };
}

export async function toggleJobFlag(userId, id, field) {
  const allowed = ['bookmarked', 'dismissed'];
  if (!allowed.includes(field)) throw new Error('Invalid flag');
  const row = await get('SELECT id FROM jobs WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return null;
  await run(`UPDATE jobs SET ${field} = 1 - ${field} WHERE id = ? AND user_id = ?`, [id, userId]);
  const updated = await get(`SELECT ${field} AS value FROM jobs WHERE id = ?`, [id]);
  return Boolean(updated.value);
}
