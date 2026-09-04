import fs from 'node:fs';
import path from 'node:path';
import { EXPORTS_DIR } from './config.js';

const HEADERS = ['title', 'company', 'location', 'source', 'url', 'posted_date', 'matched_keywords', 'tags'];

function esc(value) {
  const s = (value ?? '').toString();
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeJobsCsv(module, jobs, when = new Date()) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}_${pad(when.getHours())}${pad(when.getMinutes())}`;
  const file = path.join(EXPORTS_DIR, `${module.id}_jobs_${ts}.csv`);
  const rows = jobs.map((j) =>
    [
      j.title,
      j.company,
      j.location,
      j.source,
      j.url,
      j.posted_date ?? '',
      (j.matched_keywords ?? []).join('; '),
      (j.tags ?? []).join('; '),
    ]
      .map(esc)
      .join(',')
  );
  fs.writeFileSync(file, [HEADERS.join(','), ...rows].join('\r\n'), 'utf8');
  return file;
}
