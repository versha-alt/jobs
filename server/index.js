import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { initDb, run, backfillJobsIndex } from './db.js';
import { loadSettingsIntoConfig } from './settingsService.js';
import { requireAuth, authRouter, ensureSeedAdmin } from './auth.js';
import router from './routes.js';
import { startScheduler } from './scheduler.js';
import { nowIso } from './util.js';

async function main() {
  await initDb();
  await ensureSeedAdmin();
  await loadSettingsIntoConfig();
  try {
    const n = await backfillJobsIndex();
    if (n > 0) console.log(`[boot] jobs index ready (${n} rows scanned)`);
  } catch (e) {
    console.error('[boot] jobs backfill failed:', e.message);
  }

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
  app.use('/api/auth', authRouter);
  app.use('/api', requireAuth, router);
  app.use((err, _req, res, _next) => {
    console.error('[api] error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  const dist = path.join(ROOT, 'dist');
  if (fs.existsSync(dist)) {
    // "/" shows the marketing landing page; the dashboard app lives at every
    // other path (its own router gates unauthenticated visitors to sign-in)
    const landing = path.join(ROOT, 'landing.html');
    app.use(express.static(dist, { index: false }));
    app.get('/', (_req, res, next) => {
      if (fs.existsSync(landing)) return res.sendFile(landing);
      next();
    });
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(config.port, () => {
    console.log(`Job Portal listening on http://localhost:${config.port}`);
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
