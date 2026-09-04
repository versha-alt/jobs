import { ApifyClient } from 'apify-client';
import { config } from './config.js';

let client = null;

export function apifyClient() {
  if (!config.apifyToken) return null;
  if (!client) client = new ApifyClient({ token: config.apifyToken });
  return client;
}

export async function runActor(actorId, input) {
  const c = apifyClient();
  const run = await c.actor(actorId).call(input);
  const { items } = await c.dataset(run.defaultDatasetId).listItems();
  return items ?? [];
}
