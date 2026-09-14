import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { initDb, run } from './db.js';
import router from './routes.js';
import { startScheduler } from './scheduler.js';
import { nowIso } from './util.js';

async function main() {
  await initDb();

  // any run still marked 'running' belongs to a dead process (server restart
  // or crash mid-run) — close it out so the UI never shows it forever
  const healed = await run(
    "UPDATE runs SET status = 'error', delivery = 'skipped', error = 'interrupted by server restart', finished_at = ? WHERE status = 'running'",
    [nowIso()]
  );
  if (healed.affectedRows > 0) {
    console.log(`[boot] closed ${healed.affectedRows} run(s) left 'running' by a previous process`);
  }

  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use((err, _req, res, _next) => {
    console.error('[api] error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  const dist = path.join(ROOT, 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(config.port, () => {
    console.log(`Job Alert Bot listening on http://localhost:${config.port}`);
    if (!config.apifyToken) console.log('APIFY_TOKEN not set — running in MOCK mode (no real actor runs)');
    if (!config.telegramBotToken || !config.telegramChatId) {
      console.log('Telegram not configured — summaries will not be delivered');
    }
    startScheduler().catch((e) => console.error('[scheduler] failed to start:', e));
  });
}

main().catch((e) => {
  console.error('Failed to start server:', e.message);
  process.exit(1);
});
