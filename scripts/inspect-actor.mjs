import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';

const token = process.env.APIFY_TOKEN;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const enc = encodeURIComponent(process.env.APIFY_LINKEDIN_ACTOR_ID.replace('/', '~'));

const input = {
  title: 'Python Developer',
  location: 'New Zealand',
  dateFilter: 'week',
  rows: 5,
};

const res = await fetch(`https://api.apify.com/v2/acts/${enc}/runs?waitForFinish=999`, {
  method: 'POST',
  headers,
  body: JSON.stringify(input),
});
let run = (await res.json())?.data;
const deadline = Date.now() + 240000;
while (!['SUCCEEDED', 'FAILED', 'ABORTED'].includes(run?.status) && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5000));
  const r2 = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}`, { headers });
  run = (await r2.json())?.data;
}
console.log('actor run status:', run.status);

const itemsRes = await fetch(
  `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&limit=10`,
  { headers }
);
const items = await itemsRes.json();

const db = new DatabaseSync('data/app.db');
const cutoff = new Date(Date.now() - 7 * 86400e3).toISOString();
console.log(`cutoff for 'week' filter: ${cutoff}\n`);

for (const it of items) {
  const published = it.publishedAt ?? it.postedAt ?? null;
  const seenRow = db.prepare('SELECT sent_at FROM seen_jobs WHERE job_id = ? AND source = ?').get(String(it.id), 'linkedin');
  const inWindow = published ? new Date(published).toISOString() >= cutoff : true;
  const stage = seenRow ? 'DROPPED: already seen (dedup)' : inWindow ? 'would be NEW' : 'DROPPED: older than time filter';
  console.log(`id=${it.id} publishedAt=${published} | ${stage}`);
  console.log(`   ${it.title} @ ${it.companyName}`);
}
