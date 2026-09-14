import 'dotenv/config';

const token = process.env.APIFY_TOKEN;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const enc = encodeURIComponent(process.env.APIFY_LINKEDIN_ACTOR_ID.replace('/', '~'));

const input = {
  titles: ['Nest js Developer'],
  locations: ['Australia'],
  publishedAt: 'r2592000',
  rows: 5,
};

const res = await fetch(`https://api.apify.com/v2/acts/${enc}/runs?waitForFinish=60`, {
  method: 'POST',
  headers,
  body: JSON.stringify(input),
});
console.log('HTTP', res.status);
const text = await res.text();
console.log(text.slice(0, 600));
