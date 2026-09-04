import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from './config.js';
import router from './routes.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.use(express.json());
app.use('/api', router);

const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(config.port, () => {
  console.log(`Job Alert Bot listening on http://localhost:${config.port}`);
  if (!config.apifyToken) console.log('APIFY_TOKEN not set — running in MOCK mode (no real actor runs)');
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.log('Telegram not configured — CSVs are generated but not delivered');
  }
  startScheduler();
});
