import { ApifyClient } from 'apify-client';
import { config } from './config.js';

let client = null;

export function apifyClient() {
  if (!config.apifyToken) return null;
  // keep client-level retries low: on free-plan concurrency errors (429) the
  // default retry storm spawns duplicate actor runs and blocks slots longer
  if (!client) client = new ApifyClient({ token: config.apifyToken, maxRetries: 1 });
  return client;
}

export function resetApifyClient() {
  client = null;
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
    const list = items ?? [];
    // some actors report bad input by pushing a lone { error } item into the
    // dataset while the run itself still SUCCEEDS
    const errorItems = list.filter(
      (it) => it && typeof it === 'object' && Object.keys(it).length === 1 && typeof it.error === 'string'
    );
    if (list.length > 0 && errorItems.length === list.length) {
      throw new Error(errorItems.map((e) => e.error).join('; '));
    }
    return list;
  })();
  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
