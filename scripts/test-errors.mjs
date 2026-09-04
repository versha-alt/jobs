import { classifyError } from '../src/errors.js';

const cases = [
  'The input JSON must be object, got "array" instead.',
  'Free tier limit reached (100 total results). You have used all 100 free results across all runs.',
  'failed: Bad Request: chat not found',
  'Set APIFY_LINKEDIN_ACTOR_ID in .env to your Apify LinkedIn jobs actor id',
  'getaddrinfo ENOTFOUND api.upwork.com',
  'something totally unknown happened',
];

for (const c of cases) {
  const { title } = classifyError(c);
  console.log(`${title}  <-  ${c.slice(0, 60)}`);
}
