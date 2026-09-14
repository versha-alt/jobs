import { ApifyClient } from 'apify-client';
import { config } from './config.js';

let client = null;

export function apifyClient() {
  if (!config.apifyToken) return null;
  if (!client) client = new ApifyClient({ token: config.apifyToken });
  return client;
}

export async function runActor(actorId, input, timeoutMs = 10 * 60 * 1000) {
  const c = apifyClient();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Actor run timed out after ${Math.round(timeoutMs / 60000)} minutes`)),
      timeoutMs
    );
  });
  const call = (async () => {
    const run = await c.actor(actorId).call(input);
    const { items } = await c.dataset(run.defaultDatasetId).listItems();
    return items ?? [];
  })();
  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
