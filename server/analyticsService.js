import { all } from './db.js';

export async function jobsByDay(userId, days = 14) {
  const rows = await all(
    `SELECT DATE(fetched_at) AS day, source, COUNT(*) AS n
     FROM jobs
     WHERE user_id = ? AND fetched_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(fetched_at), source
     ORDER BY day ASC`,
    [userId, days - 1]
  );
  return rows.map((r) => ({ day: String(r.day), source: r.source, count: Number(r.n) }));
}

export async function jobsByLocation(userId, limit = 10) {
  const rows = await all(
    `SELECT location, COUNT(*) AS n
     FROM jobs
     WHERE user_id = ? AND location IS NOT NULL AND location <> ''
     GROUP BY location
     ORDER BY n DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows.map((r) => ({ location: r.location, count: Number(r.n) }));
}

export async function sourceYield(userId) {
  const rows = await all(
    `SELECT module,
            COUNT(*) AS run_count,
            COALESCE(SUM(total_found), 0) AS total_found,
            COALESCE(SUM(new_jobs_count), 0) AS new_jobs
     FROM runs
     WHERE user_id = ?
     GROUP BY module`,
    [userId]
  );
  return rows.map((r) => ({
    module: r.module,
    runCount: Number(r.run_count),
    totalFound: Number(r.total_found),
    newJobs: Number(r.new_jobs),
  }));
}

export async function jobsByPlatform(userId) {
  const rows = await all(`SELECT source, COUNT(*) AS n FROM jobs WHERE user_id = ? GROUP BY source`, [userId]);
  return rows.map((r) => ({ source: r.source, count: Number(r.n) }));
}
